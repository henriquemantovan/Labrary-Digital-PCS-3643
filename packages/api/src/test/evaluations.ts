import { EvaluationRound } from "../models/consolidation.js";
import { evaluationContractExamples } from "./evaluationContractExamples.js";
export const exampleRound = (): EvaluationRound => {
  const round = evaluationContractExamples().finalized;
  round.submissionId = 10;
  round.rubric.criteria[0].weight = 30;
  round.rubric.criteria[1].weight = 70;
  round.expectedEvaluatorIds = [2, 5];
  round.evaluations[0].scores[0].score = 7.123;
  round.evaluations[0].scores[1].score = 8.456;
  round.evaluations.push({ evaluatorId: 5, status: "RASCUNHO", revision: 1,
    scores: [{ criterionId: "funcionamento", score: 0, comment: "" }], finalizedAt: null, history: [] });
  return round;
};

export function finalizeSecond(round: EvaluationRound, first = 9, second = 10) {
  round.evaluations[1] = { evaluatorId: 5, status: "FINALIZADA", revision: 2,
    scores: [{ criterionId: "funcionamento", score: first, comment: "" },
      { criterionId: "documentacao", score: second, comment: "Muito bom" }],
    finalizedAt: "2026-11-12T12:00:00.000Z", history: [] };
}
export function reopenFirst(round: EvaluationRound) {
  const evaluation = round.evaluations[0];
  evaluation.status = "REABERTA"; evaluation.revision++; evaluation.finalizedAt = null;
  evaluation.history.push({ action: "REABERTA", actorId: 3, at: "2026-11-12T12:00:00.000Z",
    reason: "Revisar documentação", revision: evaluation.revision, scores: structuredClone(evaluation.scores) });
}
