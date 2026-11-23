import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import request from "supertest";
import { ApiError } from "../errors.js";
import { r2Fixture } from "../test/r2Fixture.js";
import {
  context,
  materialInput,
  pdfFile,
  sampleFiles,
  upload,
} from "../test/context.js";
import { publicationContext, publicationInput } from "../test/publication.js";
import { createR2Storage, r2StorageLimitBytes } from "./r2Storage.js";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup() {
  const fixture = await r2Fixture();
  const root = await mkdtemp(join(tmpdir(), "labrary-r2-test-"));
  cleanup.push(
    () => fixture.close(),
    () => rm(root, { recursive: true, force: true }),
  );
  const reservations: string[] = [];
  const options = {
    client: fixture.client,
    bucket: "materiais",
    temporaryRoot: root,
    reserve: (operation: "A" | "B") => {
      reservations.push(operation);
    },
  };
  return {
    ...fixture,
    root,
    reservations,
    options,
    storage: createR2Storage(options),
  };
}
const content = (value: string) => Readable.from([Buffer.from(value)]);

describe("materiais privados no R2 pelo protocolo S3", () => {
  it("envia bytes, assinatura e SHA-256, limpa o temporário e lê após recriar o adapter", async () => {
    const c = await setup();
    const stored = await c.storage.save(content("%PDF-1.7\nrelatório"), {
      maxBytes: 100,
    });
    expect(stored.storageKey).toMatch(/^[a-f0-9-]{36}$/);
    const object = c.objects.get(stored.storageKey)!;
    expect(object.bytes.toString()).toBe("%PDF-1.7\nrelatório");
    expect(stored.checksumSha256).toBe(
      createHash("sha256").update(object.bytes).digest("hex"),
    );
    expect(object.sha256).toBe(stored.checksumSha256);
    expect(stored.signature).toEqual(object.bytes.subarray(0, 16));
    expect(stored.sizeBytes).toBe(object.bytes.length);
    expect(c.calls.find((call) => call.method === "PUT")?.storageClass).toBe(
      "STANDARD",
    );
    expect(
      c.calls.every((call) =>
        call.authorization?.startsWith("AWS4-HMAC-SHA256 "),
      ),
    ).toBe(true);
    expect(await readdir(c.root)).toEqual([]);
    const reopened = await createR2Storage(c.options).open(stored.storageKey);
    expect(reopened?.sizeBytes).toBe(object.bytes.length);
    expect(await text(reopened!.stream)).toBe(object.bytes.toString());
    const empty = await c.storage.save(Readable.from([]), { maxBytes: 0 });
    expect(empty.sizeBytes).toBe(0);
  });
  it("faz HEAD sem baixar o corpo, lê Range e recusa chaves e arquivos ausentes", async () => {
    const c = await setup();
    const { storageKey } = await c.storage.save(content("abcdef"), {
      maxBytes: 6,
    });
    const head = await c.storage.open(storageKey);
    head!.stream.destroy();
    expect(c.calls.filter((call) => call.method === "GET" && call.key)).toEqual(
      [],
    );
    const range = await c.storage.open(storageKey, { start: 2, end: 4 });
    expect(range!.sizeBytes).toBe(6);
    expect(await text(range!.stream)).toBe("cde");
    expect(c.calls.at(-1)?.range).toBe("bytes=2-4");
    const before = c.calls.length;
    for (const key of ["../segredo", "", "/etc/passwd"]) {
      expect(await c.storage.open(key)).toBeUndefined();
      await c.storage.remove(key);
    }
    expect(c.calls).toHaveLength(before);
    await c.storage.remove(storageKey);
    await c.storage.remove(storageKey);
    expect(await c.storage.open(storageKey)).toBeUndefined();
  });
  it("recusa corpos grandes ou interrompidos antes de acessar a nuvem", async () => {
    const c = await setup();
    await expect(
      c.storage.save(content("abcdef"), { maxBytes: 5 }),
    ).rejects.toMatchObject({ status: 413 });
    const broken = Readable.from(
      (async function* () {
        yield Buffer.from("parte");
        throw new Error("interrompido");
      })(),
    );
    await expect(c.storage.save(broken, { maxBytes: 100 })).rejects.toThrow(
      "interrompido",
    );
    expect(c.calls).toEqual([]);
    expect(await readdir(c.root)).toEqual([]);
  });
  it("conta todas as páginas e serializa uploads concorrentes para respeitar 9 GB", async () => {
    const c = await setup();
    c.objects.set("arquivo-antigo", {
      bytes: Buffer.alloc(0),
      size: r2StorageLimitBytes - 3,
      etag: '"antigo"',
    });
    const results = await Promise.allSettled([
      c.storage.save(content("ab"), { maxBytes: 10 }),
      c.storage.save(content("cd"), { maxBytes: 10 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      status: 507,
      code: "STORAGE_CAPACITY_LIMIT",
    });
    expect(c.calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    expect(await readdir(c.root)).toEqual([]);
    const saved = (
      results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
        storageKey: string;
      }>
    ).value;
    await c.storage.remove(saved.storageKey);
    await expect(
      c.storage.save(content("xyz"), { maxBytes: 3 }),
    ).resolves.toMatchObject({ sizeBytes: 3 });
  });
  it("não oculta erro remoto, não repete PUT e não deixa arquivos temporários", async () => {
    const c = await setup();
    c.control.failMethod = "PUT";
    await expect(
      c.storage.save(content("abc"), { maxBytes: 3 }),
    ).rejects.toMatchObject({ status: 503, code: "STORAGE_UNAVAILABLE" });
    expect(c.calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    expect(c.reservations).toEqual(["A", "A"]);
    expect(await readdir(c.root)).toEqual([]);
    c.control.failMethod = "DELETE";
    await expect(
      c.storage.remove("00000000-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("falha de forma segura se a listagem estiver incompleta ou o tamanho for inválido", async () => {
    const c = await setup();
    c.control.invalidPagination = true;
    await expect(
      c.storage.save(content("x"), { maxBytes: 1 }),
    ).rejects.toMatchObject({ status: 503 });
    c.control.invalidPagination = false;
    c.control.invalidSize = true;
    c.objects.set("antigo", { bytes: Buffer.alloc(0), size: 1, etag: '"x"' });
    await expect(
      c.storage.save(content("x"), { maxBytes: 1 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(c.calls.filter((call) => call.method === "PUT")).toEqual([]);
  });
  it("rejeita leitura inconsistente, falha de HEAD e esgotamento da cota antes do GET", async () => {
    const c = await setup();
    const stored = await c.storage.save(content("abc"), { maxBytes: 3 });
    c.control.missingEtag = true;
    await expect(c.storage.open(stored.storageKey)).rejects.toMatchObject({
      status: 503,
    });
    c.control.missingEtag = false;
    c.control.failMethod = "HEAD";
    await expect(c.storage.open(stored.storageKey)).rejects.toMatchObject({
      status: 503,
    });
    c.control.failMethod = "";
    const opened = await c.storage.open(stored.storageKey);
    c.objects.get(stored.storageKey)!.etag = '"alterado"';
    await expect(text(opened!.stream)).rejects.toMatchObject({ status: 503 });
    const blocked = createR2Storage({
      ...c.options,
      reserve() {
        throw new ApiError(503, "STORAGE_OPERATION_LIMIT", "Limite mensal.");
      },
    });
    const before = c.calls.length;
    await expect(blocked.open(stored.storageKey)).rejects.toMatchObject({
      code: "STORAGE_OPERATION_LIMIT",
    });
    await expect(
      blocked.save(content("x"), { maxBytes: 1 }),
    ).rejects.toMatchObject({ code: "STORAGE_OPERATION_LIMIT" });
    expect(c.calls).toHaveLength(before);
  });
  it("mantém upload e download privados na API e remove arquivos rejeitados pela validação", async () => {
    const c = await setup();
    const app = context({ storage: c.storage });
    const path = "/api/projects/2/materials";
    expect((await request(app.app).get(path)).status).toBe(401);
    expect((await app.client(2).get(path)).status).toBe(404);
    expect(c.calls).toEqual([]);
    const response = await upload(
      app.client(1),
      path,
      materialInput,
      pdfFile(),
    );
    expect(response.status).toBe(201);
    const url = response.body.data.currentVersion.downloadUrl;
    const before = c.calls.length;
    expect((await request(app.app).get(url)).status).toBe(401);
    expect((await app.client(2).get(url)).status).toBe(404);
    expect(c.calls).toHaveLength(before);
    const download = await app.client(1).get(url);
    expect(download.status).toBe(200);
    expect(download.body).toEqual(sampleFiles.pdf);
    const rejected = await upload(app.client(1), path, materialInput, {
      filename: "falso.pdf",
      content: Buffer.from("arquivo falso"),
    });
    expect(rejected.status).toBe(415);
    expect(c.objects.size).toBe(1);
    expect(c.calls.at(-1)?.method).toBe("DELETE");
  });
  it("serve publicação por Range e HEAD, e retirada bloqueia novas chamadas ao R2", async () => {
    const c = await setup();
    const app = await publicationContext({ storage: c.storage });
    expect(
      (
        await app
          .client(3)
          .post("/api/projects/1/finalization")
          .send({ submissionId: 11 })
      ).status,
    ).toBe(200);
    expect(
      (
        await app
          .client(3)
          .post("/api/projects/1/publication")
          .send(publicationInput)
      ).status,
    ).toBe(200);
    const url = "/api/catalog/1/materials/1/file";
    const beforeHead = c.calls.filter(
      (call) => call.method === "GET" && call.key,
    ).length;
    expect((await request(app.app).head(url)).status).toBe(200);
    expect(
      c.calls.filter((call) => call.method === "GET" && call.key),
    ).toHaveLength(beforeHead);
    const ranged = await request(app.app)
      .get(url)
      .set("Range", "bytes=4-7")
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(ranged.status).toBe(206);
    expect(ranged.body).toEqual(sampleFiles.mp4.subarray(4, 8));
    expect(ranged.headers["content-range"]).toBe(
      `bytes 4-7/${sampleFiles.mp4.length}`,
    );
    expect(ranged.headers["cache-control"]).toBe("no-store");
    expect(
      (await app.client(3).delete("/api/projects/1/publication")).status,
    ).toBe(204);
    const beforeWithdrawal = c.calls.length;
    expect((await request(app.app).get(url)).status).toBe(404);
    expect(
      (await request(app.app).get(url).set("Range", "bytes=4-7")).status,
    ).toBe(404);
    expect((await request(app.app).head(url)).status).toBe(404);
    expect(c.calls).toHaveLength(beforeWithdrawal);
    expect(c.objects.size).toBe(3);
  });
});
