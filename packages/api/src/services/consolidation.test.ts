import { describe, expect, it } from "vitest";
import { EvaluationRound, GradeRow } from "../models/consolidation.js";
import { consolidate, displayGrade, evaluationFingerprint, gradesCsv } from "./consolidation.js";

import { exampleRound, finalizeSecond, reopenFirst } from "../test/evaluations.js";

describe("consolidação C3", () => {
  it("pondera sem arredondar e não trata ausente/rascunho como zero", () => {
    const result = consolidate(1, exampleRound());
    expect(result.grade).toBeCloseTo(8.0561, 10);
    expect(result.finalGrade).toBeNull();
    expect(result).toMatchObject({ status: "PARTIAL", expectedEvaluatorIds: [2, 5], receivedEvaluatorIds: [2], pendingEvaluatorIds: [5], allEvaluationsCompleted: false, resultReleased: false });
    expect(displayGrade(result.grade)).toBe("8.06");
  });
  it("calcula média final incluindo nota zero somente de avaliação finalizada", () => {
    const input = exampleRound();
    finalizeSecond(input, 0, 0);
    const result = consolidate(1, input);
    expect(result.finalGrade).toBeCloseTo(4.02805, 10);
    expect(result).toMatchObject({ status: "FINAL", pendingEvaluatorIds: [], allEvaluationsCompleted: true, resultReleased: false });
    expect(result.grade).toBe(result.finalGrade);
  });
  it("distingue sem submissão, todos pendentes e reabertura e rejeita ausência de avaliadores previstos", () => {
    expect(consolidate(1)).toMatchObject({ status: "NO_SUBMISSION", grade: null, round: null });
    const input = exampleRound();
    reopenFirst(input);
    expect(consolidate(1, input)).toMatchObject({ status: "PENDING", grade: null, receivedEvaluatorIds: [], pendingEvaluatorIds: [2, 5] });
    input.expectedEvaluatorIds = [];
    input.evaluations = [];
    expect(() => consolidate(1, input)).toThrow();
    expect(displayGrade(null)).toBe("—");
  });
  it("inclui somente critérios previstos e exige entrada válida do adapter", () => {
    expect(() => consolidate(2, exampleRound())).toThrow("outro projeto");
    expect(evaluationFingerprint(exampleRound())).toMatch(/^[a-f0-9]{64}$/);
    const next = exampleRound(); next.evaluations[0].revision++;
    expect(evaluationFingerprint(next)).not.toBe(evaluationFingerprint(exampleRound()));
  });
  it.each([
    (r: EvaluationRound) => { r.rubric.criteria[0].weight = 0; },
    (r: EvaluationRound) => { r.rubric.criteria[0].weight = 20; },
    (r: EvaluationRound) => { r.expectedEvaluatorIds.push(2); },
    (r: EvaluationRound) => { r.rubric.criteria[1].id = "funcionamento"; },
    (r: EvaluationRound) => { r.evaluations.push(r.evaluations[0]); },
    (r: EvaluationRound) => { r.evaluations[0].evaluatorId = 99; },
    (r: EvaluationRound) => { r.evaluations[0].scores.pop(); },
    (r: EvaluationRound) => { r.evaluations[0].scores[0].criterionId = "inexistente"; },
    (r: EvaluationRound) => { r.evaluations[0].scores[1].criterionId = "funcionamento"; },
    (r: EvaluationRound) => { r.evaluations[0].scores[0].score = -1; },
    (r: EvaluationRound) => { r.evaluations[0].scores[0].score = 10.01; },
    (r: EvaluationRound) => { r.evaluations[0].scores[0].score = NaN; },
    (r: EvaluationRound) => { r.rubric.criteria[0].weight = Infinity; },
  ])("rejeita rubrica, IDs, notas e finalização inconsistentes", mutate => {
    const input = exampleRound(); mutate(input);
    expect(() => consolidate(1, input)).toThrow();
  });
  it("CSV reflete a tabela, escapa aspas/quebras e neutraliza fórmulas", () => {
    const row: GradeRow = { ...consolidate(1, exampleRound()), groupId: 1, groupName: '=SOMA(1,2)', title: 'Circuito, "A"\nLinha' };
    const csv = gradesCsv([row, { ...row, groupName: "\t@comando", title: "Título", grade: null, round: null, status: "PENDING", resultReleased: true }]);
    expect(csv).toContain('"\'=SOMA(1,2)","Circuito, ""A""\nLinha","1","2","1","1","8.06","Parcial","Não"');
    expect(csv).toContain('"\'\t@comando","Título","—","2","1","1","—","Pendente","Sim"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(gradesCsv([]).split("\r\n")).toHaveLength(2);
  });
});
