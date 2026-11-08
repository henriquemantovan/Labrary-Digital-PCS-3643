import { Request, Response, Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { configurationInputSchema } from "../models/rubric.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { RubricRepository } from "../repositories/rubricRepository.js";
import { createPermissions } from "../services/permissions.js";

const id = z.coerce.number().int().positive().safe();
const createSchema = configurationInputSchema.extend({ baseVersionId: z.number().int().nonnegative().safe() });

export function createRubricRouter(projects: ProjectRepository, auth: AuthRepository, rubrics: RubricRepository, now: () => number) {
  const router = Router();
  const permissions = createPermissions(auth);
  const project = (request: Request, response: Response) => {
    const item = projects.get(id.parse(request.params.projectId));
    if (!item || !permissions.canRead(response.locals.user, item))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return item;
  };
  router.get("/projects/:projectId/configuration", (request, response) => {
    response.json({ data: rubrics.latest(project(request, response).id) ?? null });
  });
  router.get("/projects/:projectId/configuration/versions", (request, response) => {
    response.json({ data: rubrics.list(project(request, response).id) });
  });
  router.get("/projects/:projectId/configuration/versions/:versionId", (request, response) => {
    const item = project(request, response);
    const version = rubrics.get(id.parse(request.params.versionId));
    if (!version || version.projectId !== item.id)
      throw new ApiError(404, "RUBRIC_NOT_FOUND", "Versão de rubrica não encontrada.");
    response.json({ data: version });
  });
  router.post("/projects/:projectId/configuration/versions", (request, response) => {
    const item = project(request, response);
    if (!permissions.ownsClass(response.locals.user, item.classId))
      throw new ApiError(403, "FORBIDDEN", "Somente o professor pode configurar requisitos e rubricas.");
    const { baseVersionId, ...input } = createSchema.parse(request.body);
    const version = rubrics.create({
      ...input, classId: item.classId, projectId: item.id,
      createdBy: response.locals.accountUser.id, createdAt: new Date(now()).toISOString(),
    }, baseVersionId);
    response.status(201).json({ data: version });
  });
  return router;
}
