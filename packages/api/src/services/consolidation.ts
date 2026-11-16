import { createHash } from "node:crypto";
import { ConsolidatedResult, EvaluationRound, GradeRow } from "../models/consolidation.js";

import { evaluationContractSchema } from "../models/evaluation.js";
import { validateEvaluationScores } from "./evaluationValidation.js";

export function consolidate(projectId: number, input?: EvaluationRound): ConsolidatedResult {
  const round = input && evaluationContractSchema.parse(input);
  if (round && round.projectId !== projectId) throw new Error("Rodada de outro projeto.");
  if (round) for (const evaluation of round.evaluations)
    validateEvaluationScores(round.rubric, evaluation.scores, evaluation.status === "FINALIZADA");
  const evaluatorGrades = round?.evaluations.filter(e => e.status === "FINALIZADA").map(e => ({
    evaluatorId: e.evaluatorId,
    grade: round.rubric.criteria.reduce((sum, criterion) =>
      sum + e.scores.find(s => s.criterionId === criterion.id)!.score * criterion.weight / 100, 0),
  })) ?? [];
  const expectedEvaluatorIds = round?.expectedEvaluatorIds ?? [];
  const receivedEvaluatorIds = evaluatorGrades.map(e => e.evaluatorId);
  const pendingEvaluatorIds = expectedEvaluatorIds.filter(id => !receivedEvaluatorIds.includes(id));
  // Sem avaliadores previstos não há completude por vacuidade.
  const allEvaluationsCompleted = expectedEvaluatorIds.length > 0 && pendingEvaluatorIds.length === 0;
  const grade = evaluatorGrades.length ? evaluatorGrades.reduce((sum, e) => sum + e.grade, 0) / evaluatorGrades.length : null;
  return {
    projectId, submissionId: round?.submissionId ?? null, round: round?.round ?? null,
    rubricVersionId: round?.rubricVersionId ?? null,
    expectedEvaluatorIds, receivedEvaluatorIds, pendingEvaluatorIds, evaluatorGrades,
    grade, finalGrade: allEvaluationsCompleted ? grade : null,
    status: !round ? "NO_SUBMISSION" : allEvaluationsCompleted ? "FINAL" : grade === null ? "PENDING" : "PARTIAL",
    allEvaluationsCompleted, resultReleased: false,
  };
}

// A decisão vale somente para o conteúdo exato recebido do produtor C2.
export const evaluationFingerprint = (round: EvaluationRound) =>
  createHash("sha256").update(JSON.stringify(evaluationContractSchema.parse(round))).digest("hex");

export const displayGrade = (grade: number | null) => grade === null ? "—" : grade.toFixed(2);

export function gradesCsv(rows: GradeRow[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    // Campos de usuário não podem virar fórmulas ao abrir a planilha.
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const statusLabels = { NO_SUBMISSION: "Sem submissão", PENDING: "Pendente", PARTIAL: "Parcial", FINAL: "Final" };
  return "\uFEFF" + [
    ["Grupo", "Projeto", "Rodada", "Previstos", "Recebidos", "Pendentes", "Nota", "Situação", "Resultado liberado"],
    ...rows.map(row => [row.groupName, row.title, row.round ?? "—", row.expectedEvaluatorIds.length,
      row.receivedEvaluatorIds.length, row.pendingEvaluatorIds.length, displayGrade(row.grade),
      statusLabels[row.status], row.resultReleased ? "Sim" : "Não"]),
  ].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
