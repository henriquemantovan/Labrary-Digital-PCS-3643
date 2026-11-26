import type { DataRepository } from "../repositories/asyncRepository.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { createPermissions } from "../services/permissions.js";
import {
  assertFileAccepted,
  createDefaultMaterialPolicy,
  detectMimeType,
  MaterialPolicy,
  AsyncMaterialPolicy,
  MaterialRule,
  materialUploadLock,
  ruleFor,
  uploadLock,
} from "../services/materialPolicy.js";
import { FileStorage } from "../services/fileStorage.js";
import { parseByteRange } from "../services/byteRange.js";
import {
  assertDeclaredLength,
  ReceivedUpload,
  receiveUpload,
} from "../services/multipartUpload.js";
import { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
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
    groupId: positiveInteger.optional(),
    pending: z.enum(["true", "false"]).optional(),
  })
  .strict();

const projectIdSchema = z.object({ projectId: positiveInteger });
const materialIdSchema = z.object({
  projectId: positiveInteger,
  materialId: positiveInteger,
});
const versionIdSchema = materialIdSchema.extend({ versionId: positiveInteger });

/** `attachment` com nome ASCII de reserva e nome UTF-8 (RFC 6266/5987). */
export function attachmentHeader(filename: string) {
  const fallback = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

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
  materialPolicy?: MaterialPolicy | AsyncMaterialPolicy;
  storage: FileStorage;
}

export function createProjectController(
  repository: DataRepository<ProjectRepository>,
  auth: AuthRepository,
  options: ProjectControllerOptions,
) {
  const permissions = createPermissions(auth);
  const now = options.now ?? Date.now;
  const policy = options.materialPolicy ?? createDefaultMaterialPolicy();
  const authorName = (userId: number) =>
    auth.directory.users.find((user) => user.id === userId)?.fullName ?? null;
  // A chave interna de armazenamento nunca sai da API.
  const presentVersion =
    (projectId: number) =>
    ({
      storageKey: _storageKey,
      uploadedBy,
      ...version
    }: ProjectMaterial["versions"][number]) => ({
      ...version,
      uploadedBy: { id: uploadedBy, fullName: authorName(uploadedBy) },
      downloadUrl: `/api/projects/${projectId}/materials/${version.materialId}/versions/${version.id}/file`,
      ...(version.mimeType.startsWith("video/")
        ? {
            playbackUrl: `/api/projects/${projectId}/materials/${version.materialId}/versions/${version.id}/stream`,
          }
        : {}),
    });
  const presentMaterial = ({ versions, ...material }: ProjectMaterial) => ({
    ...material,
    currentVersion: presentVersion(material.projectId)(versions[0]),
    versions: versions.map(presentVersion(material.projectId)),
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
      return await save({
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
  const assertMaterialDeadline = (
    project: Project,
    rule: MaterialRule,
    startedAt: number,
  ) => {
    if (materialUploadLock(project, rule, startedAt) === "DEADLINE_PASSED")
      throw new ApiError(
        409,
        "DEADLINE_PASSED",
        "O prazo de entrega deste material terminou.",
      );
  };
  const accessibleProject = async (request: Request, response: Response) => {
    const { projectId } = projectIdSchema.parse(request.params);
    const project = (await repository.get(projectId));
    if (!project || !permissions.canRead(response.locals.user, project)) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    return project;
  };
  const presentProject = async (project: Project) => {
    const present = new Set(
      (await repository.listMaterials(project.id)).map((item) => item.kind),
    );
    return {
      id: project.id,
      classId: project.classId,
      academicYear:
        auth.directory.classes.find((item) => item.id === project.classId)
          ?.academicYear ?? null,
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
    async list(request: Request, response: Response) {
      const query = listQuerySchema.parse(request.query);
      const visible = (await repository.list(query))
        .filter((project) => permissions.canRead(response.locals.user, project))
        .filter((project) => !query.groupId || project.groupId === query.groupId);
      const presented = await Promise.all(visible.map(presentProject));
      response.status(200).json({
        data: presented.filter(
            (project) =>
              query.pending === undefined ||
              project.missingMaterials.length > 0 ===
                (query.pending === "true"),
          ),
      });
    },

    async get(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      response.status(200).json({ data: (await presentProject(project)) });
    },

    async create(request: Request, response: Response) {
      if (!["PROFESSOR", "ADMIN"].includes(response.locals.user.role))
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
      const project = (await repository.create(input));
      response.status(201).json({ data: (await presentProject(project)) });
    },

    async listMaterials(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      response.status(200).json({
        data: (await repository.listMaterials(project.id)).map(presentMaterial),
      });
    },

    async materialRules(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      const rules = await policy.rulesFor(project);
      const checkedAt = now();
      const lock = uploadLock(project, checkedAt);
      response.status(200).json({
        data: {
          dueAt: project.dueAt,
          lock,
          canUpload:
            !lock && permissions.canUpload(response.locals.user, project),
          rules: rules.map((rule) => ({
            ...rule,
            lock: materialUploadLock(project, rule, checkedAt),
            canUpload:
              !materialUploadLock(project, rule, checkedAt) &&
              permissions.canUpload(response.locals.user, project),
          })),
        },
      });
    },

    async downloadVersion(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      const { materialId, versionId } = versionIdSchema.parse(request.params);
      const version = (await repository
        .getMaterial(project.id, materialId))
        ?.versions.find((item) => item.id === versionId);
      const file = version && (await storage.open(version.storageKey));
      if (!version || !file)
        throw new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
      response.status(200).set({
        "Content-Type": version.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": attachmentHeader(version.originalFilename),
        "Content-Security-Policy": "default-src 'none'; sandbox",
      });
      // Se o cliente desistir no meio, o pipeline fecha o arquivo e a resposta.
      await pipeline(file.stream, response).catch(() => undefined);
    },

    async streamVersion(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      const { materialId, versionId } = versionIdSchema.parse(request.params);
      const version = (await repository
        .getMaterial(project.id, materialId))
        ?.versions.find((item) => item.id === versionId);
      const missing = () =>
        new ApiError(404, "FILE_NOT_FOUND", "Arquivo não encontrado.");
      if (!version?.mimeType.startsWith("video/")) throw missing();
      let file = await storage.open(version.storageKey);
      if (!file) throw missing();
      file.stream.on("error", () => undefined);
      try {
        // O acesso remoto pode ceder o processo a uma alteração de vínculos.
        (await accessibleProject(request, response));
        if (file.sizeBytes !== version.sizeBytes) throw missing();
        const header =
          request.method === "HEAD" ? undefined : request.get("Range");
        const range = header
          ? parseByteRange(header, file.sizeBytes)
          : undefined;
        if (header && !range) {
          response.set("Content-Range", `bytes */${file.sizeBytes}`);
          throw new ApiError(
            416,
            "INVALID_RANGE",
            "Intervalo de bytes inválido.",
          );
        }
        if (range) {
          file.stream.destroy();
          file = await storage.open(version.storageKey, range);
          if (!file) throw missing();
          file.stream.on("error", () => undefined);
          (await accessibleProject(request, response));
          if (file.sizeBytes !== version.sizeBytes) throw missing();
          response.set(
            "Content-Range",
            `bytes ${range.start}-${range.end}/${file.sizeBytes}`,
          );
        }
        response.status(range ? 206 : 200).set({
          "Content-Type": version.mimeType,
          "Content-Length": String(
            range ? range.end - range.start + 1 : file.sizeBytes,
          ),
          "Content-Disposition": attachmentHeader(
            version.originalFilename,
          ).replace(/^attachment;/, "inline;"),
          "Accept-Ranges": "bytes",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        });
        if (request.method === "HEAD") {
          file.stream.destroy();
          response.end();
          return;
        }
        await pipeline(file.stream, response).catch(() => undefined);
      } catch (error) {
        file?.stream.destroy();
        throw error;
      }
    },

    async createMaterial(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      const user = response.locals.user;
      const startedAt = now();
      permissions.assertUpload(user, project, startedAt);
      const rules = await policy.rulesFor(project);
      const resolvedPolicy = createDefaultMaterialPolicy(rules);
      assertDeclaredLength(request, Math.max(...rules.map((rule) => rule.maxSizeBytes)));
      let rule: MaterialRule | undefined;
      const upload = await receiveUpload(request, storage, {
        maxBytes(fields) {
          const { kind } = materialKindSchema.parse(fields);
          rule = ruleFor(resolvedPolicy, project, kind);
          assertMaterialDeadline(project, rule, startedAt);
          return rule.maxSizeBytes;
        },
      });
      const material = await storeVersion(upload, rule!, user.id, async (version) => {
        const { kind, title } = materialFieldsSchema.parse(upload.fields);
        // O projeto pode ter sido submetido enquanto o arquivo chegava.
        permissions.assertUpload(user, await accessibleProject(request, response), startedAt);
        return (await repository.createMaterial(
          project.id,
          { kind, title: title ?? rule!.defaultTitle, createdBy: user.id },
          version,
        ));
      });
      response.status(201).json({ data: presentMaterial(material) });
    },

    async createVersion(request: Request, response: Response) {
      const project = (await accessibleProject(request, response));
      const { materialId } = materialIdSchema.parse(request.params);
      const existing = (await repository.getMaterial(project.id, materialId));
      if (!existing)
        throw new ApiError(
          404,
          "MATERIAL_NOT_FOUND",
          "Material não encontrado.",
        );
      const user = response.locals.user;
      const startedAt = now();
      permissions.assertUpload(user, project, startedAt);
      const rule = ruleFor(createDefaultMaterialPolicy(await policy.rulesFor(project)), project, existing.kind);
      assertMaterialDeadline(project, rule, startedAt);
      assertDeclaredLength(request, rule.maxSizeBytes);
      const upload = await receiveUpload(request, storage, {
        maxBytes: () => rule.maxSizeBytes,
      });
      const material = await storeVersion(upload, rule, user.id, async (version) => {
        if (Object.keys(upload.fields).length)
          throw new ApiError(
            400,
            "UNEXPECTED_FIELD",
            "Envie somente o arquivo para substituir o material.",
          );
        permissions.assertUpload(user, await accessibleProject(request, response), startedAt);
        return (await repository.addVersion(project.id, materialId, version));
      });
      response.status(201).json({ data: presentMaterial(material) });
    },
  };
}
