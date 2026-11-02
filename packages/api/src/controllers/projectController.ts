import { AuthRepository } from "../repositories/authRepository.js";
import { createPermissions } from "../services/permissions.js";
import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { Project, materialKinds, projectStatuses } from "../models/project.js";
import { ProjectRepository } from "../repositories/projectRepository.js";

const positiveInteger = z.coerce.number().int().positive();

const listQuerySchema = z
  .object({
    status: z.enum(projectStatuses).optional(),
    classId: positiveInteger.optional(),
    groupId: positiveInteger.optional(),
    pending: z.enum(["true", "false"]).optional(),
  })
  .strict();

const projectIdSchema = z.object({ projectId: positiveInteger });

const createProjectSchema = z
  .object({
    classId: positiveInteger,
    groupId: positiveInteger,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).default(""),
    category: z.string().trim().min(1).max(100),
    dueAt: z.iso.datetime().optional(),
  })
  .strict();

const createMaterialSchema = z
  .object({
    kind: z.enum(materialKinds),
    title: z.string().trim().min(1).max(200),
    originalFilename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(160),
    sizeBytes: z.number().int().nonnegative().max(100_000_000),
  })
  .strict();

export function createProjectController(
  repository: ProjectRepository,
  auth: AuthRepository,
) {
  const permissions = createPermissions(auth);
  const accessibleProject = (request: Request, response: Response) => {
    const { projectId } = projectIdSchema.parse(request.params);
    const project = repository.get(projectId);
    if (!project || !permissions.canRead(response.locals.user, project)) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    return project;
  };
  const presentProject = (project: Project) => {
    const present = new Set(
      repository.listMaterials(project.id).map((item) => item.kind),
    );
    return {
      id: project.id,
      classId: project.classId,
      groupId: project.groupId,
      title: project.title,
      description: project.description,
      category: project.category,
      status: project.status,
      dueAt: project.dueAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      groupName:
        auth.directory.groups.find((group) => group.id === project.groupId)
          ?.name ?? `Grupo ${project.groupId}`,
      missingMaterials: (["VIDEO", "RELATORIO", "MANUAL"] as const).filter(
        (kind) => !present.has(kind),
      ),
    };
  };
  return {
    list(request: Request, response: Response) {
      const query = listQuerySchema.parse(request.query);
      response.status(200).json({
        data: repository
          .list(query)
          .filter((project) =>
            permissions.canRead(response.locals.user, project),
          )
          .filter(
            (project) => !query.groupId || project.groupId === query.groupId,
          )
          .map(presentProject)
          .filter(
            (project) =>
              query.pending === undefined ||
              project.missingMaterials.length > 0 ===
                (query.pending === "true"),
          ),
      });
    },

    get(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      response.status(200).json({ data: presentProject(project) });
    },

    create(request: Request, response: Response) {
      if (response.locals.user.role !== "PROFESSOR")
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Você não tem permissão para esta ação.",
        );
      const input = createProjectSchema.parse(request.body);
      permissions.assertCreate(
        response.locals.user,
        input.classId,
        input.groupId,
      );
      const project = repository.create(input);
      response.status(201).json({ data: presentProject(project) });
    },

    listMaterials(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const projectId = project.id;
      response.status(200).json({ data: repository.listMaterials(projectId) });
    },

    createMaterial(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const projectId = project.id;
      permissions.assertUpload(response.locals.user, project);
      const material = repository.createMaterial(
        projectId,
        createMaterialSchema.parse(request.body),
      );
      response.status(201).json({ data: material });
    },
  };
}
