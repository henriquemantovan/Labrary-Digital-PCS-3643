import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Pool } from "pg";
import { domainDefaults, validateDomain, type Domain } from "./postgresDomainRepositories.js";
import { r2UsageSchema } from "../services/r2Usage.js";

export async function importAcademicData(
  pool: Pool,
  input: Record<Domain, unknown>,
  usage?: unknown,
) {
  const domains = Object.keys(domainDefaults) as Domain[];
  const data = Object.fromEntries(domains.map((domain) => [domain, validateDomain(domain, input[domain])]));
  const sourceHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const r2 = usage === undefined ? undefined : r2UsageSchema.parse(usage);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // A mesma ordem dos bloqueios é utilizada em toda importação.
    const states = await client.query("SELECT domain,payload FROM academic_state ORDER BY domain FOR UPDATE");
    if (states.rows.length !== domains.length) throw new Error("Execute pnpm db:deploy antes da importação.");
    const done = await client.query("SELECT source_hash FROM academic_data_import WHERE source_hash=$1", [sourceHash]);
    if (!done.rows.length) {
      for (const domain of domains) {
        const current = validateDomain(domain, states.rows.find((row) => row.domain === domain)!.payload);
        if (!isDeepStrictEqual(current, validateDomain(domain, domainDefaults[domain])) && !isDeepStrictEqual(current, data[domain]))
          throw new Error(`O domínio ${domain} já contém dados diferentes. A importação não sobrescreve o banco.`);
        await client.query("UPDATE academic_state SET payload=$2::jsonb,updated_at=clock_timestamp() WHERE domain=$1", [domain, JSON.stringify(data[domain])]);
      }
      await client.query("INSERT INTO academic_data_import(source_hash) VALUES($1)", [sourceHash]);
    }
    if (r2) {
      // Nunca restaura uma cota antiga para liberar operações já consumidas.
      await client.query(
        `INSERT INTO r2_usage(scope,month,used_a,used_b) VALUES($1,$2,$3,$4)
         ON CONFLICT(scope) DO UPDATE SET
           month=GREATEST(r2_usage.month,EXCLUDED.month),
           used_a=CASE WHEN EXCLUDED.month>r2_usage.month THEN EXCLUDED.used_a WHEN EXCLUDED.month=r2_usage.month THEN GREATEST(r2_usage.used_a,EXCLUDED.used_a) ELSE r2_usage.used_a END,
           used_b=CASE WHEN EXCLUDED.month>r2_usage.month THEN EXCLUDED.used_b WHEN EXCLUDED.month=r2_usage.month THEN GREATEST(r2_usage.used_b,EXCLUDED.used_b) ELSE r2_usage.used_b END`,
        [r2.scope, r2.month, r2.A, r2.B],
      );
    }
    await client.query("COMMIT");
    return { imported: !done.rows.length, sourceHash };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
