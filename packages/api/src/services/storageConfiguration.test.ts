import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import {
  createConfiguredStorage,
  loadR2Config,
} from "./storageConfiguration.js";
import { initializeR2Usage } from "./r2Usage.js";

const env = {
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "a".repeat(32),
  R2_BUCKET: "labrary-materiais",
  R2_ACCESS_KEY_ID: "chave-teste",
  R2_SECRET_ACCESS_KEY: "segredo-teste",
};
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
describe("seleção explícita do armazenamento", () => {
  it("usa o controle PostgreSQL sem exigir arquivo local de operações", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const storage = createConfiguredStorage(env, "/caminho-inexistente", "/sem-projetos.json", { query } as unknown as Pool);
    expect(storage.save).toBeTypeOf("function");
    expect(await storage.open("../segredo")).toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
  it("mantém o disco como padrão e respeita UPLOAD_DIR", async () => {
    const root = mkdtempSync(join(tmpdir(), "labrary-storage-config-"));
    roots.push(root);
    const storage = createConfiguredStorage(
      { UPLOAD_DIR: "privado" },
      root,
      join(root, "projects.json"),
    );
    const saved = await storage.save(Readable.from([Buffer.from("x")]), {
      maxBytes: 1,
    });
    const opened = await createConfiguredStorage(
      { STORAGE_PROVIDER: "disk", UPLOAD_DIR: "privado" },
      root,
      "irrelevante",
    ).open(saved.storageKey);
    expect(await text(opened!.stream)).toBe("x");
  });
  it("rejeita provedor inválido e configuração incompleta sem expor credenciais", () => {
    expect(() =>
      createConfiguredStorage(
        { STORAGE_PROVIDER: "r22" },
        "/repo",
        "/repo/p.json",
      ),
    ).toThrow("disk ou r2");
    for (const field of [
      "R2_ACCOUNT_ID",
      "R2_BUCKET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ]) {
      const invalid = { ...env, [field]: "" };
      expect(() => loadR2Config(invalid, "/repo", "/repo/p.json")).toThrow();
      try {
        loadR2Config(invalid, "/repo", "/repo/p.json");
      } catch (error) {
        expect((error as Error).message).not.toContain("segredo-teste");
      }
    }
    expect(() =>
      loadR2Config(
        { ...env, R2_ACCOUNT_ID: "https://servidor-malicioso" },
        "/repo",
        "/repo/p.json",
      ),
    ).toThrow();
  });
  it("resolve o arquivo de uso e exige inicialização antes de criar o adapter R2", () => {
    const root = mkdtempSync(join(tmpdir(), "labrary-storage-config-"));
    roots.push(root);
    const dataFile = join(root, "projects.json");
    const config = loadR2Config(env, root, dataFile);
    expect(config.usageFile).toBe(`${dataFile}.r2-usage.json`);
    expect(
      loadR2Config(
        { ...env, R2_USAGE_FILE: "privado/uso.json" },
        root,
        dataFile,
      ).usageFile,
    ).toBe(join(root, "privado/uso.json"));
    expect(() => createConfiguredStorage(env, root, dataFile)).toThrow();
    initializeR2Usage(config.usageFile, config.scope);
    const storage = createConfiguredStorage(env, root, dataFile);
    expect(storage.save).toBeTypeOf("function");
    expect(storage.open).toBeTypeOf("function");
    // Chave inválida é recusada antes de qualquer comunicação com a nuvem.
    return expect(storage.open("../segredo")).resolves.toBeUndefined();
  });
});
