import { describe, expect, it } from "vitest";
import { evaluationContractSchema } from "./evaluation.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";
import { validateEvaluationScores } from "../services/evaluationValidation.js";

describe("S5: exemplos compartilhados do contrato C2 proposto", () => {
  it("valida exemplos pendente, rascunho, finalizado e reaberto contra C0 e o validador", () => {
    const examples = evaluationContractExamples();
    for (const example of Object.values(examples)) {
      const contract = evaluationContractSchema.parse(example);
      for (const evaluation of contract.evaluations) {
        expect(validateEvaluationScores(contract.rubric, evaluation.scores, evaluation.status === "FINALIZADA"))
          .toEqual(evaluation.scores);
        for (const entry of evaluation.history)
          expect(validateEvaluationScores(contract.rubric, entry.scores, entry.action === "FINALIZADA"))
            .toEqual(entry.scores);
      }
      // Exemplo do consumidor: somente finalizadas contam como recebidas.
      const received = contract.evaluations.filter((evaluation) => evaluation.status === "FINALIZADA").length;
      expect(received).toBe(example === examples.finalized ? 1 : 0);
    }
    expect(examples.reopened.evaluations[0].history[1]).toEqual(examples.finalized.evaluations[0].history[1]);
  });
  it("rejeita referência C0 incompatível, avaliadores repetidos ou não previstos", () => {
    const { finalized } = evaluationContractExamples();
    expect(evaluationContractSchema.safeParse({ ...finalized, rubricVersionId: 2 }).success).toBe(false);
    expect(evaluationContractSchema.safeParse({ ...finalized, projectId: 2 }).success).toBe(false);
    expect(evaluationContractSchema.safeParse({ ...finalized, expectedEvaluatorIds: [2, 2] }).success).toBe(false);
    expect(evaluationContractSchema.safeParse({ ...finalized, expectedEvaluatorIds: [99] }).success).toBe(false);
    expect(evaluationContractSchema.safeParse({ ...finalized, evaluations: [...finalized.evaluations, ...finalized.evaluations] }).success).toBe(false);
  });
  it("diferencia pendência de finalização e exige justificativa no exemplo reaberto", () => {
    const { pending, finalized, reopened } = evaluationContractExamples();
    pending.evaluations[0].scores = finalized.evaluations[0].scores;
    expect(evaluationContractSchema.safeParse(pending).success).toBe(false);
    finalized.evaluations[0].finalizedAt = null;
    expect(evaluationContractSchema.safeParse(finalized).success).toBe(false);
    reopened.evaluations[0].history.at(-1)!.reason = null;
    expect(evaluationContractSchema.safeParse(reopened).success).toBe(false);
  });
});
