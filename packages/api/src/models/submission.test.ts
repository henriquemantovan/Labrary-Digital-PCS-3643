import { describe, expect, it } from "vitest";
import { submissionSchema } from "./submission.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";
import { submissionContractExamples } from "../test/submissionContractExamples.js";

describe("S5: contrato C1 de submissão", () => {
  it("valida exemplos submetido, devolvido e reenviado em nova rodada", () => {
    const { submitted, returned, resubmitted } = submissionContractExamples();
    for (const example of [submitted, returned, resubmitted]) submissionSchema.parse(example);
    expect([submitted.round, resubmitted.round]).toEqual([1, 2]);
    expect(resubmitted.materials.find((item) => item.kind === "MANUAL")?.versionNumber).toBe(2);
    expect(returned.materials).toEqual(submitted.materials);
  });
  it("usa a mesma submissão, rodada e rubrica dos exemplos C2", () => {
    const { submitted } = submissionContractExamples();
    const { pending } = evaluationContractExamples();
    expect([submitted.projectId, submitted.id, submitted.round, submitted.rubricVersionId])
      .toEqual([pending.projectId, pending.submissionId, pending.round, pending.rubricVersionId]);
    expect(submitted.rubric).toEqual(pending.rubric);
  });
  it("rejeita rubrica incompatível, devolução inconsistente e materiais repetidos ou ausentes", () => {
    const { submitted } = submissionContractExamples();
    const invalid = (change: object) => submissionSchema.safeParse({ ...submitted, ...change }).success;
    expect(invalid({ rubricVersionId: 2 })).toBe(false);
    expect(invalid({ projectId: 2 })).toBe(false);
    expect(invalid({ status: "DEVOLVIDA" })).toBe(false);
    expect(invalid({ returnedAt: "2026-11-21T12:00:00.000Z" })).toBe(false);
    expect(invalid({ materials: [...submitted.materials, submitted.materials[0]] })).toBe(false);
    expect(invalid({ materials: submitted.materials.slice(1) })).toBe(false);
    expect(invalid({ storageKey: "x" })).toBe(false);
  });
});
