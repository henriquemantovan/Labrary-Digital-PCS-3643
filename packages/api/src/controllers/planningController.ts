import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { Requirement } from "../models/planning.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { PlanningRepository } from "../repositories/planningRepository.js";
import { createPermissions } from "../services/permissions.js";

const id = z.coerce.number().int().positive();
const ids = z
  .array(z.number().int().positive())
  .max(200)
  .refine((items) => new Set(items).size === items.length);
const requirementSchema = z
  .object({
    kind: z.enum(["VIDEO", "RELATORIO", "MANUAL"]),
    label: z.string().trim().min(1).max(160),
    required: z.literal(true),
    allowedMimeTypes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[\w.+-]+\/[\w.+-]+$/)
          .max(160),
      )
      .min(1)
      .max(20),
    maxSizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    dueAt: z.iso.datetime(),
  })
  .strict();
const requirementsSchema = z
  .object({
    requirements: z
      .array(requirementSchema)
      .length(3)
      .refine((items) => new Set(items.map((item) => item.kind)).size === 3),
  })
  .strict();
const rubricSchema = z
  .object({
    baseVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(160),
    criteria: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            description: z.string().max(10000),
            weight: z.number().positive().max(100).multipleOf(0.01),
            minScore: z.literal(0),
            maxScore: z.literal(10),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(
        (items) =>
          items.reduce(
            (total, item) => total + Math.round(item.weight * 100),
            0,
          ) === 10000,
        "Os pesos devem somar 100%.",
      ),
  })
  .strict();

export function createPlanningController(
  projects: ProjectRepository,
  auth: AuthRepository,
  planning: PlanningRepository,
  now: () => number,
) {
  const permissions = createPermissions(auth);
  const teacher = (response: Response) => {
    if (response.locals.user.role !== "PROFESSOR")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Você não tem permissão para esta ação.",
      );
  };
  const ownClass = (request: Request, response: Response) => {
    teacher(response);
    const classId = id.parse(request.params.classId);
    if (!permissions.ownsClass(response.locals.user, classId))
      throw new ApiError(404, "CLASS_NOT_FOUND", "Turma não encontrada.");
    return classId;
  };
  const project = (request: Request, response: Response, write = false) => {
    if (write) teacher(response);
    const item = projects.get(id.parse(request.params.projectId));
    if (!item || !permissions.canRead(response.locals.user, item))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return item;
  };
  const validatePeople = (people: number[], role: "ALUNO" | "AVALIADOR") => {
    if (
      people.some(
        (person) =>
          !auth.directory.users.some(
            (user) => user.id === person && user.role === role && user.active,
          ),
      )
    )
      throw new ApiError(
        400,
        "INVALID_LINK",
        "Selecione contas ativas do perfil correto.",
      );
  };
  return {
    administration(request: Request, response: Response) {
      const classId = ownClass(request, response);
      response.json({
        data: {
          groups: auth.directory.groups
            .filter((item) => item.classId === classId)
            .map((item) => ({
              ...item,
              history: planning.history("GROUP", item.id),
            })),
          // Only teachers may choose from provisioned accounts. Never expose credentials.
          people: auth.directory.users
            .filter((item) => item.active && item.role !== "PROFESSOR")
            .map(({ id, fullName, role }) => ({ id, fullName, role })),
        },
      });
    },
    createGroup(request: Request, response: Response) {
      const classId = ownClass(request, response);
      const input = z
        .object({ name: z.string().trim().min(1).max(120) })
        .strict()
        .parse(request.body);
      if (
        auth.directory.groups.some(
          (item) => item.classId === classId && item.name === input.name,
        )
      )
        throw new ApiError(
          409,
          "GROUP_EXISTS",
          "Já existe um grupo com este nome na turma.",
        );
      const group = {
        id: Math.max(0, ...auth.directory.groups.map((item) => item.id)) + 1,
        classId,
        name: input.name,
        memberIds: [] as number[],
      };
      auth.directory.groups.push(group);
      response.status(201).json({ data: group });
    },
    members(request: Request, response: Response) {
      const classId = ownClass(request, response);
      const groupId = id.parse(request.params.groupId);
      const group = auth.directory.groups.find(
        (item) => item.id === groupId && item.classId === classId,
      );
      if (!group)
        throw new ApiError(404, "GROUP_NOT_FOUND", "Grupo não encontrado.");
      const { memberIds } = z
        .object({ memberIds: ids })
        .strict()
        .parse(request.body);
      validatePeople(memberIds, "ALUNO");
      planning.recordChange({
        target: "GROUP",
        targetId: groupId,
        before: group.memberIds,
        after: memberIds,
        changedBy: response.locals.user.id,
        changedAt: new Date(now()).toISOString(),
      });
      group.memberIds = memberIds;
      response.json({
        data: { ...group, history: planning.history("GROUP", groupId) },
      });
    },
    evaluators(request: Request, response: Response) {
      const item = project(request, response, true);
      response.json({
        data: {
          evaluatorIds: auth.directory.assignments
            .filter((link) => link.projectId === item.id)
            .map((link) => link.evaluatorId),
          history: planning.history("PROJECT", item.id),
        },
      });
    },
    setEvaluators(request: Request, response: Response) {
      const item = project(request, response, true);
      const { evaluatorIds } = z
        .object({ evaluatorIds: ids })
        .strict()
        .parse(request.body);
      validatePeople(evaluatorIds, "AVALIADOR");
      const before = auth.directory.assignments
        .filter((link) => link.projectId === item.id)
        .map((link) => link.evaluatorId);
      planning.recordChange({
        target: "PROJECT",
        targetId: item.id,
        before,
        after: evaluatorIds,
        changedBy: response.locals.user.id,
        changedAt: new Date(now()).toISOString(),
      });
      auth.directory.assignments = auth.directory.assignments.filter(
        (link) => link.projectId !== item.id,
      );
      auth.directory.assignments.push(
        ...evaluatorIds.map((evaluatorId) => ({
          projectId: item.id,
          evaluatorId,
        })),
      );
      response.json({
        data: { evaluatorIds, history: planning.history("PROJECT", item.id) },
      });
    },
    requirements(request: Request, response: Response) {
      const item = project(request, response);
      response.json({ data: planning.requirements(item.id) });
    },
    setRequirements(request: Request, response: Response) {
      const item = project(request, response, true);
      const input = requirementsSchema.parse(request.body);
      response.json({
        data: planning.saveRequirements(
          item.id,
          input.requirements as Requirement[],
        ),
      });
    },
    rubrics(request: Request, response: Response) {
      const item = project(request, response);
      response.json({ data: planning.rubrics(item.id) });
    },
    createRubric(request: Request, response: Response) {
      const item = project(request, response, true);
      const { baseVersion, ...input } = rubricSchema.parse(request.body);
      const version = planning.createRubric(
        {
          ...input,
          projectId: item.id,
          classId: item.classId,
          createdBy: response.locals.user.id,
          createdAt: new Date(now()).toISOString(),
        },
        baseVersion,
      );
      response.status(201).json({ data: version });
    },
  };
}
