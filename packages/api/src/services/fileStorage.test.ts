import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { resolveUploadDir } from "./configuration.js";
import { createDiskStorage } from "./fileStorage.js";

const roots: string[] = [];
const tempRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "labrary-storage-"));
  roots.push(root);
  return root;
};
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("armazenamento privado de materiais", () => {
  it("grava com chave gerada, tamanho, checksum e assinatura inicial", async () => {
    const root = join(await tempRoot(), "uploads");
    const storage = createDiskStorage(root);
    const chunks = ["%PDF", "-1.7\n", "conteúdo do relatório"];
    const stored = await storage.save(
      Readable.from(chunks.map((c) => Buffer.from(c))),
      {
        maxBytes: 1_000,
      },
    );
    const content = Buffer.from(chunks.join(""));
    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.sizeBytes).toBe(content.length);
    expect(stored.checksumSha256).toBe(
      createHash("sha256").update(content).digest("hex"),
    );
    expect(stored.signature).toEqual(content.subarray(0, 16));
    expect(await readdir(root)).toEqual([stored.storageKey]);
    const opened = await storage.open(stored.storageKey);
    expect(opened?.sizeBytes).toBe(content.length);
    expect(await text(opened!.stream)).toBe(content.toString());
  });
  it("aceita arquivo vazio e arquivo exatamente no limite", async () => {
    const storage = createDiskStorage(await tempRoot());
    const empty = await storage.save(Readable.from([]), { maxBytes: 4 });
    expect(empty.sizeBytes).toBe(0);
    expect(empty.signature).toHaveLength(0);
    const exact = await storage.save(Readable.from([Buffer.from("abcd")]), {
      maxBytes: 4,
    });
    expect(exact.sizeBytes).toBe(4);
  });
  it("interrompe arquivo acima do limite sem deixar resíduos", async () => {
    const root = await tempRoot();
    const storage = createDiskStorage(root);
    await expect(
      storage.save(Readable.from([Buffer.alloc(3), Buffer.alloc(3)]), {
        maxBytes: 5,
      }),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
    expect(await readdir(root)).toEqual([]);
  });
  it("descarta o arquivo parcial quando o envio falha", async () => {
    const root = await tempRoot();
    const storage = createDiskStorage(root);
    const broken = new Readable({
      read() {
        this.push(Buffer.from("parte"));
        this.destroy(new Error("conexão perdida"));
      },
    });
    await expect(storage.save(broken, { maxBytes: 100 })).rejects.toThrow(
      "conexão perdida",
    );
    expect(await readdir(root)).toEqual([]);
  });
  it("não abre nem remove caminhos fora das chaves geradas", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "segredo.txt"), "x");
    const storage = createDiskStorage(join(root, "uploads"));
    for (const key of ["../segredo.txt", "segredo.txt", "", "/etc/passwd"]) {
      expect(await storage.open(key)).toBeUndefined();
      await storage.remove(key);
    }
    expect(await readdir(root)).toContain("segredo.txt");
  });
  it("remove de forma idempotente e informa arquivo ausente", async () => {
    const storage = createDiskStorage(await tempRoot());
    const stored = await storage.save(Readable.from([Buffer.from("a")]), {
      maxBytes: 10,
    });
    await storage.remove(stored.storageKey);
    await storage.remove(stored.storageKey);
    expect(await storage.open(stored.storageKey)).toBeUndefined();
  });
  it("propaga falhas inesperadas do sistema de arquivos", async () => {
    const root = await tempRoot();
    const key = "00000000-0000-4000-8000-000000000000";
    await writeFile(join(root, "arquivo"), "x");
    await expect(
      createDiskStorage(join(root, "arquivo")).open(key),
    ).rejects.toMatchObject({ code: "ENOTDIR" });
    await mkdir(join(root, key));
    await expect(createDiskStorage(root).remove(key)).rejects.toMatchObject({
      code: expect.stringMatching(/EISDIR|EPERM/),
    });
  });
  it("resolve a pasta de uploads a partir da raiz do repositório", () => {
    expect(resolveUploadDir({}, "/repo")).toBe("/repo/.uploads");
    expect(resolveUploadDir({ UPLOAD_DIR: "dados/up" }, "/repo")).toBe(
      "/repo/dados/up",
    );
    expect(resolveUploadDir({ UPLOAD_DIR: "/srv/labrary" }, "/repo")).toBe(
      "/srv/labrary",
    );
  });
});
