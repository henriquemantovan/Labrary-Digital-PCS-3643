import { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { createPermissions } from "../services/permissions.js";

const params = z.object({ projectId: z.coerce.number().int().positive() });
const inputSchema = z
  .object({
    clientMessageId: z.uuid(),
    body: z.string().trim().min(1).max(5000),
    materialVersionId: z.number().int().positive().nullable().default(null),
  })
  .strict();

export function createMessageController(
  repository: ProjectRepository,
  auth: AuthRepository,
  now: () => number,
) {
  const permissions = createPermissions(auth);
  const authorize = (request: Request, response: Response) => {
    const { projectId } = params.parse(request.params);
    const project = repository.get(projectId);
    if (!project || !permissions.canRead(response.locals.user, project)) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    return project;
  };
  return {
    list(request: Request, response: Response) {
      const project = authorize(request, response);
      response.json({ data: repository.listMessages(project.id) });
    },
    create(request: Request, response: Response) {
      const project = authorize(request, response);
      const input = inputSchema.parse(request.body);
      const version =
        input.materialVersionId === null
          ? null
          : repository
              .listMaterials(project.id)
              .find((item) => item.id === input.materialVersionId);
      if (version === undefined)
        throw new ApiError(
          404,
          "MATERIAL_NOT_FOUND",
          "Versão de material não encontrada.",
        );
      const user = response.locals.user;
      const result = repository.createMessage({
        projectId: project.id,
        clientMessageId: input.clientMessageId,
        body: input.body,
        author: { id: user.id, fullName: user.fullName, role: user.role },
        createdAt: new Date(now()).toISOString(),
        materialVersion: version
          ? {
              id: version.id,
              title: version.title,
              versionNumber: version.versionNumber,
            }
          : null,
      });
      response
        .status(result.created ? 201 : 200)
        .json({ data: result.message });
    },
  };
}
