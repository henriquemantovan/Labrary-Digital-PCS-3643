import { describe, expect, it } from "vitest";
import { createResultReleaseRepository } from "../repositories/resultReleaseRepository.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";
import { evaluationFingerprint } from "./consolidation.js";
import { createPublicationEvaluationProvider } from "./publicationEvaluationProvider.js";

describe("adapter C3 da publicação", () => {
  it("distingue ausência de rodada, rodada diferente e erro do produtor", async () => {
    const releases = createResultReleaseRepository();
    const absent = createPublicationEvaluationProvider(
      { getCurrentRound: async () => undefined },
      releases,
    );
    expect(await absent.completeness(1, 11)).toBeUndefined();
    const other = createPublicationEvaluationProvider(
      { getCurrentRound: async () => evaluationContractExamples().finalized },
      releases,
    );
    expect(await other.completeness(1, 12)).toBeUndefined();
    const failure = new Error("Armazenamento indisponível");
    const broken = createPublicationEvaluationProvider(
      {
        getCurrentRound: async () => {
          throw failure;
        },
      },
      releases,
    );
    await expect(broken.completeness(1, 11)).rejects.toBe(failure);
    await expect(other.completeness(2, 11)).rejects.toThrow(
      "Rodada de outro projeto",
    );
  });

  it("usa as regras da consolidação, omite notas e separa completude de liberação", async () => {
    const releases = createResultReleaseRepository();
    let round = evaluationContractExamples().pending;
    const provider = createPublicationEvaluationProvider(
      { getCurrentRound: async () => structuredClone(round) },
      releases,
    );
    expect(await provider.completeness(1, 11)).toEqual({
      projectId: 1,
      submissionId: 11,
      round: 1,
      rubricVersionId: 1,
      expectedEvaluatorIds: [2],
      completedEvaluatorIds: [],
      allEvaluationsCompleted: false,
      resultReleased: false,
    });
    round = evaluationContractExamples().finalized;
    expect(await provider.completeness(1, 11)).toEqual({
      projectId: 1,
      submissionId: 11,
      round: 1,
      rubricVersionId: 1,
      expectedEvaluatorIds: [2],
      completedEvaluatorIds: [2],
      allEvaluationsCompleted: true,
      resultReleased: false,
    });
    releases.release({
      projectId: 1,
      submissionId: 11,
      round: 1,
      fingerprint: evaluationFingerprint(round),
      releasedBy: 3,
      releasedAt: "2026-11-22T12:00:00.000Z",
    });
    expect((await provider.completeness(1, 11))?.resultReleased).toBe(true);
    round = evaluationContractExamples().reopened;
    expect(await provider.completeness(1, 11)).toMatchObject({
      completedEvaluatorIds: [],
      allEvaluationsCompleted: false,
      resultReleased: false,
    });
    round = evaluationContractExamples().finalized;
    round.evaluations[0].scores.pop();
    await expect(provider.completeness(1, 11)).rejects.toThrow(
      "Preencha todos os critérios",
    );
  });
});
