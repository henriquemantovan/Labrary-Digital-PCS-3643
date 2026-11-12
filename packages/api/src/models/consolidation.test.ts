import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { consolidatedResultSchema, gradeRowSchema } from "./consolidation.js";
import { consolidationContractExamples } from "../test/consolidationContractExamples.js";
const examples = JSON.parse(readFileSync(new URL("../../../../docs/contratos/c3-exemplos.json", import.meta.url), "utf8"));
it("C3 valida os mesmos exemplos compartilhados com Dan e Henrique, gerados a partir de C2", () => {
  expect(examples).toEqual(consolidationContractExamples());
  for (const example of Object.values(examples)) expect(gradeRowSchema.parse(example)).toEqual(example);
  expect(examples.finalBlocked).toMatchObject({ grade: 8.4, finalGrade: 8.4, allEvaluationsCompleted: true, resultReleased: false });
  expect(examples.finalReleased).toMatchObject({ allEvaluationsCompleted: true, resultReleased: true });
  expect(examples.partial).toMatchObject({ finalGrade: null, status: "PARTIAL", pendingEvaluatorIds: [5] });
  expect(examples.reopened).toMatchObject({ grade: null, allEvaluationsCompleted: false, resultReleased: false });
});
it("C3 rejeita campos extras para não anexar armazenamento ou dados de sessão ao DTO", () => {
  expect(gradeRowSchema.safeParse({ ...examples.pending, storageKey: "privado" }).success).toBe(false);
  expect(consolidatedResultSchema.safeParse(examples.pending).success).toBe(false);
});
