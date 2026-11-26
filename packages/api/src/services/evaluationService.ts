import type { DataRepository } from "../repositories/asyncRepository.js";
import { ApiError } from "../errors.js";
import type { User } from "../models/auth.js";
import type { EvaluationProvider } from "../models/consolidation.js";
import type { CriterionScore, Evaluation } from "../models/evaluation.js";
import type { Submission } from "../models/submission.js";
import type { AuthRepository } from "../repositories/authRepository.js";
import type { EvaluationRepository } from "../repositories/evaluationRepository.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { validateEvaluationScores } from "./evaluationValidation.js";
import { createPermissions } from "./permissions.js";

interface EvaluationContext {
  projectId: number;
  submissionId: number;
  user: User;
}

interface EvaluationEdit {
  scores: CriterionScore[];
  expectedRevision: number;
}

function pending(evaluatorId: number): Evaluation {
  return { evaluatorId, status: "PENDENTE", revision: 0, scores: [], finalizedAt: null, history: [] };
}

function assertRevision(evaluation: Evaluation, expectedRevision: number) {
  if (evaluation.revision !== expectedRevision)
    throw new ApiError(409, "EVALUATION_VERSION_CONFLICT", "A avaliação foi atualizada. Recarregue e tente novamente.");
}

function assertEditableRound(active: boolean) {
  if (!active)
    throw new ApiError(409, "EVALUATION_ROUND_LOCKED", "Somente a rodada submetida em avaliação pode ser alterada.");
}

export function createEvaluationService(
  projects: DataRepository<ProjectRepository>,
  auth: AuthRepository,
  repository: DataRepository<EvaluationRepository>,
  now: () => number,
) {
  const permissions = createPermissions(auth);

  function expectedEvaluators(projectId: number): number[] {
    const ids = auth.directory.assignments
      .filter((link) => link.projectId === projectId)
      .map((link) => link.evaluatorId);
    return [...new Set(ids)].sort((left, right) => left - right);
  }

  async function forRound({ projectId, submissionId, user }: EvaluationContext) {
    const project = (await projects.get(projectId));
    if (!project || !permissions.canRead(user, project))
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    const teacher = permissions.ownsClass(user, project.classId);
    if (!teacher && user.role !== "AVALIADOR")
      throw new ApiError(403, "FORBIDDEN", "Somente avaliadores atribuídos e docentes podem acessar avaliações.");
    const submission = (await projects.getSubmission(projectId, submissionId));
    if (!submission)
      throw new ApiError(404, "SUBMISSION_NOT_FOUND", "Submissão não encontrada.");
    const latest = (await projects.listSubmissions(projectId)).at(-1);
    const active = project.status === "EM_AVALIACAO" && submission.status === "SUBMETIDA" && latest?.id === submission.id;
    return { submission, teacher, active };
  }

  async function record(
    submission: Submission,
    previous: Evaluation,
    actorId: number,
    action: "RASCUNHO" | "FINALIZADA" | "REABERTA",
    scores: CriterionScore[],
    reason: string | null = null,
  ) {
    const at = new Date(now()).toISOString();
    const revision = previous.revision + 1;
    return (await repository.save(submission, {
      evaluatorId: previous.evaluatorId,
      status: action,
      revision,
      scores,
      finalizedAt: action === "FINALIZADA" ? at : null,
      history: [...previous.history, { action, actorId, at, reason, revision, scores }],
    }));
  }

  const getCurrentRound: EvaluationProvider["getCurrentRound"] = async (projectId) => {
    const submission = (await projects.listSubmissions(projectId)).at(-1);
    if (!submission || submission.status === "DEVOLVIDA") return undefined;

    const expectedEvaluatorIds = expectedEvaluators(projectId);
    const evaluations = (await repository.list(submission))
      .filter((item) => expectedEvaluatorIds.includes(item.evaluatorId))
      .sort((left, right) => left.evaluatorId - right.evaluatorId);
    return {
      projectId,
      submissionId: submission.id,
      round: submission.round,
      rubricVersionId: submission.rubricVersionId,
      rubric: submission.rubric,
      expectedEvaluatorIds,
      evaluations,
    };
  };

  return {
    getCurrentRound,
    async read(context: EvaluationContext) {
      const { submission, teacher, active } = (await forRound(context));
      const stored = new Map((await repository.list(submission)).map((item) => [item.evaluatorId, item]));
      const ids = teacher
        ? [...new Set([...expectedEvaluators(context.projectId), ...stored.keys()])].sort((left, right) => left - right)
        : [context.user.id];
      return {
        submission,
        evaluations: ids.map((id) => stored.get(id) ?? pending(id)),
        canEdit: !teacher && active,
        canReopen: teacher && active,
        ...(teacher ? {
          evaluatorNames: Object.fromEntries(ids.map((id) => [id, auth.findById(id)?.fullName ?? `Avaliador #${id}`])),
        } : {}),
      };
    },
    async edit(context: EvaluationContext, input: EvaluationEdit, finalizing: boolean) {
      const { submission, active } = (await forRound(context));
      if (context.user.role !== "AVALIADOR")
        throw new ApiError(403, "FORBIDDEN", "Somente o avaliador atribuído pode registrar suas notas.");
      assertEditableRound(active);
      const previous = (await repository.list(submission)).find((item) => item.evaluatorId === context.user.id) ?? pending(context.user.id);
      assertRevision(previous, input.expectedRevision);
      if (previous.status === "FINALIZADA")
        throw new ApiError(409, "EVALUATION_FINALIZED", "O professor precisa reabrir a avaliação finalizada.");
      const scores = validateEvaluationScores(submission.rubric, input.scores, finalizing);
      return record(submission, previous, context.user.id, finalizing ? "FINALIZADA" : "RASCUNHO", scores);
    },
    async reopen(context: EvaluationContext, evaluatorId: number, input: { reason: string; expectedRevision: number }) {
      const { submission, teacher, active } = (await forRound(context));
      if (!teacher)
        throw new ApiError(403, "FORBIDDEN", "Somente o professor da turma pode reabrir uma avaliação.");
      assertEditableRound(active);
      const previous = (await repository.list(submission)).find((item) => item.evaluatorId === evaluatorId);
      if (!previous)
        throw new ApiError(404, "EVALUATION_NOT_FOUND", "Avaliação não encontrada.");
      assertRevision(previous, input.expectedRevision);
      if (previous.status !== "FINALIZADA")
        throw new ApiError(409, "EVALUATION_NOT_FINALIZED", "Somente avaliações finalizadas podem ser reabertas.");
      return record(submission, previous, context.user.id, "REABERTA", previous.scores, input.reason);
    },
  };
}

export type EvaluationService = ReturnType<typeof createEvaluationService>;
