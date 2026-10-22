import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import request from "supertest";
import {
  context,
  materialInput,
  pdfFile,
  sampleFiles,
  upload,
} from "../test/context.js";
import {
  createDefaultMaterialPolicy,
  defaultMaterialRules,
} from "../services/materialPolicy.js";
import { FileStorage } from "../services/fileStorage.js";
import { attachmentHeader } from "../controllers/projectController.js";

const materials = "/api/projects/2/materials";
const versions = (id: number) => `${materials}/${id}/versions`;
const storedFiles = async (dir: string) => readdir(dir).catch(() => []);

describe("envio de materiais com arquivo", () => {
  it("grava o arquivo como versão 1 com tipo detectado, checksum e autor", async () => {
    const { client, uploadDir } = context();
    const student = client(1);
    expect((await student.get(materials)).body.data).toEqual([]);
    const first = await upload(student, materials, materialInput, pdfFile());
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      id: 1,
      projectId: 2,
      kind: "RELATORIO",
      title: "Relatório técnico",
      createdBy: 1,
      currentVersion: {
        versionNumber: 1,
        originalFilename: "relatorio.pdf",
        mimeType: "application/pdf",
        sizeBytes: sampleFiles.pdf.length,
        checksumSha256: createHash("sha256")
          .update(sampleFiles.pdf)
          .digest("hex"),
        uploadedBy: { id: 1, fullName: expect.any(String) },
      },
    });
    expect(first.body.data.versions).toHaveLength(1);
    expect(JSON.stringify(first.body)).not.toContain("storageKey");
    expect(await storedFiles(uploadDir)).toHaveLength(1);
    const listed = await student.get(materials);
    expect(listed.body.data).toHaveLength(1);
  });
  it("usa o título padrão do tipo e o tipo detectado nos bytes", async () => {
    const { client } = context();
    const student = client(1);
    const video = await upload(
      student,
      materials,
      { kind: "VIDEO" },
      { content: sampleFiles.webm, filename: "apresentacao.webm" },
    );
    expect(video.status).toBe(201);
    expect(video.body.data.title).toBe("Vídeo de apresentação");
    expect(video.body.data.currentVersion.mimeType).toBe("video/webm");
    for (const [name, content] of [
      ["anexo.zip", sampleFiles.zip],
      ["foto.png", sampleFiles.png],
      ["foto.JPG", sampleFiles.jpeg],
    ] as const) {
      expect(
        (
          await upload(
            student,
            materials,
            { kind: "OUTRO", title: name },
            { content, filename: name },
          )
        ).status,
      ).toBe(201);
    }
    expect(
      (
        await upload(
          student,
          materials,
          { kind: "VIDEO", title: "Vídeo curto" },
          { content: sampleFiles.mp4, filename: "curto.mp4" },
        )
      ).body.data.currentVersion.mimeType,
    ).toBe("video/mp4");
  });
  it("substitui o arquivo criando nova versão e preservando o histórico", async () => {
    const { client, uploadDir } = context();
    const student = client(1);
    await upload(student, materials, materialInput, pdfFile());
    const replaced = await upload(
      student,
      versions(1),
      {},
      pdfFile("relatorio-final.pdf"),
    );
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.currentVersion).toMatchObject({
      versionNumber: 2,
      originalFilename: "relatorio-final.pdf",
    });
    expect(
      replaced.body.data.versions.map(
        (version: { versionNumber: number; originalFilename: string }) => [
          version.versionNumber,
          version.originalFilename,
        ],
      ),
    ).toEqual([
      [2, "relatorio-final.pdf"],
      [1, "relatorio.pdf"],
    ]);
    expect(await storedFiles(uploadDir)).toHaveLength(2);
    expect(
      (await upload(student, versions(1), { kind: "VIDEO" }, pdfFile())).body
        .error.code,
    ).toBe("UNEXPECTED_FIELD");
    expect(
      (
        await upload(
          student,
          versions(1),
          {},
          {
            content: sampleFiles.mp4,
            filename: "video.mp4",
          },
        )
      ).body.error.code,
    ).toBe("UNSUPPORTED_FORMAT");
    expect(
      (await upload(student, versions(99), {}, pdfFile())).body.error.code,
    ).toBe("MATERIAL_NOT_FOUND");
    expect((await upload(student, versions(0), {}, pdfFile())).status).toBe(
      400,
    );
    expect(await storedFiles(uploadDir)).toHaveLength(2);
    expect((await student.get(materials)).body.data[0].versions).toHaveLength(
      2,
    );
  });
  it("recusa duplicata de tipo e título e indica a substituição", async () => {
    const { client, uploadDir } = context();
    const student = client(1);
    await upload(student, materials, materialInput, pdfFile());
    const duplicate = await upload(
      student,
      materials,
      { ...materialInput, title: " relatório TÉCNICO " },
      pdfFile(),
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("MATERIAL_ALREADY_EXISTS");
    expect(await storedFiles(uploadDir)).toHaveLength(1);
  });
  it.each([
    [
      "conteúdo que não é PDF",
      { content: sampleFiles.text, filename: "r.pdf" },
      415,
      "UNSUPPORTED_FORMAT",
    ],
    [
      "PDF com extensão errada",
      { content: sampleFiles.pdf, filename: "r.docx" },
      415,
      "UNSUPPORTED_FORMAT",
    ],
    [
      "vídeo no lugar do relatório",
      { content: sampleFiles.mp4, filename: "r.mp4" },
      415,
      "UNSUPPORTED_FORMAT",
    ],
    [
      "arquivo vazio",
      { content: Buffer.alloc(0), filename: "r.pdf" },
      400,
      "EMPTY_FILE",
    ],
  ])("recusa %s sem manter o arquivo", async (_name, file, status, code) => {
    const { client, uploadDir } = context();
    const result = await upload(client(1), materials, materialInput, file);
    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
    expect(await storedFiles(uploadDir)).toEqual([]);
  });
  it("aplica o limite de tamanho durante o envio e pelo tamanho declarado", async () => {
    const policy = createDefaultMaterialPolicy(
      defaultMaterialRules.map((rule) => ({ ...rule, maxSizeBytes: 64 })),
    );
    const { client, uploadDir } = context({ materialPolicy: policy });
    const student = client(1);
    const big = Buffer.concat([sampleFiles.pdf, Buffer.alloc(100)]);
    const streamed = await upload(student, materials, materialInput, {
      content: big,
      filename: "grande.pdf",
    });
    expect(streamed.status).toBe(413);
    expect(streamed.body.error.code).toBe("FILE_TOO_LARGE");
    const declared = await upload(student, materials, materialInput, {
      content: Buffer.concat([sampleFiles.pdf, Buffer.alloc(70 * 1024)]),
      filename: "enorme.pdf",
    });
    expect(declared.status).toBe(413);
    expect(await storedFiles(uploadDir)).toEqual([]);
    expect(
      (await upload(student, materials, materialInput, pdfFile())).status,
    ).toBe(201);
  });
  it("valida o formato do multipart e os campos", async () => {
    const { client, uploadDir } = context();
    const student = client(1);
    const json = await student.post(materials).send({ kind: "RELATORIO" });
    expect(json.body.error.code).toBe("MULTIPART_REQUIRED");
    expect(
      (await upload(student, materials, materialInput)).body.error.code,
    ).toBe("FILE_REQUIRED");
    expect(
      (
        await student
          .post(materials)
          .field("kind", "RELATORIO")
          .attach("anexo", sampleFiles.pdf, "r.pdf")
      ).body.error.code,
    ).toBe("UNEXPECTED_FILE");
    expect(
      (
        await student
          .post(materials)
          .field("kind", "RELATORIO")
          .attach("file", sampleFiles.pdf, "a.pdf")
          .attach("file", sampleFiles.pdf, "b.pdf")
      ).body.error.code,
    ).toBe("TOO_MANY_FILES");
    const fileFirst = await student
      .post(materials)
      .attach("file", sampleFiles.pdf, "r.pdf")
      .field("kind", "RELATORIO");
    expect(fileFirst.body.error.code).toBe("VALIDATION_ERROR");
    expect(
      (await upload(student, materials, { kind: "PLANILHA" }, pdfFile())).body
        .error.code,
    ).toBe("VALIDATION_ERROR");
    expect(
      (
        await upload(
          student,
          materials,
          { ...materialInput, title: "x".repeat(2000) },
          pdfFile(),
        )
      ).body.error.code,
    ).toBe("FIELD_TOO_LONG");
    expect(
      (
        await upload(
          student,
          materials,
          { ...materialInput, title: "x".repeat(201) },
          pdfFile(),
        )
      ).body.error.code,
    ).toBe("VALIDATION_ERROR");
    expect(
      (
        await upload(
          student,
          materials,
          { ...materialInput, groupId: "1" },
          pdfFile(),
        )
      ).status,
    ).toBe(400);
    const manyFields = student.post(materials);
    for (let index = 0; index < 10; index++)
      manyFields.field(`campo${index}`, "x");
    expect((await manyFields).body.error.code).toBe("TOO_MANY_FIELDS");
    const truncated = await student
      .post(materials)
      .set("Content-Type", "multipart/form-data; boundary=limite")
      .send(
        '--limite\r\nContent-Disposition: form-data; name="kind"\r\n\r\nRELATORIO\r\n--limite\r\nContent-Disposition: form-data; name="file"; filename="r.pdf"\r\n\r\n%PDF-1.7 sem fim',
      );
    expect(truncated.body.error.code).toBe("INVALID_MULTIPART");
    expect(await storedFiles(uploadDir)).toEqual([]);
  });
  it("permite enviar somente ao aluno do grupo com a entrega aberta", async () => {
    const { client, repository, uploadDir } = context();
    expect(
      (await upload(client(3), materials, materialInput, pdfFile())).status,
    ).toBe(403);
    expect(
      (
        await upload(
          client(2),
          "/api/projects/1/materials",
          materialInput,
          pdfFile(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await upload(
          client(1),
          "/api/projects/1/materials",
          materialInput,
          pdfFile(),
        )
      ).status,
    ).toBe(404);
    await upload(client(1), materials, materialInput, pdfFile());
    expect((await upload(client(3), versions(1), {}, pdfFile())).status).toBe(
      403,
    );
    expect((await upload(client(2), versions(1), {}, pdfFile())).status).toBe(
      404,
    );
    repository.get(2)!.status = "EM_AVALIACAO";
    const locked = await upload(client(1), versions(1), {}, pdfFile());
    expect(locked.body.error.code).toBe("PROJECT_LOCKED");
    repository.get(2)!.status = "PREPARACAO";
    repository.get(2)!.dueAt = "2020-01-01T00:00:00.000Z";
    expect(
      (
        await upload(
          client(1),
          materials,
          { kind: "MANUAL" },
          pdfFile("manual.pdf"),
        )
      ).body.error.code,
    ).toBe("DEADLINE_PASSED");
    repository.get(2)!.status = "AJUSTES";
    expect(
      (
        await upload(
          client(1),
          materials,
          { kind: "MANUAL" },
          pdfFile("manual.pdf"),
        )
      ).status,
    ).toBe(201);
    expect(await storedFiles(uploadDir)).toHaveLength(2);
  });
  it("descarta o arquivo se a entrega fechar enquanto ele chegava", async () => {
    const base = context();
    const storage: FileStorage = {
      ...base.storage,
      async save(source, options) {
        const stored = await base.storage.save(source, options);
        base.repository.get(2)!.status = "EM_AVALIACAO";
        return stored;
      },
    };
    const { client, uploadDir } = context({
      storage,
      repository: base.repository,
      auth: base.auth,
    });
    const result = await upload(client(1), materials, materialInput, pdfFile());
    expect(result.body.error.code).toBe("PROJECT_LOCKED");
    expect(await storedFiles(base.uploadDir)).toEqual([]);
    expect(await storedFiles(uploadDir)).toEqual([]);
  });
  it("não aceita versão para material de outro projeto", async () => {
    const { client, repository } = context();
    const material = repository.createMaterial(
      1,
      { kind: "VIDEO", title: "Vídeo", createdBy: 1 },
      {
        originalFilename: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 10,
        storageKey: "00000000-0000-4000-8000-000000000001",
        checksumSha256: null,
        uploadedBy: 1,
      },
    );
    expect(() =>
      repository.addVersion(2, material.id, { ...material.versions[0] }),
    ).toThrow("Material não encontrado.");
    expect(
      (await upload(client(1), versions(material.id), {}, pdfFile())).status,
    ).toBe(404);
    expect(repository.getMaterial(1, material.id)?.versions).toHaveLength(1);
  });
  it("informa regras de envio e se o usuário pode enviar", async () => {
    const { client, repository } = context();
    const student = await client(1).get("/api/projects/2/material-rules");
    expect(student.status).toBe(200);
    expect(student.body.data).toMatchObject({
      dueAt: null,
      lock: null,
      canUpload: true,
    });
    expect(student.body.data.rules[0]).toMatchObject({
      kind: "VIDEO",
      required: true,
      maxSizeBytes: 500 * 1024 * 1024,
      formats: [
        { label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
        { label: "WebM", mimeType: "video/webm", extensions: [".webm"] },
      ],
    });
    expect(
      (await client(3).get("/api/projects/2/material-rules")).body.data
        .canUpload,
    ).toBe(false);
    expect(
      (await client(2).get("/api/projects/1/material-rules")).body.data,
    ).toMatchObject({ lock: "PROJECT_LOCKED", canUpload: false });
    expect((await client(1).get("/api/projects/1/material-rules")).status).toBe(
      404,
    );
    repository.get(2)!.dueAt = "2020-01-01T00:00:00.000Z";
    expect(
      (await client(1).get("/api/projects/2/material-rules")).body.data,
    ).toMatchObject({ lock: "DEADLINE_PASSED", canUpload: false });
  });
});

describe("download protegido das versões", () => {
  const binary = (req: request.Test) =>
    req.buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });

  it("entrega cada versão como anexo para quem pode ver o projeto", async () => {
    const { client } = context();
    const student = client(1);
    const created = await upload(
      student,
      materials,
      materialInput,
      pdfFile("relatório – versão 1.pdf"),
    );
    const v2Content = Buffer.concat([sampleFiles.pdf, Buffer.from("v2")]);
    const replaced = await upload(
      student,
      versions(1),
      {},
      {
        content: v2Content,
        filename: "relatorio-v2.pdf",
      },
    );
    const [v2, v1] = replaced.body.data.versions;
    expect(v1.downloadUrl).toBe(created.body.data.currentVersion.downloadUrl);
    expect(v2.downloadUrl).toBe("/api/projects/2/materials/1/versions/2/file");

    const first = await binary(student.get(v1.downloadUrl));
    expect(first.status).toBe(200);
    expect(first.body).toEqual(sampleFiles.pdf);
    expect(first.headers).toMatchObject({
      "content-type": "application/pdf",
      "content-length": String(sampleFiles.pdf.length),
      "content-disposition":
        'attachment; filename="relatorio _ versao 1.pdf"; ' +
        "filename*=UTF-8''relat%C3%B3rio%20%E2%80%93%20vers%C3%A3o%201.pdf",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    });
    expect((await binary(student.get(v2.downloadUrl))).body).toEqual(v2Content);
    expect((await binary(client(3).get(v2.downloadUrl))).status).toBe(200);
  });
  it("escapa aspas, barras e caracteres reservados no nome do anexo", () => {
    expect(attachmentHeader(`O "manual" (v2)*\\it's.pdf`)).toBe(
      `attachment; filename="O _manual_ (v2)*_it's.pdf"; ` +
        "filename*=UTF-8''O%20%22manual%22%20%28v2%29%2A%5Cit%27s.pdf",
    );
  });
  it("responde 404 igual para fora do escopo, inexistente ou sem arquivo", async () => {
    const { client, repository, storage } = context();
    const student = client(1);
    await upload(student, materials, materialInput, pdfFile());
    const url = "/api/projects/2/materials/1/versions/1/file";
    expect((await client(2).get(url)).body.error.code).toBe(
      "PROJECT_NOT_FOUND",
    );
    for (const path of [
      "/api/projects/2/materials/9/versions/1/file",
      "/api/projects/2/materials/1/versions/9/file",
    ])
      expect((await student.get(path)).body.error.code).toBe("FILE_NOT_FOUND");
    expect(
      (await student.get("/api/projects/2/materials/1/versions/0/file")).status,
    ).toBe(400);
    await storage.remove(repository.getMaterial(2, 1)!.versions[0].storageKey);
    expect((await student.get(url)).body.error.code).toBe("FILE_NOT_FOUND");
  });
  it("permite ao avaliador baixar os materiais do projeto atribuído", async () => {
    const { app, client, repository, storage } = context();
    const stored = await storage.save(Readable.from([sampleFiles.mp4]), {
      maxBytes: 1_000,
    });
    const material = repository.createMaterial(
      1,
      { kind: "VIDEO", title: "Vídeo", createdBy: 1 },
      {
        originalFilename: "demo.mp4",
        mimeType: "video/mp4",
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        uploadedBy: 1,
      },
    );
    const url = `/api/projects/1/materials/${material.id}/versions/1/file`;
    const evaluator = await binary(client(2).get(url));
    expect(evaluator.status).toBe(200);
    expect(evaluator.body).toEqual(sampleFiles.mp4);
    expect((await client(1).get(url)).status).toBe(404);
    expect((await request(app).get(url)).status).toBe(401);
  });
});
