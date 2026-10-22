import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { context, materialInput, projectInput } from "../test/context.js";

describe("API REST de projetos e materiais com autorização", () => {
  it("mantém saúde pública e exige sessão em cada rota privada", async () => {
    const { app } = context();
    expect((await request(app).get("/api/health")).body.data.status).toBe("ok");
    for (const path of [
      "/api/projects",
      "/api/projects/1",
      "/api/projects/1/materials",
      "/api/projects/1/material-rules",
      "/api/scope",
      "/api/auth/me",
    ]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    for (const path of [
      "/api/projects",
      "/api/projects/1/materials",
      "/api/projects/1/materials/1/versions",
    ]) {
      expect(
        (await request(app).post(path).set("X-CSRF-Protection", "1").send({}))
          .status,
      ).toBe(401);
    }
  });
  it.each([
    [1, [2]],
    [2, [1]],
    [3, [1, 2]],
  ])("lista apenas projetos do perfil %s", async (id, ids) => {
    const { client } = context();
    const result = await client(id as number).get("/api/projects");
    expect(result.status).toBe(200);
    expect(result.body.data.map((item: { id: number }) => item.id)).toEqual(
      ids,
    );
    expect(result.headers["cache-control"]).toBe("no-store");
  });
  it("não permite contornar escopo com filtros, IDs ou cabeçalhos de perfil", async () => {
    const { client } = context();
    const student = client(1);
    expect(
      (await student.get("/api/projects?status=EM_AVALIACAO&classId=1")).body
        .data,
    ).toEqual([]);
    expect((await student.get("/api/projects?classId=2")).body.data).toEqual(
      [],
    );
    const hidden = await student
      .get("/api/projects/1")
      .set("X-Role", "PROFESSOR");
    const absent = await student.get("/api/projects/999");
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual(absent.body);
    for (const actor of [student, client(2)]) {
      const deniedId = actor === student ? 1 : 2;
      expect(
        (await actor.get(`/api/projects/${deniedId}/materials`)).status,
      ).toBe(404);
      expect(
        (
          await actor
            .post(`/api/projects/${deniedId}/materials`)
            .send(materialInput)
        ).status,
      ).toBe(404);
    }
  });
  it("nega acesso de professor à turma de outro docente", async () => {
    const { auth, repository, client } = context();
    auth.directory.users.push({
      ...auth.directory.users[2],
      id: 4,
      email: "outro@labrary.local",
    });
    auth.directory.classes.push({
      id: 2,
      name: "Outra turma",
      academicYear: 2026,
      professorId: 4,
    });
    auth.directory.groups.push({
      id: 4,
      classId: 2,
      name: "Grupo externo",
      memberIds: [],
    });
    const external = repository.create({
      ...projectInput,
      classId: 2,
      groupId: 4,
      description: "Privado",
    });
    const professor = client(3);
    expect((await professor.get(`/api/projects/${external.id}`)).status).toBe(
      404,
    );
    expect(
      (await professor.get(`/api/projects/${external.id}/materials`)).status,
    ).toBe(404);
    expect(
      (
        await professor
          .post(`/api/projects/${external.id}/materials`)
          .send(materialInput)
      ).status,
    ).toBe(404);
    expect((await professor.get("/api/projects?classId=2")).body.data).toEqual(
      [],
    );
    expect(
      (
        await professor
          .post("/api/projects")
          .send({ ...projectInput, classId: 2, groupId: 4 })
      ).status,
    ).toBe(403);
    expect(
      (
        await professor
          .post("/api/projects")
          .send({ ...projectInput, groupId: 4 })
      ).status,
    ).toBe(403);
    expect(
      (
        await professor
          .post("/api/projects")
          .send({ ...projectInput, groupId: 999 })
      ).status,
    ).toBe(403);
  });
  it("permite criar somente para grupos válidos da própria turma", async () => {
    const { client } = context();
    for (const id of [1, 2])
      expect(
        (await client(id).post("/api/projects").send(projectInput)).status,
      ).toBe(403);
    const professor = client(3);
    const result = await professor.post("/api/projects").send(projectInput);
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      ...projectInput,
      id: 3,
      description: "",
      status: "PREPARACAO",
    });
    expect(
      (await professor.post("/api/projects").send(projectInput)).status,
    ).toBe(409);
    expect((await professor.get("/api/projects/3")).body.data.title).toBe(
      projectInput.title,
    );
  });
  it("valida payloads, identificadores e filtros", async () => {
    const { client } = context();
    const professor = client(3);
    const invalid = await professor
      .post("/api/projects")
      .send({ classId: 0, groupId: -2, title: " ", category: "" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "title" })]),
    );
    for (const path of [
      "/api/projects/NaN",
      "/api/projects/0/materials",
      "/api/projects?status=unknown",
      "/api/projects?role=PROFESSOR",
    ]) {
      expect((await professor.get(path)).status).toBe(400);
    }
  });
  it("registra material com versão 1 somente para aluno do grupo em entrega aberta", async () => {
    const { client, repository } = context();
    const student = client(1);
    expect((await student.get("/api/projects/2/materials")).body.data).toEqual(
      [],
    );
    const first = await student
      .post("/api/projects/2/materials")
      .send(materialInput);
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
        sizeBytes: 2400,
        checksumSha256: null,
        uploadedBy: { id: 1, fullName: expect.any(String) },
      },
    });
    expect(first.body.data.versions).toHaveLength(1);
    expect(JSON.stringify(first.body)).not.toContain("storageKey");
    expect(
      (
        await student
          .post("/api/projects/2/materials")
          .send({ ...materialInput, title: " relatório TÉCNICO " })
      ).body.error.code,
    ).toBe("MATERIAL_ALREADY_EXISTS");
    expect(
      (
        await student
          .post("/api/projects/2/materials")
          .send({ ...materialInput, kind: "MANUAL", title: "Manual" })
      ).body.data.currentVersion.versionNumber,
    ).toBe(1);
    expect(
      (await student.get("/api/projects/2/materials")).body.data,
    ).toHaveLength(2);
    expect(
      (
        await student
          .post("/api/projects/2/materials")
          .send({ kind: "INVALID" })
      ).status,
    ).toBe(400);
    expect(
      (await client(3).post("/api/projects/2/materials").send(materialInput))
        .status,
    ).toBe(403);
    expect(
      (await client(2).post("/api/projects/1/materials").send(materialInput))
        .status,
    ).toBe(403);
    repository.get(2)!.status = "EM_AVALIACAO";
    expect(
      (
        await student
          .post("/api/projects/2/materials")
          .send({ ...materialInput, title: "Outro" })
      ).status,
    ).toBe(409);
    repository.get(2)!.status = "AJUSTES";
    expect(
      (
        await student
          .post("/api/projects/2/materials")
          .send({ ...materialInput, title: "Outro" })
      ).status,
    ).toBe(201);
  });
  it("substitui material criando nova versão e preservando o histórico", async () => {
    const { client, repository } = context();
    const student = client(1);
    const { originalFilename, mimeType, sizeBytes } = materialInput;
    const file = { originalFilename, mimeType, sizeBytes };
    await student.post("/api/projects/2/materials").send(materialInput);
    const replaced = await student
      .post("/api/projects/2/materials/1/versions")
      .send({ ...file, originalFilename: "relatorio-v2.pdf", sizeBytes: 3100 });
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.currentVersion).toMatchObject({
      versionNumber: 2,
      originalFilename: "relatorio-v2.pdf",
      sizeBytes: 3100,
    });
    expect(
      replaced.body.data.versions.map(
        (version: { versionNumber: number; originalFilename: string }) => [
          version.versionNumber,
          version.originalFilename,
        ],
      ),
    ).toEqual([
      [2, "relatorio-v2.pdf"],
      [1, "relatorio.pdf"],
    ]);
    const listed = (await student.get("/api/projects/2/materials")).body.data;
    expect(listed).toHaveLength(1);
    expect(listed[0].versions).toHaveLength(2);
    expect(
      (
        await student
          .post("/api/projects/2/materials/1/versions")
          .send({ ...file, kind: "VIDEO" })
      ).status,
    ).toBe(400);
    expect(
      (await student.post("/api/projects/2/materials/99/versions").send(file))
        .body.error.code,
    ).toBe("MATERIAL_NOT_FOUND");
    expect(
      (await student.post("/api/projects/2/materials/0/versions").send(file))
        .status,
    ).toBe(400);
    expect(
      (await client(3).post("/api/projects/2/materials/1/versions").send(file))
        .status,
    ).toBe(403);
    expect(
      (await client(2).post("/api/projects/2/materials/1/versions").send(file))
        .status,
    ).toBe(404);
    repository.get(2)!.status = "EM_AVALIACAO";
    expect(
      (await student.post("/api/projects/2/materials/1/versions").send(file))
        .body.error.code,
    ).toBe("PROJECT_LOCKED");
    expect(
      (await student.get("/api/projects/2/materials")).body.data[0].versions,
    ).toHaveLength(2);
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
        storageKey: "mock/1/video",
        checksumSha256: null,
        uploadedBy: 1,
      },
    );
    expect(() =>
      repository.addVersion(2, material.id, {
        ...material.versions[0],
      }),
    ).toThrow("Material não encontrado.");
    const student = client(1);
    const result = await student
      .post(`/api/projects/2/materials/${material.id}/versions`)
      .send({
        originalFilename: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
      });
    expect(result.status).toBe(404);
    expect(repository.getMaterial(1, material.id)?.versions).toHaveLength(1);
  });
  it("valida formato, tamanho e prazo informados no envio", async () => {
    const { client, repository } = context();
    const student = client(1);
    const send = (body: object) =>
      student
        .post("/api/projects/2/materials")
        .send({ ...materialInput, ...body });
    expect((await send({ mimeType: "video/mp4" })).body.error.code).toBe(
      "UNSUPPORTED_FORMAT",
    );
    expect((await send({ originalFilename: "relatorio.docx" })).status).toBe(
      415,
    );
    expect((await send({ sizeBytes: 0 })).body.error.code).toBe("EMPTY_FILE");
    expect((await send({ sizeBytes: 21 * 1024 * 1024 })).status).toBe(413);
    const video = await send({
      kind: "VIDEO",
      title: "Vídeo",
      originalFilename: "demo.mp4",
      mimeType: "video/mp4",
      sizeBytes: 400 * 1024 * 1024,
    });
    expect(video.status).toBe(201);
    expect(
      (
        await student
          .post(`/api/projects/2/materials/${video.body.data.id}/versions`)
          .send({
            originalFilename: "demo.pdf",
            mimeType: "application/pdf",
            sizeBytes: 5,
          })
      ).body.error.code,
    ).toBe("UNSUPPORTED_FORMAT");
    repository.get(2)!.dueAt = "2020-01-01T00:00:00.000Z";
    const late = await send({ title: "Atrasado" });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("DEADLINE_PASSED");
    expect(
      (
        await student
          .post(`/api/projects/2/materials/${video.body.data.id}/versions`)
          .send({
            originalFilename: "demo.mp4",
            mimeType: "video/mp4",
            sizeBytes: 5,
          })
      ).body.error.code,
    ).toBe("DEADLINE_PASSED");
    repository.get(2)!.status = "AJUSTES";
    expect((await send({ title: "Reaberto" })).status).toBe(201);
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
  it("remove acesso imediatamente quando o vínculo muda", async () => {
    const { auth, client } = context();
    const student = client(1),
      evaluator = client(2),
      professor = client(3);
    auth.directory.groups[1].memberIds = [];
    auth.directory.assignments = [];
    auth.directory.classes[0].professorId = 999;
    for (const actor of [student, evaluator, professor])
      expect((await actor.get("/api/projects")).body.data).toEqual([]);
    expect((await student.get("/api/projects/2")).status).toBe(404);
    expect((await evaluator.get("/api/projects/1")).status).toBe(404);
    expect((await professor.get("/api/projects/1")).status).toBe(404);
  });
  it("retorna apenas turmas e grupos próprios sem vazar integrantes", async () => {
    const { client } = context();
    expect((await client(1).get("/api/scope")).body.data).toEqual({
      classes: [],
      groups: [{ id: 2, classId: 1, name: "Grupo 02" }],
    });
    expect((await client(2).get("/api/scope")).body.data).toEqual({
      classes: [],
      groups: [],
    });
    expect((await client(3).get("/api/scope")).body.data.classes).toHaveLength(
      1,
    );
  });
  it("padroniza erros sem expor detalhes internos", async () => {
    const { app, client, repository } = context();
    expect(
      (
        await client(3)
          .post("/api/projects")
          .set("Content-Type", "application/json")
          .send("{invalid")
      ).body.error.code,
    ).toBe("INVALID_JSON");
    const logger = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(repository, "list").mockImplementation(() => {
      throw new Error("segredo interno");
    });
    const failed = await client(3).get("/api/projects");
    logger.mockRestore();
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain("segredo interno");
    expect((await request(app).get("/api/unknown")).body.error.code).toBe(
      "ROUTE_NOT_FOUND",
    );
  });
});
