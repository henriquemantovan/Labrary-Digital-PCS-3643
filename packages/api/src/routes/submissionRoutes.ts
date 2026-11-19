import { randomUUID } from "node:crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { RubricRepository } from "../repositories/rubricRepository.js";
import { Project } from "../models/project.js";
import { RubricVersion } from "../models/rubric.js";
import { createPermissions } from "../services/permissions.js";
import { deadlinePassed, prepareSubmission, submissionChecklist } from "../services/submissionRules.js";

const id = z.coerce.number().int().positive().safe();
const submitSchema = z.object({ clientSubmissionId: z.uuid() }).strict();
const reopenSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();

/** HU05 / C1: checklist, submissão, histórico de rodadas, devolução para ajustes e reabertura. */
export function createSubmissionRouter(
  projects: ProjectRepository,
  auth: AuthRepository,
  rubrics: RubricRepository,
  now: () => number,
) {
  const router = Router();
  const permissions = createPermissions(auth);
  // Projeto fora do escopo de leitura responde como inexistente.
  const project = (request: Request, response: Response) => {
    const item = projects.get(id.parse(request.params.projectId));
    if (!item || !permissions.canRead(response.locals.user, item))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return item;
  };
  const prepare = (request: Request, response: Response, clientSubmissionId: string) => {
    const item = project(request, response);
    return prepareSubmission({
      project: item,
      rubric: rubrics.latest(item.id) ?? null,
      materials: projects.listMaterials(item.id),
      previous: projects.listSubmissions(item.id),
      clientSubmissionId,
      submittedBy: response.locals.accountUser.id,
      now: now(),
    });
  };

  // Reabrir só cabe ao professor da turma (ou ADMIN), em Preparação com prazo vencido.
  const canReopen = (response: Response, item: Project, rubric: RubricVersion | null) =>
    permissions.ownsClass(response.locals.user, item.classId) &&
    item.status === "PREPARACAO" && deadlinePassed(item, rubric, now());

  router.get("/projects/:projectId/submission-checklist", (request, response) => {
    const item = project(request, response);
    const rubric = rubrics.latest(item.id) ?? null;
    let blockedBy: string | null = null;
    try {
      // Mesma regra do POST, com identificador descartável: nada é gravado.
      prepare(request, response, randomUUID());
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      blockedBy = error.code;
    }
    response.json({
      data: {
        projectStatus: item.status,
        rubricVersionId: rubric?.id ?? null,
        items: rubric ? submissionChecklist(rubric.requirements, projects.listMaterials(item.id)) : [],
        blockedBy,
        canSubmit: blockedBy === null && permissions.canUpload(response.locals.user, item),
        canReopen: canReopen(response, item, rubric),
        lastReopening: projects.listReopenings(item.id).at(-1) ?? null,
      },
    });
  });

  router.get("/projects/:projectId/submissions", (request, response) => {
    response.json({ data: projects.listSubmissions(project(request, response).id) });
  });

  router.get("/projects/:projectId/submissions/:submissionId", (request, response) => {
    const submission = projects.getSubmission(
      project(request, response).id,
      id.parse(request.params.submissionId),
    );
    if (!submission)
      throw new ApiError(404, "SUBMISSION_NOT_FOUND", "Submissão não encontrada.");
    response.json({ data: submission });
  });

  router.post("/projects/:projectId/submissions", (request, response) => {
    const item = project(request, response);
    if (!permissions.canUpload(response.locals.user, item))
      throw new ApiError(403, "FORBIDDEN", "Somente integrantes do grupo podem submeter o projeto.");
    const { clientSubmissionId } = submitSchema.parse(request.body);
    const prepared = prepare(request, response, clientSubmissionId);
    if (prepared.repeated) {
      response.status(200).json({ data: prepared.submission });
      return;
    }
    response.status(201).json({ data: projects.createSubmission(prepared.submission) });
  });

  router.post("/projects/:projectId/submissions/:submissionId/return", (request, response) => {
    const item = project(request, response);
    if (!permissions.ownsClass(response.locals.user, item.classId))
      throw new ApiError(403, "FORBIDDEN", "Somente o professor da turma pode devolver para ajustes.");
    const submission = projects.returnSubmission(
      item.id,
      id.parse(request.params.submissionId),
      new Date(now()).toISOString(),
    );
    response.json({ data: submission });
  });

  router.post("/projects/:projectId/reopen", (request, response) => {
    const item = project(request, response);
    if (!permissions.ownsClass(response.locals.user, item.classId))
      throw new ApiError(403, "FORBIDDEN", "Somente o professor da turma pode reabrir a entrega.");
    const { reason } = reopenSchema.parse(request.body);
    if (!canReopen(response, item, rubrics.latest(item.id) ?? null))
      throw new ApiError(409, "REOPEN_NOT_ALLOWED", "Só é possível reabrir uma entrega em preparação com prazo vencido.");
    const reopening = projects.reopenProject({
      projectId: item.id,
      reopenedBy: response.locals.accountUser.id,
      reopenedAt: new Date(now()).toISOString(),
      reason,
    });
    response.status(201).json({ data: reopening });
  });

  return router;
}
