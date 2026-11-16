import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";
import { defaultRequirements } from "../models/rubric.js";

const path = "/api/projects/2/configuration";
const input = () => ({
  baseVersionId: 0,
  title: "Rubrica da entrega",
  requirements: defaultRequirements("2026-11-25T23:59:00-03:00"),
  criteria: [
    { id: "funcionamento", title: "Funcionamento", description: "Demonstração", weight: 60, minScore: 0, maxScore: 10 },
    { id: "documentacao", title: "Documentação", description: "Clareza", weight: 40, minScore: 0, maxScore: 10 },
  ],
});

describe("C0: requisitos e versões imutáveis da rubrica", () => {
  it("exige autenticação em todas as leituras e mutações e mantém proteção CSRF", async () => {
    const { app, client } = context();
    for (const suffix of ["", "/versions", "/versions/1"])
      expect((await request(app).get(`${path}${suffix}`)).status).toBe(401);
    expect((await request(app).post(`${path}/versions`).set("X-CSRF-Protection", "1").send(input())).status).toBe(401);
    const post = client(3).post(`${path}/versions`).unset("X-CSRF-Protection");
    expect((await post.send(input())).status).toBe(403);
  });

  it("cria uma versão com prazo/formato e preserva a anterior ao mudar a configuração", async () => {
    const { client } = context({ now: () => Date.parse("2026-11-08T12:00:00Z") });
    const professor = client(3);
    expect((await professor.get(path)).body.data).toBeNull();
    expect((await professor.get(`${path}/versions`)).body.data).toEqual([]);
    const created = await professor.post(`${path}/versions`).send(input());
    expect(created.status).toBe(201);
    const v1 = created.body.data;
    expect(v1).toMatchObject({ id: 1, projectId: 2, classId: 1, versionNumber: 1, createdBy: 3, createdAt: "2026-11-08T12:00:00.000Z" });
    const change = { ...input(), baseVersionId: v1.id, title: "Segunda configuração" };
    change.criteria[0].weight = 50;
    change.criteria[1].weight = 50;
    change.requirements[0].dueAt = "2026-11-27T00:00:00Z";
    expect((await professor.post(`${path}/versions`).send(change)).status).toBe(201);
    const history = (await professor.get(`${path}/versions`)).body.data;
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(v1);
    expect(history[1]).toMatchObject({ id: 2, versionNumber: 2, title: change.title });
    expect((await client(1).get(path)).body.data).toEqual(history[1]);
    expect((await client(1).get(`${path}/versions/1`)).body.data).toEqual(v1);
    expect((await professor.get(`${path}/versions/999`)).status).toBe(404);
    expect((await professor.get("/api/projects/1/configuration/versions/1")).status).toBe(404);
    const conflict = await professor.post(`${path}/versions`).send(change);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("RUBRIC_VERSION_CONFLICT");
  });

  it("permite leitura atribuída, nega gravação ao aluno/avaliador e oculta outros projetos", async () => {
    const { client, auth } = context();
    expect((await client(1).post(`${path}/versions`).send(input())).status).toBe(403);
    expect((await client(2).post("/api/projects/1/configuration/versions").send(input())).status).toBe(403);
    expect((await client(3).post("/api/projects/1/configuration/versions").send(input())).status).toBe(201);
    expect((await client(2).get("/api/projects/1/configuration")).status).toBe(200);
    expect((await client(1).get("/api/projects/1/configuration")).status).toBe(404);
    expect((await client(2).get(path)).status).toBe(404);
    expect((await client(3).get("/api/projects/999/configuration")).status).toBe(404);
    expect((await client(3).get("/api/projects/no/configuration")).status).toBe(400);
    auth.directory.classes[0].professorId = 999;
    expect((await client(3).post(`${path}/versions`).send(input())).status).toBe(404);
  });

  it.each([
    ["peso zero", (v: ReturnType<typeof input>) => { v.criteria[0].weight = 0; }],
    ["soma diferente de 100", (v: ReturnType<typeof input>) => { v.criteria[0].weight = 59; }],
    ["peso com precisão excessiva", (v: ReturnType<typeof input>) => { v.criteria[0].weight = 60.001; }],
    ["escala modificada", (v: ReturnType<typeof input>) => { v.criteria[0].maxScore = 20; }],
    ["critério duplicado", (v: ReturnType<typeof input>) => { v.criteria[1].id = v.criteria[0].id; }],
    ["sem critérios", (v: ReturnType<typeof input>) => { v.criteria = []; }],
    ["formato não suportado", (v: ReturnType<typeof input>) => { v.requirements[0].allowedMimeTypes = ["text/html"]; }],
    ["tipo inadequado", (v: ReturnType<typeof input>) => { v.requirements[1].allowedMimeTypes = ["video/mp4"]; }],
    ["formato repetido", (v: ReturnType<typeof input>) => { v.requirements[0].allowedMimeTypes = ["video/mp4", "video/mp4"]; }],
    ["tamanho zero", (v: ReturnType<typeof input>) => { v.requirements[0].maxSizeBytes = 0; }],
    ["tamanho fracionário", (v: ReturnType<typeof input>) => { v.requirements[0].maxSizeBytes = 1.1; }],
    ["prazo inválido", (v: ReturnType<typeof input>) => { v.requirements[0].dueAt = "2026-02-30T10:00:00Z"; }],
    ["prazo sem timezone", (v: ReturnType<typeof input>) => { v.requirements[0].dueAt = "2026-11-25T10:00:00"; }],
    ["material ausente", (v: ReturnType<typeof input>) => { v.requirements.pop(); }],
    ["material duplicado", (v: ReturnType<typeof input>) => { v.requirements[2] = v.requirements[1]; }],
  ])("rejeita %s sem criar versão", async (_label, mutate) => {
    const { client } = context();
    const value = input();
    mutate(value);
    expect((await client(3).post(`${path}/versions`).send(value)).status).toBe(400);
    expect((await client(3).get(`${path}/versions`)).body.data).toEqual([]);
  });

  it("aceita pesos decimais exatos e impede campos de autoria fornecidos pelo cliente", async () => {
    const { client } = context();
    const value = input();
    value.criteria[0].weight = 33.33;
    value.criteria[1].weight = 66.67;
    expect((await client(3).post(`${path}/versions`).send({ ...value, createdBy: 1 })).status).toBe(400);
    expect((await client(3).post(`${path}/versions`).send(value)).status).toBe(201);
  });
});
