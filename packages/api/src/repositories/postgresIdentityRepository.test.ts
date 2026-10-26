import { describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { createPostgresIdentityRepository } from "./postgresIdentityRepository.js";
import { UspProfile } from "../services/uspOAuth.js";
import { Directory } from "../models/auth.js";
const profile: UspProfile = {
  loginUsuario: "123",
  nomeUsuario: "Maria",
  emailUspUsuario: "maria@usp.br",
  vinculo: [{ tipoVinculo: "ALUNOGR" }],
};
const row = {
  id: "1",
  full_name: "Maria",
  email: "maria@usp.br",
  password_hash: null,
  role: "ALUNO",
  active: true,
  usp_number: "123",
  usp_affiliations: profile.vinculo,
};
describe("identidades PostgreSQL", () => {
  it("persiste identidade com parâmetros e mapeia usuário sem senha", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = createPostgresIdentityRepository({
      query,
    } as unknown as Pool);
    expect(await repository.saveProfile(profile)).toMatchObject({
      id: 1,
      uspNumber: "123",
      role: "ALUNO",
      passwordHash: null,
    });
    expect(query.mock.calls[0][1]).toEqual([
      "Maria",
      "maria@usp.br",
      "ALUNO",
      "123",
      JSON.stringify(profile.vinculo),
    ]);
  });
  it("trata colisão sem vincular por e-mail e propaga falha do banco", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockRejectedValueOnce(new Error("offline"));
    const repository = createPostgresIdentityRepository({
      query,
    } as unknown as Pool);
    await expect(repository.saveProfile(profile)).rejects.toMatchObject({
      status: 409,
    });
    await expect(repository.saveProfile(profile)).rejects.toThrow("offline");
  });
  it("recarrega usuários e vínculos do banco e rejeita identificador inseguro", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [row, { ...row, id: "2", usp_number: null }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = createPostgresIdentityRepository({
      query,
    } as unknown as Pool);
    const directory: Directory = {
      users: [],
      classes: [],
      groups: [],
      assignments: [],
    };
    await repository.refresh(directory);
    expect(directory.users).toHaveLength(2);
    expect(directory.users[1].uspNumber).toBeUndefined();
    expect(directory.classes).toEqual([{ id: 1 }]);
    query.mockResolvedValueOnce({ rows: [{ ...row, id: "9007199254740993" }] });
    await expect(repository.saveProfile(profile)).rejects.toThrow("ID fora");
  });
});
