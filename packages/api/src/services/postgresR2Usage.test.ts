import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createPostgresR2UsageLimiter } from "./postgresR2Usage.js";

describe("reserva das operações R2 no PostgreSQL", () => {
  it("aguarda a reserva de cada classe no banco", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ scope: "a/b" }] });
    const limiter = createPostgresR2UsageLimiter({ query } as unknown as Pool, "a/b", () => Date.UTC(2026, 10, 26));
    await limiter.reserve("A");
    await limiter.reserve("B");
    expect(query.mock.calls[0][1]).toEqual(["a/b", "2026-11", "A", 100_000]);
    expect(query.mock.calls[1][1]).toEqual(["a/b", "2026-11", "B", 1_000_000]);
  });
  it.each([
    [[], "Controle R2 ausente"],
    [[{ month: "2026-12" }], "Relógio anterior"],
    [[{ month: "2026-11" }], "limite mensal"],
  ])("recusa falta de controle, relógio retrocedido e cota esgotada: %j", async (rows, message) => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows });
    const limiter = createPostgresR2UsageLimiter({ query } as unknown as Pool, "a/b", () => Date.UTC(2026, 10, 26));
    await expect(limiter.reserve("A")).rejects.toThrow(String(message));
  });
  it("propaga falha de banco antes de autorizar uma operação remota", async () => {
    const query = vi.fn().mockRejectedValue(new Error("Banco indisponível"));
    await expect(createPostgresR2UsageLimiter({ query } as unknown as Pool, "a/b").reserve("B")).rejects.toThrow("Banco indisponível");
  });
});
