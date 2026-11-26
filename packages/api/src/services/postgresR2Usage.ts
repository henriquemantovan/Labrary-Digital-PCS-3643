import type { Pool } from "pg";
import { ApiError } from "../errors.js";
import { r2OperationLimits } from "./r2Usage.js";

export function createPostgresR2UsageLimiter(pool: Pool, scope: string, now = Date.now) {
  return {
    async reserve(operation: "A" | "B") {
      const month = new Date(now()).toISOString().slice(0, 7);
      const column = operation === "A" ? "used_a" : "used_b";
      // A coluna vem de uma enumeração interna; valores externos são parâmetros.
      const result = await pool.query(
        `UPDATE r2_usage SET
           used_a=CASE WHEN month<$2 THEN 0 ELSE used_a END + CASE WHEN $3='A' THEN 1 ELSE 0 END,
           used_b=CASE WHEN month<$2 THEN 0 ELSE used_b END + CASE WHEN $3='B' THEN 1 ELSE 0 END,
           month=$2
         WHERE scope=$1 AND month<=$2 AND (month<$2 OR ${column}<$4)
         RETURNING scope`,
        [scope, month, operation, r2OperationLimits[operation]],
      );
      if (result.rows.length) return;
      const previous = await pool.query("SELECT month FROM r2_usage WHERE scope=$1", [scope]);
      if (!previous.rows.length)
        throw new Error("Controle R2 ausente no PostgreSQL. Importe o controle existente ou execute pnpm storage:init para um bucket novo.");
      if (previous.rows[0].month > month) throw new Error("Relógio anterior ao controle de uso R2.");
      throw new ApiError(503, "STORAGE_OPERATION_LIMIT", "O limite mensal de operações dos arquivos foi atingido. Contate o administrador.");
    },
  };
}
