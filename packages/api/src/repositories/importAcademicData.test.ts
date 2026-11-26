import { describe, expect, it } from "vitest";
import { importAcademicData } from "./importAcademicData.js";
import { domainDefaults } from "./postgresDomainRepositories.js";
import { domainPool } from "../test/domainPool.js";

describe("importação acadêmica sem sobrescrever dados", () => {
  it("importa os quatro domínios e o consumo R2, com repetição idempotente", async () => {
    const c = domainPool();
    const usage = { version: 1, scope: "conta/bucket", month: "2026-11", A: 12, B: 31 };
    const first = await importAcademicData(c.pool, structuredClone(domainDefaults), usage);
    expect(first.imported).toBe(true);
    expect(c.usage.get(usage.scope)).toEqual([usage.scope, usage.month, 12, 31]);
    expect((await importAcademicData(c.pool, structuredClone(domainDefaults))).imported).toBe(false);
    expect(c.imports.size).toBe(1);
  });
  it("recusa banco com estado diferente ou migrations incompletas", async () => {
    const c = domainPool();
    c.set("results", [{ projectId: 1, submissionId: 1, round: 1, fingerprint: "a".repeat(64), releasedBy: 3, releasedAt: "2026-11-26T12:00:00.000Z" }]);
    await expect(importAcademicData(c.pool, structuredClone(domainDefaults))).rejects.toThrow("não sobrescreve");
    expect(c.imports.size).toBe(0);
    c.states.delete("projects");
    await expect(importAcademicData(c.pool, structuredClone(domainDefaults))).rejects.toThrow("db:deploy");
    expect(c.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
  it("valida dados corrompidos e contadores negativos antes de abrir transação", async () => {
    const c = domainPool();
    await expect(importAcademicData(c.pool, { ...domainDefaults, evaluations: [{}] })).rejects.toThrow();
    await expect(importAcademicData(c.pool, structuredClone(domainDefaults), { version: 1, scope: "a/b", month: "2026-11", A: -1, B: 0 })).rejects.toThrow();
    expect(c.query).not.toHaveBeenCalled();
  });
});
