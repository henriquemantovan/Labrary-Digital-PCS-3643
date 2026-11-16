import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { createPostgresGroupRepository } from "./postgresGroupRepository.js";
function setup(
  options: {
    before?: number[];
    people?: number[];
    scope?: boolean;
    group?: boolean;
    failure?: unknown;
  } = {},
) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT c.id"))
      return { rows: options.scope === false ? [] : [{ id: 1 }] };
    if (sql.startsWith("INSERT INTO student_group")) {
      if (options.failure) throw options.failure;
      return { rows: [{ id: 5, classId: 1, name: "Novo" }] };
    }
    if (sql.startsWith("SELECT id FROM app_user"))
      return { rows: (options.people ?? [1]).map((id) => ({ id })) };
    if (sql.startsWith("SELECT id FROM student_group"))
      return { rows: options.group === false ? [] : [{ id: 2 }] };
    if (
      sql.startsWith("SELECT user_id") ||
      sql.startsWith("SELECT evaluator_id")
    )
      return { rows: (options.before ?? []).map((id) => ({ id })) };
    return { rows: [] };
  });
  const release = vi.fn();
  const client = { query, release };
  const poolQuery = vi
    .fn()
    .mockResolvedValue({
      rows: [
        {
          target: "GROUP",
          targetId: 2,
          before: ["1"],
          after: [],
          changedBy: 3,
          changedAt: new Date("2026-11-07T12:00:00Z"),
        },
      ],
    });
  const repo = createPostgresGroupRepository({
    connect: async () => client,
    query: poolQuery,
  } as unknown as Pool);
  return { repo, query, release };
}
const change = {
  target: "GROUP" as const,
  targetId: 2,
  after: [1],
  changedBy: 3,
  changedAt: "2026-11-07T12:00:00Z",
};
describe("adapter PostgreSQL de vínculos", () => {
  it("cria grupo e confirma transação liberando a conexão", async () => {
    const { repo, query, release } = setup();
    expect(await repo.createGroup(1, "Novo", 3)).toEqual({
      id: 5,
      classId: 1,
      name: "Novo",
      memberIds: [],
    });
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
  it("atualiza integrantes sem excluir histórico de participação e registra antes/depois", async () => {
    const { repo, query } = setup({ before: [2] });
    await repo.setLinks(1, change);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("UPDATE group_membership SET left_at"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO group_membership"),
      ),
    ).toBe(true);
    const audit = query.mock.calls.find(([sql]) =>
      sql.startsWith("INSERT INTO academic_link_audit"),
    );
    expect(audit).toBeTruthy();
    expect(await repo.history("GROUP", 2)).toEqual([
      {
        target: "GROUP",
        targetId: 2,
        before: [1],
        after: [],
        changedBy: 3,
        changedAt: "2026-11-07T12:00:00.000Z",
      },
    ]);
  });
  it("substitui atribuições de avaliadores e registra remoção", async () => {
    const { repo, query } = setup({ people: [2], before: [3] });
    await repo.setLinks(1, { ...change, target: "PROJECT", after: [2] });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO project_evaluator"),
      ),
    ).toBe(true);
    const empty = setup({ people: [], before: [2] });
    await empty.repo.setLinks(1, { ...change, target: "PROJECT", after: [] });
    expect(
      empty.query.mock.calls.some(([sql]) =>
        sql.startsWith("DELETE FROM project_evaluator"),
      ),
    ).toBe(true);
  });
  it("não acrescenta histórico quando os vínculos são iguais", async () => {
    const { repo, query } = setup({ before: [1] });
    await repo.setLinks(1, change);
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("revalida turma, contas e grupo e desfaz falhas sem confirmar", async () => {
    for (const [options, code] of [
      [{ scope: false }, "CLASS_NOT_FOUND"],
      [{ people: [] }, "INVALID_LINK"],
      [{ group: false }, "GROUP_NOT_FOUND"],
    ] as const) {
      const { repo, query, release } = setup(options);
      await expect(repo.setLinks(1, change)).rejects.toMatchObject({ code });
      expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
      expect(release).toHaveBeenCalledOnce();
    }
    for (const [failure, expected] of [
      [{ code: "23505" }, { code: "GROUP_EXISTS" }],
      [new Error("Banco indisponível"), { message: "Banco indisponível" }],
    ]) {
      const { repo, query, release } = setup({ failure });
      await expect(repo.createGroup(1, "Novo", 3)).rejects.toMatchObject(
        expected,
      );
      expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
      expect(release).toHaveBeenCalledOnce();
    }
  });
});
