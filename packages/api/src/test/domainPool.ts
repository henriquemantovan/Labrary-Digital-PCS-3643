import type { Pool } from "pg";
import { vi } from "vitest";
import { domainDefaults, type Domain } from "../repositories/postgresDomainRepositories.js";

export function domainPool() {
  const states = new Map<string, unknown>(Object.entries(structuredClone(domainDefaults)));
  const imports = new Set<string>();
  const usage = new Map<string, unknown[]>();
  let failCommit = false;
  const release = vi.fn();
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql === "COMMIT" && failCommit) throw new Error("Falha ao confirmar");
    if (sql.startsWith("SELECT payload")) return { rows: states.has(String(values[0])) ? [{ payload: structuredClone(states.get(String(values[0]))) }] : [] };
    if (sql.startsWith("SELECT domain")) return { rows: [...states].map(([domain, payload]) => ({ domain, payload: structuredClone(payload) })) };
    if (sql.startsWith("SELECT source_hash")) return { rows: imports.has(String(values[0])) ? [{ source_hash: values[0] }] : [] };
    if (sql.startsWith("UPDATE academic_state")) states.set(String(values[0]), JSON.parse(String(values[1])));
    if (sql.startsWith("INSERT INTO academic_data_import")) imports.add(String(values[0]));
    if (sql.startsWith("INSERT INTO r2_usage")) usage.set(String(values[0]), values);
    return { rows: [] };
  });
  return {
    pool: { connect: async () => ({ query, release }) } as unknown as Pool,
    states, imports, usage, query, release,
    failCommit: () => { failCommit = true; },
    set: (domain: Domain, value: unknown) => states.set(domain, value),
  };
}
