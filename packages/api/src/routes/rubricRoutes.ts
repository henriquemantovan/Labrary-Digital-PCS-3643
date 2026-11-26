import type { DataRepository } from "../repositories/asyncRepository.js";
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

export function createRubricRouter(projects: DataRepository<ProjectRepository>, auth: AuthRepository, rubrics: DataRepository<RubricRepository>, now: () => number) {
  const router = Router();
  const permissions = createPermissions(auth);
  const project = async (request: Request, response: Response) => {
    const item = (await projects.get(id.parse(request.params.projectId)));
    if (!item || !permissions.canRead(response.locals.user, item))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return item;
  };
  router.get("/projects/:projectId/configuration", async (request, response) => {
    response.json({ data: (await rubrics.latest((await project(request, response)).id)) ?? null });
  });
  router.get("/projects/:projectId/configuration/versions", async (request, response) => {
    response.json({ data: (await rubrics.list((await project(request, response)).id)) });
  });
  router.get("/projects/:projectId/configuration/versions/:versionId", async (request, response) => {
    const item = (await project(request, response));
    const version = (await rubrics.get(id.parse(request.params.versionId)));
    if (!version || version.projectId !== item.id)
      throw new ApiError(404, "RUBRIC_NOT_FOUND", "Versão dos critérios de avaliação não encontrada.");
    response.json({ data: version });
  });
  router.post("/projects/:projectId/configuration/versions", async (request, response) => {
    const item = (await project(request, response));
    if (!permissions.ownsClass(response.locals.user, item.classId))
      throw new ApiError(403, "FORBIDDEN", "Somente o professor pode configurar requisitos e critérios de avaliação.");
    const { baseVersionId, ...input } = createSchema.parse(request.body);
    const version = (await rubrics.create({
      ...input, classId: item.classId, projectId: item.id,
      createdBy: response.locals.accountUser.id, createdAt: new Date(now()).toISOString(),
    }, baseVersionId));
    response.status(201).json({ data: version });
  });
  return router;
}
