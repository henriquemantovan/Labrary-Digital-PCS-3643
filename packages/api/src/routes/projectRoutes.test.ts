import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { createMemoryProjectRepository } from "../repositories/projectRepository.js";

describe("API REST de projetos e materiais", () => {
  it("lista projetos de demonstração e filtra por estado", async () => {
    const app = createApp();
    const allProjects = await request(app).get("/api/projects");
    const preparation = await request(app).get("/api/projects?status=PREPARACAO");
    const classProjects = await request(app).get("/api/projects?classId=1");

    expect(allProjects.status).toBe(200);
    expect(allProjects.body.data).toHaveLength(2);
    expect(preparation.body.data).toHaveLength(1);
    expect(preparation.body.data[0].status).toBe("PREPARACAO");
    expect(classProjects.body.data).toHaveLength(2);
  });

  it("responde à verificação de saúde e consulta um projeto", async () => {
    const app = createApp();
    const health = await request(app).get("/api/health");
    const project = await request(app).get("/api/projects/1");

    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe("ok");
    expect(project.status).toBe(200);
    expect(project.body.data.title).toBe("Controlador de semáforo inteligente");
  });

  it("cria projeto válido com estado inicial de preparação", async () => {
    const response = await request(createApp())
      .post("/api/projects")
      .send({ classId: 1, groupId: 3, title: "Contador síncrono", category: "Lógica digital" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: 3,
      classId: 1,
      groupId: 3,
      title: "Contador síncrono",
      description: "",
      status: "PREPARACAO",
    });
  });

  it("retorna erros de validação no formato comum", async () => {
    const response = await request(createApp())
      .post("/api/projects")
      .send({ classId: 0, groupId: -2, title: "  ", category: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "classId" }),
      expect.objectContaining({ path: "title" }),
    ]));
  });

  it("retorna 409 quando o grupo já tem projeto", async () => {
    const response = await request(createApp())
      .post("/api/projects")
      .send({ classId: 1, groupId: 1, title: "Projeto duplicado", category: "Lógica digital" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("GROUP_ALREADY_HAS_PROJECT");
  });

  it("registra metadados de material e retorna a lista do projeto", async () => {
    const app = createApp();
    const created = await request(app)
      .post("/api/projects/1/materials")
      .send({
        kind: "RELATORIO",
        title: "Relatório técnico",
        originalFilename: "relatorio.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2_400,
      });
    const listed = await request(app).get("/api/projects/1/materials");

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ projectId: 1, versionNumber: 1, storageKey: "mock/1/1" });
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
  });

  it("rejeita materiais inválidos e projetos inexistentes", async () => {
    const app = createApp();
    const invalid = await request(app).post("/api/projects/1/materials").send({ kind: "ARQUIVO" });
    const missing = await request(app).get("/api/projects/999/materials");

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("incrementa a versão de materiais com o mesmo título", async () => {
    const app = createApp();
    const material = {
      kind: "RELATORIO",
      title: "Relatório técnico",
      originalFilename: "relatorio.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_400,
    };
    const first = await request(app).post("/api/projects/1/materials").send(material);
    const second = await request(app).post("/api/projects/1/materials").send(material);

    expect(first.body.data.versionNumber).toBe(1);
    expect(second.body.data.versionNumber).toBe(2);
  });

  it("trata JSON malformado com erro HTTP padronizado", async () => {
    const response = await request(createApp())
      .post("/api/projects")
      .set("Content-Type", "application/json")
      .send("{invalido");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("esconde detalhes inesperados em uma resposta 500", async () => {
    const repository = createMemoryProjectRepository();
    const failingRepository = {
      ...repository,
      list: () => { throw new Error("informação interna"); },
    };
    const errorLogger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request(createApp({ repository: failingRepository })).get("/api/projects");
    errorLogger.mockRestore();

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro interno.",
    });
    expect(JSON.stringify(response.body)).not.toContain("informação interna");
  });

  it("mantém resposta padronizada para caminhos desconhecidos", async () => {
    const response = await request(createApp()).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });
});
