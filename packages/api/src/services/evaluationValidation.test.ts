import { describe, expect, it } from "vitest";
import { validateEvaluationScores } from "./evaluationValidation.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";

describe("S5: validador isolado de notas e completude", () => {
  it("aceita rascunho parcial, escala inclusiva 0–10 e comentário normalizado", () => {
    const { rubric } = evaluationContractExamples().pending;
    expect(validateEvaluationScores(rubric, [], false)).toEqual([]);
    expect(validateEvaluationScores(rubric, [{ criterionId: "funcionamento", score: 0 }], false))
      .toEqual([{ criterionId: "funcionamento", score: 0, comment: "" }]);
    const complete = [{ criterionId: "funcionamento", score: 0, comment: "  Revisar  " },
      { criterionId: "documentacao", score: 10 }];
    expect(validateEvaluationScores(rubric, complete, true).map((item) => item.score)).toEqual([0, 10]);
    expect(validateEvaluationScores(rubric, complete, true)[0].comment).toBe("Revisar");
  });
  it.each([-1, 10.01, NaN, Infinity, "8", null])("rejeita nota inválida %s", (score) => {
    const { rubric } = evaluationContractExamples().pending;
    expect(() => validateEvaluationScores(rubric, [{ criterionId: "funcionamento", score }], false)).toThrow();
  });
  it("rejeita critério desconhecido, repetido e finalização incompleta", () => {
    const { rubric } = evaluationContractExamples().pending;
    const grade = { criterionId: "funcionamento", score: 8 };
    expect(() => validateEvaluationScores(rubric, [grade, grade], false)).toThrow();
    expect(() => validateEvaluationScores(rubric, [{ ...grade, criterionId: "outro" }], false))
      .toThrow("rubrica");
    expect(() => validateEvaluationScores(rubric, [grade], true)).toThrow("todos os critérios");
    expect(() => validateEvaluationScores(rubric, [], true)).toThrow("todos os critérios");
  });
  it("usa a versão fornecida sem alterar rubrica ou notas de entrada", () => {
    const original = evaluationContractExamples().finalized;
    const later = structuredClone(original.rubric);
    later.id = 2; later.versionNumber = 2;
    later.criteria[0].id = "novo-criterio";
    const before = structuredClone(original);
    expect(validateEvaluationScores(original.rubric, original.evaluations[0].scores, true)).toHaveLength(2);
    expect(() => validateEvaluationScores(later, original.evaluations[0].scores, true)).toThrow("rubrica");
    expect(original).toEqual(before);
  });
});
