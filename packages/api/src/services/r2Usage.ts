import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../errors.js";

// Margem abaixo da franquia da conta: não representa um limite de cobrança
// da Cloudflare e não contabiliza acessos feitos fora desta API.
export const r2OperationLimits = { A: 100_000, B: 1_000_000 } as const;
export const r2UsageSchema = z
  .object({
    version: z.literal(1),
    scope: z.string().min(1),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    A: z.number().int().nonnegative().safe(),
    B: z.number().int().nonnegative().safe(),
  })
  .strict();
const monthOf = (now: number) => new Date(now).toISOString().slice(0, 7);

/** Apenas para uma configuração nova, sem operações anteriores neste mês. */
export function initializeR2Usage(
  path: string,
  scope: string,
  now = Date.now(),
) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(
    path,
    JSON.stringify({ version: 1, scope, month: monthOf(now), A: 0, B: 0 }),
    {
      flag: "wx",
      mode: 0o600,
      flush: true,
    },
  );
}

/** Um processo escritor. Reserva no disco antes de fazer a chamada remota. */
export function createR2UsageLimiter(
  path: string,
  scope: string,
  now = Date.now,
) {
  let state = r2UsageSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (state.scope !== scope)
    throw new Error("O controle de uso R2 pertence a outra conta ou bucket.");
  return {
    reserve(operation: "A" | "B") {
      const month = monthOf(now());
      if (month < state.month)
        throw new Error("Relógio anterior ao controle de uso R2.");
      const next =
        month === state.month ? { ...state } : { ...state, month, A: 0, B: 0 };
      if (next[operation] >= r2OperationLimits[operation])
        throw new ApiError(
          503,
          "STORAGE_OPERATION_LIMIT",
          "O limite mensal de operações dos arquivos foi atingido. Contate o administrador.",
        );
      next[operation]++;
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, JSON.stringify(next), {
          flag: "wx",
          mode: 0o600,
          flush: true,
        });
        renameSync(temporary, path);
      } catch (error) {
        try {
          unlinkSync(temporary);
        } catch {
          /* Nenhuma chamada remota foi feita. */
        }
        throw error;
      }
      state = next;
    },
  };
}
