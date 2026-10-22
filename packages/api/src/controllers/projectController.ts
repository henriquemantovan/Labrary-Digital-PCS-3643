import { AuthRepository } from "../repositories/authRepository.js";
import { createPermissions } from "../services/permissions.js";
import {
  assertFileAccepted,
  createDefaultMaterialPolicy,
  MaterialPolicy,
  ruleFor,
  uploadLock,
} from "../services/materialPolicy.js";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import {
  materialKinds,
  ProjectMaterial,
  projectStatuses,
} from "../models/project.js";
import { ProjectRepository } from "../repositories/projectRepository.js";

const positiveInteger = z.coerce.number().int().positive();

const listQuerySchema = z
  .object({
    status: z.enum(projectStatuses).optional(),
    classId: positiveInteger.optional(),
  })
  .strict();

const projectIdSchema = z.object({ projectId: positiveInteger });
const materialIdSchema = z.object({
  projectId: positiveInteger,
  materialId: positiveInteger,
});

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

const fileMetadataSchema = z
  .object({
    originalFilename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(160),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict();

const createMaterialSchema = fileMetadataSchema
  .extend({
    kind: z.enum(materialKinds),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export interface ProjectControllerOptions {
  now?: () => number;
  materialPolicy?: MaterialPolicy;
}

export function createProjectController(
  repository: ProjectRepository,
  auth: AuthRepository,
  options: ProjectControllerOptions = {},
) {
  const permissions = createPermissions(auth);
  const now = options.now ?? Date.now;
  const policy = options.materialPolicy ?? createDefaultMaterialPolicy();
  const authorName = (userId: number) =>
    auth.directory.users.find((user) => user.id === userId)?.fullName ?? null;
  // A chave interna de armazenamento nunca sai da API.
  const presentVersion = ({
    storageKey: _storageKey,
    uploadedBy,
    ...version
  }: ProjectMaterial["versions"][number]) => ({
    ...version,
    uploadedBy: { id: uploadedBy, fullName: authorName(uploadedBy) },
  });
  const presentMaterial = ({ versions, ...material }: ProjectMaterial) => ({
    ...material,
    currentVersion: presentVersion(versions[0]),
    versions: versions.map(presentVersion),
  });
  const pendingStorageKey = (projectId: number) =>
    `mock/${projectId}/${randomUUID()}`;
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
          ),
      });
    },

    get(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      response.status(200).json({ data: project });
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
      response.status(201).json({ data: project });
    },

    listMaterials(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      response.status(200).json({
        data: repository.listMaterials(project.id).map(presentMaterial),
      });
    },

    materialRules(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const lock = uploadLock(project, now());
      response.status(200).json({
        data: {
          dueAt: project.dueAt,
          lock,
          canUpload:
            !lock && permissions.canUpload(response.locals.user, project),
          rules: policy.rulesFor(project),
        },
      });
    },

    createMaterial(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const user = response.locals.user;
      permissions.assertUpload(user, project, now());
      const { kind, title, ...file } = createMaterialSchema.parse(request.body);
      assertFileAccepted(ruleFor(policy, project, kind), file);
      const material = repository.createMaterial(
        project.id,
        { kind, title, createdBy: user.id },
        {
          ...file,
          storageKey: pendingStorageKey(project.id),
          checksumSha256: null,
          uploadedBy: user.id,
        },
      );
      response.status(201).json({ data: presentMaterial(material) });
    },

    createVersion(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const { materialId } = materialIdSchema.parse(request.params);
      const existing = repository.getMaterial(project.id, materialId);
      if (!existing)
        throw new ApiError(
          404,
          "MATERIAL_NOT_FOUND",
          "Material não encontrado.",
        );
      const user = response.locals.user;
      permissions.assertUpload(user, project, now());
      const file = fileMetadataSchema.parse(request.body);
      assertFileAccepted(ruleFor(policy, project, existing.kind), file);
      const material = repository.addVersion(project.id, materialId, {
        ...file,
        storageKey: pendingStorageKey(project.id),
        checksumSha256: null,
        uploadedBy: user.id,
      });
      response.status(201).json({ data: presentMaterial(material) });
    },
  };
}
