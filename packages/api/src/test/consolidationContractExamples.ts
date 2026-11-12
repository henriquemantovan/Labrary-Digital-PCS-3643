import { GradeRow } from "../models/consolidation.js";
import { consolidate } from "../services/consolidation.js";
import { evaluationContractExamples } from "./evaluationContractExamples.js";

/** Exemplos compartilhados C2/C3, exclusivos de testes/documentação. */
export function consolidationContractExamples(): Record<string, GradeRow> {
  const inputs = evaluationContractExamples();
  const row = (result: ReturnType<typeof consolidate>): GradeRow => ({
    ...result, groupId: 1, groupName: "Grupo 01", title: "Controlador de semáforo inteligente",
  });
  const partial = structuredClone(inputs.finalized);
  partial.expectedEvaluatorIds.push(5);
  return {
    noSubmission: row(consolidate(1)),
    pending: row(consolidate(1, inputs.pending)),
    draft: row(consolidate(1, inputs.draft)),
    partial: row(consolidate(1, partial)),
    finalBlocked: row(consolidate(1, inputs.finalized)),
    finalReleased: { ...row(consolidate(1, inputs.finalized)), resultReleased: true },
    reopened: row(consolidate(1, inputs.reopened)),
  };
}
