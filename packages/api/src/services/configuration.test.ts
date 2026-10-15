import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { directorySchema } from "../models/auth.js";
import { loadDirectory } from "./configuration.js";
import { hashPassword, verifyPassword } from "./password.js";

describe("provisionamento de contas", () => {
  it("gera hashes salgados e valida senhas", async () => {
    const first = await hashPassword("Uma senha longa!");
    const second = await hashPassword("Uma senha longa!");
    expect(first).not.toBe(second);
    expect(first).not.toContain("Uma senha longa!");
    expect(await verifyPassword("Uma senha longa!", first)).toBe(true);
    expect(await verifyPassword("senha errada", first)).toBe(false);
  });
  it("exige configuração explícita e proíbe modo demo em produção", async () => {
    await expect(loadDirectory({})).rejects.toThrow(
      "Configure AUTH_USERS_FILE",
    );
    await expect(
      loadDirectory({ AUTH_DEMO: "true", NODE_ENV: "production" }),
    ).rejects.toThrow("produção");
    await expect(
      loadDirectory({ AUTH_DEMO: "true", AUTH_USERS_FILE: "file" }),
    ).rejects.toThrow("apenas");
    const demo = await loadDirectory({ AUTH_DEMO: "true" });
    expect(demo.users).toHaveLength(3);
    expect(directorySchema.parse(demo)).toEqual(demo);
  });
  it("carrega arquivo provisionado e rejeita dados inválidos", async () => {
    const root = await mkdtemp(join(tmpdir(), "labrary-auth-"));
    const path = join(root, "users.json");
    try {
      const demo = await loadDirectory({ AUTH_DEMO: "true" });
      await writeFile(path, JSON.stringify(demo));
      expect(await loadDirectory({ AUTH_USERS_FILE: path })).toEqual(demo);
      for (const mutate of [
        (data: typeof demo) => data.users.push(data.users[0]),
        (data: typeof demo) => {
          data.users[1].email = data.users[0].email;
        },
        (data: typeof demo) => {
          data.classes[0].professorId = 1;
        },
        (data: typeof demo) => {
          data.groups[0].classId = 999;
        },
        (data: typeof demo) => {
          data.groups[0].memberIds = [2];
        },
        (data: typeof demo) => {
          data.assignments[0].evaluatorId = 1;
        },
        (data: typeof demo) => {
          data.users[0].passwordHash = "plaintext";
        },
      ]) {
        const modified = structuredClone(demo);
        mutate(modified);
        await writeFile(path, JSON.stringify(modified));
        await expect(
          loadDirectory({ AUTH_USERS_FILE: path }),
        ).rejects.toThrow();
      }
      await writeFile(path, "invalid-json");
      await expect(loadDirectory({ AUTH_USERS_FILE: path })).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
