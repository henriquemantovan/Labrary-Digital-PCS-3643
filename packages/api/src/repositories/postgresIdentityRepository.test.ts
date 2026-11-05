import { describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { createPostgresIdentityRepository } from "./postgresIdentityRepository.js";
import { GoogleProfile } from "../services/googleOAuth.js";
import { Directory } from "../models/auth.js";
const profile: GoogleProfile = {
  subject: "google-123",
  fullName: "Maria",
  email: "MARIA@gmail.com",
  emailVerified: true,
};
const row = {
  id: "1",
  full_name: "Maria",
  email: "maria@gmail.com",
  password_hash: null,
  role: "ALUNO",
  active: true,
  google_subject: "google-123",
};
describe("identidade Google PostgreSQL", () => {
  it("persiste identidade por sub e normaliza e-mail sem promover perfil", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repo = createPostgresIdentityRepository({ query } as unknown as Pool);
    expect(await repo.saveProfile(profile)).toMatchObject({
      id: 1,
      role: "ALUNO",
      googleLinked: true,
      passwordHash: null,
    });
    expect(query.mock.calls[0][1]).toEqual([
      "Maria",
      "maria@gmail.com",
      "google-123",
    ]);
  });
  it("recusa e-mail não verificado e não mescla conta antiga por e-mail", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505" })
      .mockRejectedValueOnce(new Error("offline"));
    const repo = createPostgresIdentityRepository({ query } as unknown as Pool);
    await expect(
      repo.saveProfile({ ...profile, emailVerified: false as true }),
    ).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
    await expect(repo.saveProfile(profile)).rejects.toMatchObject({
      code: "GOOGLE_ACCOUNT_CONFLICT",
    });
    await expect(repo.saveProfile(profile)).rejects.toThrow("offline");
  });
  it("recarrega contas e vínculos e rejeita IDs inseguros", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [row, { ...row, id: "2", google_subject: null }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repo = createPostgresIdentityRepository({ query } as unknown as Pool);
    const directory: Directory = {
      users: [],
      classes: [],
      groups: [],
      assignments: [],
    };
    await repo.refresh(directory);
    expect(directory.users).toHaveLength(2);
    expect(directory.users[1].googleLinked).toBe(false);
    expect(directory.classes).toEqual([{ id: 1 }]);
    query.mockResolvedValueOnce({ rows: [{ ...row, id: "9007199254740993" }] });
    await expect(repo.saveProfile(profile)).rejects.toThrow("ID fora");
  });
});
