import { describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { createPostgresAdminRepository } from "./postgresAdminRepository.js";
import { assertRoleChange } from "./adminRepository.js";
const actor = {
  id: "4",
  full_name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
  active: true,
};
const target = {
  id: "1",
  full_name: "Aluno",
  email: "aluno@example.com",
  role: "ALUNO",
  active: true,
};
function setup(
  actorRow: unknown = actor,
  targetRow: unknown = target,
  count = 1,
) {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: actorRow ? [actorRow] : [] })
    .mockResolvedValueOnce({ rows: targetRow ? [targetRow] : [] })
    .mockResolvedValueOnce({ rows: [{ count: String(count) }] })
    .mockResolvedValue({ rows: [] });
  const release = vi.fn();
  const pool = {
    connect: vi.fn(async () => ({ query, release })),
    query: vi.fn(async () => ({ rows: [target] })),
  } as unknown as Pool;
  return { repo: createPostgresAdminRepository(pool), query, release, pool };
}
describe("papéis PostgreSQL", () => {
  it("serializa mudanças, audita e limpa visualizações em uma transação", async () => {
    const ctx = setup();
    expect(await ctx.repo.changeRole(4, 1, "ADMIN", 1000)).toEqual({
      id: 1,
      fullName: "Aluno",
      email: "aluno@example.com",
      role: "ADMIN",
      active: true,
    });
    expect(ctx.query.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(ctx.query.mock.calls[7][1]).toEqual([
      4,
      1,
      "ALUNO",
      "ADMIN",
      new Date(1000),
    ]);
    expect(ctx.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(ctx.release).toHaveBeenCalled();
    expect(await ctx.repo.listUsers()).toEqual([
      {
        id: 1,
        fullName: "Aluno",
        email: "aluno@example.com",
        role: "ALUNO",
        active: true,
      },
    ]);
  });
  it("não escreve auditoria quando o papel já é o solicitado", async () => {
    const ctx = setup();
    await ctx.repo.changeRole(4, 1, "ALUNO", 0);
    expect(ctx.query.mock.calls).toHaveLength(6);
  });
  it.each(["actor", "inactive", "missing", "last"] as const)(
    "faz rollback em rejeição %s",
    async (kind) => {
      const ctx = setup(
        kind === "actor"
          ? undefined
          : kind === "inactive"
            ? { ...actor, active: false }
            : actor,
        kind === "missing" ? null : kind === "last" ? actor : target,
      );
      // undefined uses the factory default; explicitly substitute a non-admin for this case.
      if (kind === "actor")
        ctx.query
          .mockReset()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [target] })
          .mockResolvedValueOnce({ rows: [target] })
          .mockResolvedValueOnce({ rows: [{ count: "1" }] })
          .mockResolvedValue({ rows: [] });
      await expect(
        ctx.repo.changeRole(4, kind === "last" ? 4 : 1, "ALUNO", 0),
      ).rejects.toBeTruthy();
      expect(ctx.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
      expect(ctx.release).toHaveBeenCalled();
    },
  );
  it("rejeita ator inexistente e permite retirar papel de administrador inativo", () => {
    expect(() => assertRoleChange(undefined, target, "ADMIN", 1)).toThrow();
    expect(() =>
      assertRoleChange(actor, { ...actor, active: false }, "ALUNO", 0),
    ).not.toThrow();
  });
});
