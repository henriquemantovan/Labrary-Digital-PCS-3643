import { AuthRepository } from "../repositories/authRepository.js";
import { createPermissions } from "../services/permissions.js";
import {
  assertFileAccepted,
  createDefaultMaterialPolicy,
  detectMimeType,
  MaterialPolicy,
  MaterialRule,
  ruleFor,
  uploadLock,
} from "../services/materialPolicy.js";
import { FileStorage } from "../services/fileStorage.js";
import {
  assertDeclaredLength,
  ReceivedUpload,
  receiveUpload,
} from "../services/multipartUpload.js";
import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import {
  materialKinds,
  NewMaterialVersion,
  Project,
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

const materialKindSchema = z.object({ kind: z.enum(materialKinds) });
const materialFieldsSchema = materialKindSchema
  .extend({ title: z.string().trim().min(1).max(200).optional() })
  .strict();

export interface ProjectControllerOptions {
  now?: () => number;
  materialPolicy?: MaterialPolicy;
  storage: FileStorage;
}

export function createProjectController(
  repository: ProjectRepository,
  auth: AuthRepository,
  options: ProjectControllerOptions,
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
  const { storage } = options;
  /**
   * Confere o arquivo pelo tipo detectado nos bytes e grava a versão; se algo
   * falhar, o arquivo recebido é apagado.
   */
  const storeVersion = async <T>(
    { file }: ReceivedUpload,
    rule: MaterialRule,
    uploadedBy: number,
    save: (version: NewMaterialVersion) => T,
  ) => {
    try {
      const format = assertFileAccepted(rule, {
        originalFilename: file.originalFilename,
        mimeType: detectMimeType(file.signature) ?? "application/octet-stream",
        sizeBytes: file.sizeBytes,
      });
      return save({
        originalFilename: file.originalFilename,
        mimeType: format.mimeType,
        sizeBytes: file.sizeBytes,
        storageKey: file.storageKey,
        checksumSha256: file.checksumSha256,
        uploadedBy,
      });
    } catch (error) {
      await storage.remove(file.storageKey);
      throw error;
    }
  };
  const largestRule = (project: Project) =>
    Math.max(...policy.rulesFor(project).map((rule) => rule.maxSizeBytes));
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

    async createMaterial(request: Request, response: Response) {
      const project = accessibleProject(request, response);
      const user = response.locals.user;
      const startedAt = now();
      permissions.assertUpload(user, project, startedAt);
      assertDeclaredLength(request, largestRule(project));
      let rule: MaterialRule | undefined;
      const upload = await receiveUpload(request, storage, {
        maxBytes(fields) {
          const { kind } = materialKindSchema.parse(fields);
          rule = ruleFor(policy, project, kind);
          return rule.maxSizeBytes;
        },
      });
      const material = await storeVersion(upload, rule!, user.id, (version) => {
        const { kind, title } = materialFieldsSchema.parse(upload.fields);
        // O projeto pode ter sido submetido enquanto o arquivo chegava.
        permissions.assertUpload(user, project, startedAt);
        return repository.createMaterial(
          project.id,
          { kind, title: title ?? rule!.defaultTitle, createdBy: user.id },
          version,
        );
      });
      response.status(201).json({ data: presentMaterial(material) });
    },

    async createVersion(request: Request, response: Response) {
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
      const startedAt = now();
      permissions.assertUpload(user, project, startedAt);
      const rule = ruleFor(policy, project, existing.kind);
      assertDeclaredLength(request, rule.maxSizeBytes);
      const upload = await receiveUpload(request, storage, {
        maxBytes: () => rule.maxSizeBytes,
      });
      const material = await storeVersion(upload, rule, user.id, (version) => {
        if (Object.keys(upload.fields).length)
          throw new ApiError(
            400,
            "UNEXPECTED_FIELD",
            "Envie somente o arquivo para substituir o material.",
          );
        permissions.assertUpload(user, project, startedAt);
        return repository.addVersion(project.id, materialId, version);
      });
      response.status(201).json({ data: presentMaterial(material) });
    },
  };
}
