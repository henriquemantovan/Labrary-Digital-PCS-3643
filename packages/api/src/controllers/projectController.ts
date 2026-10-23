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
  const view = (project: Project) => ({
    ...project,
    academicYear:
      auth.directory.classes.find((item) => item.id === project.classId)
        ?.academicYear ?? null,
  });
  const accessibleProject = (request: Request, response: Response) => {
    const { projectId } = projectIdSchema.parse(request.params);
    const project = repository.get(projectId);
    if (!project || !permissions.canRead(response.locals.user, project)) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    return project;
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
          .map(view),
      });
    },

    get(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      response.status(200).json({ data: view(project) });
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
      response.status(201).json({ data: view(project) });
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
