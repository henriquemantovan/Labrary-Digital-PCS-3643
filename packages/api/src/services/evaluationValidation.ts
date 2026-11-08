import { ApiError } from "../errors.js";
import { CriterionScore, scoresSchema } from "../models/evaluation.js";
import { RubricVersion } from "../models/rubric.js";

/** Shared C2 rule: partial drafts are allowed, finalized records are complete. */
export function validateEvaluationScores(
  rubric: RubricVersion,
  input: unknown,
  finalizing: boolean,
): CriterionScore[] {
  const scores = scoresSchema.parse(input);
  const criteria = rubric.criteria;
  if (scores.some((score) => !criteria.some((criterion) => criterion.id === score.criterionId)))
    throw new ApiError(400, "UNKNOWN_CRITERION", "A nota deve pertencer à rubrica da submissão.");
  if (finalizing && scores.length !== criteria.length)
    throw new ApiError(400, "INCOMPLETE_EVALUATION", "Preencha todos os critérios antes de finalizar.");
  return scores;
}
