import { EvaluationContract } from "../models/evaluation.js";
import { defaultRequirements } from "../models/rubric.js";

/** Shared S5 contract examples only; no submission or grading implementation. */
export function evaluationContractExamples(): Record<"pending" | "draft" | "finalized" | "reopened", EvaluationContract> {
  const pending: EvaluationContract = {
    projectId: 1, submissionId: 11, round: 1, rubricVersionId: 1,
    expectedEvaluatorIds: [2],
    rubric: {
      id: 1, projectId: 1, classId: 1, versionNumber: 1,
      title: "Rubrica do projeto", createdBy: 3, createdAt: "2026-11-05T12:00:00.000Z",
      requirements: defaultRequirements("2026-11-25T23:59:00.000Z"),
      criteria: [
        { id: "funcionamento", title: "Funcionamento", description: "Atendimento aos requisitos", weight: 60, minScore: 0, maxScore: 10 },
        { id: "documentacao", title: "Documentação", description: "Clareza da documentação", weight: 40, minScore: 0, maxScore: 10 },
      ],
    },
    evaluations: [{ evaluatorId: 2, status: "PENDENTE", revision: 0, scores: [], finalizedAt: null, history: [] }],
  };
  const draft = structuredClone(pending);
  draft.evaluations[0] = {
    evaluatorId: 2, status: "RASCUNHO", revision: 1,
    scores: [{ criterionId: "funcionamento", score: 8, comment: "Atende aos requisitos." }],
    finalizedAt: null,
    history: [{ action: "RASCUNHO", actorId: 2, at: "2026-11-06T12:00:00.000Z", reason: null, revision: 1,
      scores: [{ criterionId: "funcionamento", score: 8, comment: "Atende aos requisitos." }] }],
  };
  const finalized = structuredClone(draft);
  const evaluation = finalized.evaluations[0];
  evaluation.status = "FINALIZADA";
  evaluation.revision = 2;
  evaluation.finalizedAt = "2026-11-06T13:00:00.000Z";
  evaluation.scores.push({ criterionId: "documentacao", score: 9, comment: "" });
  evaluation.history.push({ action: "FINALIZADA", actorId: 2, at: evaluation.finalizedAt, reason: null,
    revision: 2, scores: structuredClone(evaluation.scores) });
  const reopened = structuredClone(finalized);
  reopened.evaluations[0].status = "REABERTA";
  reopened.evaluations[0].revision = 3;
  reopened.evaluations[0].finalizedAt = null;
  reopened.evaluations[0].history.push({ action: "REABERTA", actorId: 3,
    at: "2026-11-07T12:00:00.000Z", reason: "Rever documentação.", revision: 3,
    scores: structuredClone(evaluation.scores) });
  return { pending, draft, finalized, reopened };
}
