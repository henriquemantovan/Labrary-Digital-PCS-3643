import { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { PublicationService } from "../services/publicationService.js";
import { FileStorage } from "../services/fileStorage.js";
import { parseByteRange } from "../services/byteRange.js";
import { attachmentHeader } from "./projectController.js";
const id = z.coerce.number().int().positive().safe();
const projectId = (request: Request) => id.parse(request.params.projectId);
const reference = z.number().int().positive().safe();
const submissionInput = z.object({ submissionId: reference }).strict();
const publicationInput = submissionInput
  .extend({
    materialVersionIds: z
      .array(reference)
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length),
    groupAuthorization: z
      .object({
        confirmed: z.literal(true),
        reference: z.string().trim().min(5).max(1000),
      })
      .strict(),
  })
  .strict();
const filters = z
  .object({
    q: z.string().trim().max(200).optional(),
    academicYear: z.coerce.number().int().min(2000).max(2200).optional(),
    classId: id.optional(),
    category: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
const missing = () =>
  new ApiError(404, "PUBLICATION_NOT_FOUND", "Publicação não encontrada.");
export function createPublicationController(
  service: PublicationService,
  storage: FileStorage,
) {
  return {
    async management(request: Request, response: Response) {
      response.json({
        data: await service.management(
          projectId(request),
          response.locals.user,
        ),
      });
    },
    async finalize(request: Request, response: Response) {
      const input = submissionInput.parse(request.body);
      await service.finalize(
        projectId(request),
        response.locals.user,
        response.locals.accountUser.id,
        input.submissionId,
      );
      response.json({
        data: await service.management(
          projectId(request),
          response.locals.user,
        ),
      });
    },
    async publish(request: Request, response: Response) {
      const input = publicationInput.parse(request.body);
      await service.publish(
        projectId(request),
        response.locals.user,
        response.locals.accountUser.id,
        input,
      );
      response.json({
        data: await service.management(
          projectId(request),
          response.locals.user,
        ),
      });
    },
    async withdraw(request: Request, response: Response) {
      await service.withdraw(
        projectId(request),
        response.locals.user,
        response.locals.accountUser.id,
      );
      response.status(204).end();
    },
    async list(request: Request, response: Response) {
      response.json({ data: await service.list(filters.parse(request.query)) });
    },
    async get(request: Request, response: Response) {
      const project = await service.get(projectId(request));
      if (!project) throw missing();
      response.json({ data: project });
    },
    async file(request: Request, response: Response) {
      const project = projectId(request),
        versionId = id.parse(request.params.versionId);
      const version = service.publicVersion(project, versionId);
      let file = await storage.open(version.storageKey);
      if (!file) throw missing();
      file.stream.on("error", () => undefined);
      if (file.sizeBytes !== version.sizeBytes) {
        file.stream.destroy();
        throw missing();
      }
      try {
        service.publicVersion(project, versionId);
      } catch (error) {
        file.stream.destroy();
        throw error;
      }
      const rangeHeader =
        request.method === "HEAD" ? undefined : request.get("Range");
      const range = rangeHeader
        ? parseByteRange(rangeHeader, file.sizeBytes)
        : undefined;
      if (rangeHeader && !range) {
        file.stream.destroy();
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
      }
      // Revalida após o acesso assíncrono ao disco, inclusive se houve retirada.
      try {
        service.publicVersion(project, versionId);
      } catch (error) {
        file.stream.destroy();
        throw error;
      }
      if (range)
        response.set(
          "Content-Range",
          `bytes ${range.start}-${range.end}/${file.sizeBytes}`,
        );
      response.status(range ? 206 : 200).set({
        "Content-Type": version.mimeType,
        "Content-Length": String(
          range ? range.end - range.start + 1 : file.sizeBytes,
        ),
        "Accept-Ranges": "bytes",
        "Content-Disposition": version.mimeType.startsWith("video/")
          ? attachmentHeader(version.originalFilename).replace(
              /^attachment;/,
              "inline;",
            )
          : attachmentHeader(version.originalFilename),
        "Content-Security-Policy": "default-src 'none'; sandbox",
      });
      if (request.method === "HEAD") {
        file.stream.destroy();
        response.end();
        return;
      }
      await pipeline(file.stream, response).catch(() => undefined);
    },
  };
}
