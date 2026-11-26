import { Request, Response, Router } from "express";
import { z } from "zod";
import { scoresSchema } from "../models/evaluation.js";
import type { EvaluationService } from "../services/evaluationService.js";

const id = z.coerce.number().int().positive().safe();
const revision = z.number().int().nonnegative().safe();
const edit = z.object({ scores: scoresSchema, expectedRevision: revision }).strict();
const reopen = z.object({ reason: z.string().trim().min(1).max(2000), expectedRevision: revision }).strict();

const path = "/projects/:projectId/submissions/:submissionId/evaluations";

export function createEvaluationRouter(service: EvaluationService) {
  const router = Router();

  function context(request: Request, response: Response) {
    return {
      projectId: id.parse(request.params.projectId),
      submissionId: id.parse(request.params.submissionId),
      user: response.locals.user,
    };
  }

  router.get(path, async (request, response) => {
    response.json({ data: (await service.read(context(request, response))) });
  });

  router.put(`${path}/me`, async (request, response) => {
    response.json({ data: (await service.edit(context(request, response), edit.parse(request.body), false)) });
  });

  router.post(`${path}/me/finalize`, async (request, response) => {
    response.json({ data: (await service.edit(context(request, response), edit.parse(request.body), true)) });
  });

  router.post(`${path}/:evaluatorId/reopen`, async (request, response) => {
    response.json({ data: (await service.reopen(
      context(request, response),
      id.parse(request.params.evaluatorId),
      reopen.parse(request.body),
    )) });
  });

  return router;
}
