import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { Evaluation, evaluationSchema } from "../models/evaluation.js";
import type { Submission } from "../models/submission.js";

type EvaluationRoundKey = Pick<Submission, "projectId" | "id" | "rubricVersionId">;

const id = z.number().int().positive().safe();
const recordSchema = z.object({
  projectId: id,
  submissionId: id,
  rubricVersionId: id,
  evaluation: evaluationSchema,
}).strict();
type StoredEvaluation = z.infer<typeof recordSchema>;

export const evaluationRecordsSchema = z.array(recordSchema).refine((records) => {
  const keys = records.map(({ projectId, submissionId, evaluation }) =>
    `${projectId}/${submissionId}/${evaluation.evaluatorId}`);
  return new Set(keys).size === keys.length;
}, "Avaliações duplicadas no arquivo.");

export interface EvaluationRepository {
  list(round: EvaluationRoundKey): Evaluation[];
  save(round: EvaluationRoundKey, evaluation: Evaluation): Evaluation;
}

export interface EvaluationStorage {
  load(): StoredEvaluation[];
  save(records: StoredEvaluation[]): void;
}

function load(path: string): StoredEvaluation[] {
  try {
    return evaluationRecordsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** Arquivo privado de um único processo escritor, como os demais snapshots. */
export function createEvaluationRepository(source?: string | EvaluationStorage): EvaluationRepository {
  const path = typeof source === "string" ? source : undefined;
  const storage = typeof source === "object" ? source : undefined;
  let records = storage ? evaluationRecordsSchema.parse(storage.load()) : path ? load(path) : [];
  function belongsToRound(record: StoredEvaluation, round: EvaluationRoundKey) {
    if (record.projectId !== round.projectId || record.submissionId !== round.id)
      return false;
    if (record.rubricVersionId !== round.rubricVersionId)
      throw new Error("Os critérios de avaliação não correspondem à submissão armazenada.");
    return true;
  }

  return {
    list(round) {
      return structuredClone(records
        .filter((record) => belongsToRound(record, round))
        .map(({ evaluation }) => evaluation));
    },
    save(round, evaluation) {
      const record = recordSchema.parse({
        projectId: round.projectId,
        submissionId: round.id,
        rubricVersionId: round.rubricVersionId,
        evaluation,
      });
      const next = records.filter((existing) =>
        !belongsToRound(existing, round) || existing.evaluation.evaluatorId !== evaluation.evaluatorId);
      next.push(record);
      storage?.save(structuredClone(next));
      if (path) {
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        const temporary = `${path}.tmp`;
        writeFileSync(temporary, JSON.stringify(next), { mode: 0o600, flush: true });
        renameSync(temporary, path);
      }
      records = next;
      return structuredClone(record.evaluation);
    },
  };
}
