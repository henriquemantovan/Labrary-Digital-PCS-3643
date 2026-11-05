import { createHash } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import {
  createPostgresAuthRepository,
  createPostgresOAuthAttempts,
} from "./postgresAuthRepository.js";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
describe("sessões PostgreSQL", () => {
  it("armazena só o hash e consulta/revoga a sessão persistida", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = createPostgresAuthRepository({ query } as unknown as Pool);
    const token = await repo.createSession(10, 1000, 3000);
    expect(query.mock.calls[1][1]).toEqual([hash(token), 10, new Date(4000)]);
    expect(JSON.stringify(query.mock.calls)).not.toContain(token);
    query.mockResolvedValueOnce({
      rows: [{ user_id: "10", expires_at: new Date(4000) }],
    });
    expect(await repo.getSession(token, 1000)).toEqual({
      userId: 10,
      expiresAt: 4000,
    });
    expect(await repo.getSession(token, 5000)).toBeUndefined();
    expect(await repo.getSession("", 0)).toBeUndefined();
    await repo.deleteSession(token);
    expect(query.mock.calls.at(-1)?.[1]).toEqual([hash(token)]);
    const count = query.mock.calls.length;
    await repo.deleteSession("");
    expect(query.mock.calls).toHaveLength(count);
  });
  it("recarrega o diretório usado pelas permissões", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            full_name: "Maria",
            email: "maria@gmail.com",
            password_hash: null,
            role: "ALUNO",
            active: true,
            google_subject: "123",
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    const repo = createPostgresAuthRepository({ query } as unknown as Pool);
    await repo.refresh!();
    expect(repo.findById(1)?.googleLinked).toBe(true);
    expect(repo.findByEmail("maria@gmail.com")?.id).toBe(1);
  });
  it("persiste estado por hash e consome uma única vez com expiração", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = createPostgresOAuthAttempts({ query } as unknown as Pool);
    await repo.save("state", { nonce: "n", verifier: "v", expiresAt: 2000 }, 0);
    expect(query.mock.calls[1][1]).toEqual([
      hash("state"),
      "n",
      "v",
      new Date(2000),
    ]);
    query.mockResolvedValueOnce({
      rows: [{ nonce: "n", code_verifier: "v", expires_at: new Date(2000) }],
    });
    expect(await repo.consume("state", 1000)).toEqual({
      nonce: "n",
      verifier: "v",
      expiresAt: 2000,
    });
    query.mockResolvedValueOnce({
      rows: [{ nonce: "n", code_verifier: "v", expires_at: new Date(2000) }],
    });
    expect(await repo.consume("state", 3000)).toBeUndefined();
    expect(await repo.consume("missing", 1000)).toBeUndefined();
  });
});

it("salva a visualização por sessão e retorna se a atualização foi aceita", async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ token_hash: "hash" }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [{ user_id: "1", expires_at: new Date(5000), view_role: "ALUNO" }],
    });
  const repo = createPostgresAuthRepository({ query } as unknown as Pool);
  expect(await repo.setViewRole("token", "ALUNO", 1000)).toBe(true);
  expect(query.mock.calls[0][1]).toEqual([
    "ALUNO",
    hash("token"),
    new Date(1000),
  ]);
  expect(await repo.setViewRole("token", null, 6000)).toBe(false);
  expect(await repo.getSession("token", 1000)).toMatchObject({
    viewRole: "ALUNO",
  });
});
