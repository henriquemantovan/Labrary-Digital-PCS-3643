import type { EvaluationProvider } from "../models/consolidation.js";
import type { ResultReleaseRepository } from "../repositories/resultReleaseRepository.js";
import { consolidate, evaluationFingerprint } from "./consolidation.js";
import type { PublicationProviders } from "./publicationProviders.js";

/** Projeta o C3 real para a HU11 sem transportar notas ou comentários. */
export function createPublicationEvaluationProvider(
  evaluations: EvaluationProvider,
  releases: ResultReleaseRepository,
): PublicationProviders["evaluations"] {
  return {
    async completeness(projectId, submissionId) {
      const round = await evaluations.getCurrentRound(projectId);
      if (!round || round.submissionId !== submissionId) return undefined;
      const result = consolidate(projectId, round);
      return {
        projectId: result.projectId,
        submissionId: round.submissionId,
        round: round.round,
        rubricVersionId: round.rubricVersionId,
        expectedEvaluatorIds: result.expectedEvaluatorIds,
        completedEvaluatorIds: result.receivedEvaluatorIds,
        allEvaluationsCompleted: result.allEvaluationsCompleted,
        resultReleased:
          result.allEvaluationsCompleted &&
          !!releases.find(projectId, evaluationFingerprint(round)),
      };
    },
  };
}
