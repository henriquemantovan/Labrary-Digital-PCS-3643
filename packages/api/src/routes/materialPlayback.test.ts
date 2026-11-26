import { describe, expect, it } from "vitest";
import request from "supertest";
import {
  context,
  sampleFiles,
  upload,
  pdfFile,
  materialInput,
} from "../test/context.js";
import type { FileStorage } from "../services/fileStorage.js";

const path = "/api/projects/2/materials";
const binary = (req: request.Test) =>
  req.buffer(true).parse((response, callback) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => callback(null, Buffer.concat(chunks)));
  });
async function video(c = context()) {
  const sent = await upload(
    c.client(1),
    path,
    { kind: "VIDEO" },
    { filename: "apresentação.webm", content: sampleFiles.webm },
  );
  expect(sent.status).toBe(201);
  return {
    ...c,
    version: sent.body.data.currentVersion,
    url: sent.body.data.currentVersion.playbackUrl as string,
  };
}

describe("reprodução privada de vídeos", () => {
  it("informa URL privada e entrega inline para aluno, professor e avaliador vinculado", async () => {
    const c = await video();
    expect(c.url).toBe("/api/projects/2/materials/1/versions/1/stream");
    const full = await binary(c.client(1).get(c.url));
    expect(full.status).toBe(200);
    expect(full.body).toEqual(sampleFiles.webm);
    expect(full.headers).toMatchObject({
      "content-type": "video/webm",
      "accept-ranges": "bytes",
      "cache-control": "no-store",
      "content-length": String(sampleFiles.webm.length),
      "x-content-type-options": "nosniff",
    });
    expect(full.headers["content-disposition"]).toMatch(/^inline;/);
    const download = await binary(c.client(1).get(c.version.downloadUrl));
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toMatch(/^attachment;/);
    expect((await binary(c.client(3).get(c.url))).status).toBe(200);
    expect((await c.client(2).get(c.url)).status).toBe(404);
    expect((await request(c.app).get(c.url)).status).toBe(401);
    c.auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
    expect((await binary(c.client(2).get(c.url))).body).toEqual(
      sampleFiles.webm,
    );
    c.auth.directory.assignments = c.auth.directory.assignments.filter(
      (item) => item.projectId !== 2,
    );
    expect((await c.client(2).get(c.url)).status).toBe(404);
  });
  it("suporta HEAD e intervalos, recusando faixas inválidas sem enviar o vídeo", async () => {
    const c = await video();
    for (const [header, start, end] of [
      ["bytes=0-3", 0, 3],
      ["bytes=4-", 4, sampleFiles.webm.length - 1],
      ["bytes=-4", sampleFiles.webm.length - 4, sampleFiles.webm.length - 1],
    ] as const) {
      const response = await binary(
        c.client(1).get(c.url).set("Range", header),
      );
      expect(response.status).toBe(206);
      expect(response.body).toEqual(sampleFiles.webm.subarray(start, end + 1));
      expect(response.headers["content-range"]).toBe(
        `bytes ${start}-${end}/${sampleFiles.webm.length}`,
      );
      expect(response.headers["content-length"]).toBe(String(end - start + 1));
    }
    for (const header of [
      "bytes=999-",
      "bytes=2-1",
      "bytes=0-1,3-4",
      "items=0-1",
    ]) {
      const response = await c.client(1).get(c.url).set("Range", header);
      expect(response.status).toBe(416);
      expect(response.headers["content-range"]).toBe(
        `bytes */${sampleFiles.webm.length}`,
      );
      expect(response.body.error.code).toBe("INVALID_RANGE");
    }
    const token = c.auth.createSession(1, Date.now(), 60_000);
    const head = await request(c.app)
      .head(c.url)
      .set("Cookie", `labrary_session=${token}`)
      .set("Range", "bytes=999-");
    expect(head.status).toBe(200);
    expect(head.headers["content-length"]).toBe(
      String(sampleFiles.webm.length),
    );
    expect(head.text).toBeUndefined();
    expect((await request(c.app).head(c.url)).status).toBe(401);
  });
  it("mantém URLs das versões anteriores após substituição", async () => {
    const c = await video();
    const bytes = Buffer.concat([
      sampleFiles.webm,
      Buffer.from("segunda versão"),
    ]);
    const replaced = await upload(
      c.client(1),
      `${path}/1/versions`,
      {},
      { filename: "v2.webm", content: bytes },
    );
    expect(replaced.status).toBe(201);
    const [latest, previous] = replaced.body.data.versions;
    expect(previous.playbackUrl).toBe(c.url);
    expect(latest.playbackUrl).not.toBe(c.url);
    expect((await binary(c.client(1).get(c.url))).body).toEqual(
      sampleFiles.webm,
    );
    expect((await binary(c.client(1).get(latest.playbackUrl))).body).toEqual(
      bytes,
    );
  });
  it("não reproduz documentos, referências incorretas, bytes ausentes ou tamanho divergente", async () => {
    const c = await video();
    const report = await upload(c.client(1), path, materialInput, pdfFile());
    expect(report.body.data.currentVersion.playbackUrl).toBeUndefined();
    for (const url of [
      c.url.replace("materials/1", "materials/2"),
      c.url.replace("versions/1", "versions/99"),
      c.url.replace("materials/1", "materials/99"),
    ]) {
      expect((await c.client(1).get(url)).status).toBe(404);
    }
    expect(
      (await c.client(1).get(c.url.replace("versions/1", "versions/0"))).status,
    ).toBe(400);
    const version = c.repository.getMaterial(2, 1)!.versions[0];
    version.sizeBytes++;
    expect((await c.client(1).get(c.url)).status).toBe(404);
    version.sizeBytes--;
    await c.storage.remove(version.storageKey);
    expect((await c.client(1).get(c.url)).status).toBe(404);
  });
  it("revalida o vínculo após cada acesso assíncrono ao armazenamento", async () => {
    for (const revokeAfter of [1, 2]) {
      const base = context();
      let calls = 0;
      const opened: NonNullable<Awaited<ReturnType<FileStorage["open"]>>>[] =
        [];
      const storage: FileStorage = {
        ...base.storage,
        async open(key, range) {
          const file = await base.storage.open(key, range);
          if (file) opened.push(file);
          if (++calls === revokeAfter) {
            const group = base.auth.directory.groups.find(
              (group) => group.id === base.repository.get(2)!.groupId,
            )!;
            group.memberIds = [];
          }
          return file;
        },
      };
      const c = await video(
        context({ auth: base.auth, repository: base.repository, storage }),
      );
      const response = await c.client(1).get(c.url).set("Range", "bytes=0-3");
      expect(response.status).toBe(404);
      expect(response.headers["content-range"]).toBeUndefined();
      expect(opened.every((file) => file.stream.destroyed)).toBe(true);
    }
  });
  it("fecha a leitura se o arquivo desaparecer ou mudar ao abrir o intervalo", async () => {
    for (const missingRange of [true, false]) {
      const base = context();
      const storage: FileStorage = {
        ...base.storage,
        async open(key, range) {
          if (range && missingRange) return undefined;
          const file = await base.storage.open(key, range);
          return (
            file && { ...file, sizeBytes: file.sizeBytes + (range ? 1 : 0) }
          );
        },
      };
      const c = await video(
        context({ auth: base.auth, repository: base.repository, storage }),
      );
      expect(
        (await c.client(1).get(c.url).set("Range", "bytes=0-3")).status,
      ).toBe(404);
    }
  });
});
