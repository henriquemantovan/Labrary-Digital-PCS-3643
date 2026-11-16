import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { GroupRepository } from "../repositories/groupRepository.js";
import { createPermissions } from "../services/permissions.js";

const id = z.coerce.number().int().positive().safe();
const ids = z
  .array(z.number().int().positive().safe())
  .max(200)
  .refine((items) => new Set(items).size === items.length);
export function createGroupController(
  projects: ProjectRepository,
  auth: AuthRepository,
  planning: GroupRepository,
  now: () => number,
) {
  const permissions = createPermissions(auth);
  const teacher = (response: Response) => {
    if (!["PROFESSOR", "ADMIN"].includes(response.locals.user.role))
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
  const project = (request: Request, response: Response) => {
    teacher(response);
    const item = projects.get(id.parse(request.params.projectId));
    if (!item || !permissions.canRead(response.locals.user, item))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return item;
  };
  return {
    async administration(request: Request, response: Response) {
      const classId = ownClass(request, response);
      response.json({
        data: {
          groups: await Promise.all(
            auth.directory.groups
              .filter((item) => item.classId === classId)
              .map(async (item) => ({
                ...item,
                history: await planning.history("GROUP", item.id),
              })),
          ),
          // Contas ativas provisionadas; credenciais e identificadores Google não são expostos.
          people: auth.directory.users
            .filter(
              (item) =>
                item.active &&
                ["ALUNO", "AVALIADOR", "ADMIN"].includes(item.role),
            )
            .map(({ id, fullName, role }) => ({ id, fullName, role })),
        },
      });
    },
    async createGroup(request: Request, response: Response) {
      const classId = ownClass(request, response);
      const input = z
        .object({ name: z.string().trim().min(1).max(120) })
        .strict()
        .parse(request.body);
      const group = await planning.createGroup(
        classId,
        input.name,
        response.locals.accountUser.id,
      );
      await auth.refresh?.();
      response.status(201).json({ data: group });
    },
    async members(request: Request, response: Response) {
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
      await planning.setLinks(classId, {
        target: "GROUP",
        targetId: groupId,
        after: memberIds,
        changedBy: response.locals.accountUser.id,
        changedAt: new Date(now()).toISOString(),
      });
      await auth.refresh?.();
      response.json({
        data: {
          ...group,
          memberIds,
          history: await planning.history("GROUP", groupId),
        },
      });
    },
    async evaluators(request: Request, response: Response) {
      const item = project(request, response);
      response.json({
        data: {
          evaluatorIds: auth.directory.assignments
            .filter((link) => link.projectId === item.id)
            .map((link) => link.evaluatorId),
          history: await planning.history("PROJECT", item.id),
        },
      });
    },
    async setEvaluators(request: Request, response: Response) {
      const item = project(request, response);
      const { evaluatorIds } = z
        .object({ evaluatorIds: ids })
        .strict()
        .parse(request.body);
      await planning.setLinks(item.classId, {
        target: "PROJECT",
        targetId: item.id,
        after: evaluatorIds,
        changedBy: response.locals.accountUser.id,
        changedAt: new Date(now()).toISOString(),
      });
      await auth.refresh?.();
      response.json({
        data: {
          evaluatorIds,
          history: await planning.history("PROJECT", item.id),
        },
      });
    },
  };
}
