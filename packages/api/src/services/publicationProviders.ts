import { z } from "zod";
import { Submission } from "../models/submission.js";
const id = z.number().int().positive().safe();
const ids = z.array(id).refine((items) => new Set(items).size === items.length);
/** Projeção mínima que o adapter C3 deve obter da consolidação real. */
export const publicationCompletenessSchema = z
  .object({
    projectId: id,
    submissionId: id,
    round: id,
    rubricVersionId: id,
    expectedEvaluatorIds: ids,
    completedEvaluatorIds: ids,
    allEvaluationsCompleted: z.boolean(),
    resultReleased: z.boolean(),
  })
  .strict();
export type PublicationCompleteness = z.infer<
  typeof publicationCompletenessSchema
>;
export interface PublicationProviders {
  submissions: { latest(projectId: number): Promise<Submission | undefined> };
  evaluations: {
    completeness(
      projectId: number,
      submissionId: number,
    ): Promise<PublicationCompleteness | undefined>;
  };
}
// Ausência de adapter real não autoriza usar fixtures no servidor.
