import type { EvaluationContract } from "./evaluation.js";
import { z } from "zod";
export type EvaluationRound = EvaluationContract;

export interface EvaluationProvider {
  /** Snapshot coerente da rodada atual; undefined significa que não houve submissão. */
  getCurrentRound(projectId: number): Promise<EvaluationRound | undefined>;
}

const id = z.number().int().positive().safe();
export const consolidatedResultSchema = z.object({
  projectId: id, submissionId: id.nullable(), round: id.nullable(), rubricVersionId: id.nullable(),
  expectedEvaluatorIds: z.array(id), receivedEvaluatorIds: z.array(id), pendingEvaluatorIds: z.array(id),
  evaluatorGrades: z.array(z.object({ evaluatorId: id, grade: z.number() }).strict()),
  grade: z.number().nullable(), finalGrade: z.number().nullable(),
  status: z.enum(["NO_SUBMISSION", "PENDING", "PARTIAL", "FINAL"]),
  allEvaluationsCompleted: z.boolean(), resultReleased: z.boolean(),
}).strict();
export const gradeRowSchema = consolidatedResultSchema.extend({ groupId: id, groupName: z.string(), title: z.string() });
export type ConsolidatedResult = z.infer<typeof consolidatedResultSchema>;
export type GradeRow = z.infer<typeof gradeRowSchema>;
export type GroupResult = { projectId: number; resultReleased: false } | (ConsolidatedResult & {
  resultReleased: true;
  rubric: EvaluationContract["rubric"];
  evaluations: Pick<EvaluationContract["evaluations"][number], "evaluatorId" | "scores">[];
});
