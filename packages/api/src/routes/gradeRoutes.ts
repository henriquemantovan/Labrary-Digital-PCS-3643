import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { ResultReleaseRepository } from "../repositories/resultReleaseRepository.js";
import { EvaluationProvider, GradeRow } from "../models/consolidation.js";
import { consolidate, evaluationFingerprint, gradesCsv } from "../services/consolidation.js";
import { createPermissions } from "../services/permissions.js";
import { User } from "../models/auth.js";
import { Project } from "../models/project.js";

const id = z.coerce.number().int().positive().safe();
export function createGradeRouter(projects: ProjectRepository, auth: AuthRepository,
  releases: ResultReleaseRepository, provider: EvaluationProvider | undefined, now: () => number) {
  const router = Router();
  const permissions = createPermissions(auth);
  const teacher = (user: User) => {
    if (!["PROFESSOR", "ADMIN"].includes(user.role))
      throw new ApiError(403, "FORBIDDEN", "Somente o professor da turma pode consultar ou liberar notas.");
  };
  const current = async (project: Project) => {
    if (!provider) throw new ApiError(503, "EVALUATIONS_UNAVAILABLE", "Consolidação indisponível: a integração de avaliações ainda não está configurada.");
    const round = await provider.getCurrentRound(project.id);
    const result = consolidate(project.id, round);
    const fingerprint = round ? evaluationFingerprint(round) : null;
    result.resultReleased = result.allEvaluationsCompleted && !!fingerprint && !!releases.find(project.id, fingerprint);
    return { round, fingerprint, result };
  };
  const ownProject = (user: User, projectId: number) => {
    const project = projects.get(projectId);
    if (!project || !permissions.canRead(user, project))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    return project;
  };
  router.get("/classes/:classId/grades", async (request, response) => {
    const user = response.locals.user;
    teacher(user);
    const classId = id.parse(request.params.classId);
    if (!permissions.ownsClass(user, classId)) throw new ApiError(404, "CLASS_NOT_FOUND", "Turma não encontrada.");
    const { format } = z.object({ format: z.literal("csv").optional() }).strict().parse(request.query);
    const rows: GradeRow[] = await Promise.all(projects.list({ classId }).map(async project => ({
      ...(await current(project)).result,
      groupId: project.groupId,
      groupName: auth.directory.groups.find(group => group.id === project.groupId)!.name,
      title: project.title,
    })));
    if (format === "csv") response.type("text/csv; charset=utf-8").attachment(`notas-turma-${classId}.csv`).send(gradesCsv(rows));
    else response.json({ data: rows });
  });
  router.post("/projects/:projectId/results/release", async (request, response) => {
    const user = response.locals.user;
    teacher(user);
    const project = ownProject(user, id.parse(request.params.projectId));
    const body = z.object({ submissionId: id, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(request.body);
    const { result, round, fingerprint } = await current(project);
    if (!round || !result.allEvaluationsCompleted) throw new ApiError(409, "EVALUATIONS_INCOMPLETE", "Todas as avaliações previstas precisam estar finalizadas.");
    if (body.submissionId !== round.submissionId || body.fingerprint !== fingerprint)
      throw new ApiError(409, "RESULT_VERSION_CONFLICT", "A rodada mudou. Atualize a consolidação antes de liberar.");
    releases.release({ projectId: project.id, submissionId: round.submissionId, round: round.round,
      fingerprint: fingerprint!, releasedBy: user.id, releasedAt: new Date(now()).toISOString() });
    response.json({ data: { ...result, resultReleased: true } });
  });
  // Token de confirmação recebido separadamente; também protege contra tela desatualizada.
  router.get("/projects/:projectId/results/consolidation", async (request, response) => {
    const user = response.locals.user;
    teacher(user);
    const project = ownProject(user, id.parse(request.params.projectId));
    const { result, fingerprint } = await current(project);
    response.json({ data: { result, fingerprint } });
  });
  router.get("/projects/:projectId/result", async (request, response) => {
    const user = response.locals.user;
    const project = ownProject(user, id.parse(request.params.projectId));
    if (user.role !== "ALUNO") throw new ApiError(403, "FORBIDDEN", "Este resultado é exclusivo dos integrantes do grupo.");
    const { result, round } = await current(project);
    if (!result.resultReleased) {
      response.json({ data: { projectId: project.id, resultReleased: false } });
      return;
    }
    response.json({ data: { ...result, rubric: round!.rubric,
      evaluations: round!.evaluations.map(({ evaluatorId, scores }) => ({ evaluatorId, scores })) } });
  });
  return router;
}
