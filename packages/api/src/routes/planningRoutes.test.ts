import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";
import { createMemoryPlanningRepository } from "../repositories/planningRepository.js";

const requirements = ["VIDEO", "RELATORIO", "MANUAL"].map((kind) => ({
  kind,
  label: kind,
  required: true,
  allowedMimeTypes: ["application/pdf"],
  maxSizeBytes: 1000,
  dueAt: "2026-10-28T23:00:00Z",
}));
const rubric = {
  baseVersion: 0,
  title: "Rubrica",
  criteria: [
    {
      title: "Projeto",
      description: "Funcionamento",
      weight: 70,
      minScore: 0,
      maxScore: 10,
    },
    {
      title: "Documentação",
      description: "Clareza",
      weight: 30,
      minScore: 0,
      maxScore: 10,
    },
  ],
};
describe("HU02/HU03", () => {
  it("autentica todos os novos prefixos e protege PUT contra CSRF", async () => {
    const { app, client } = context();
    for (const path of [
      "/api/classes/1/administration",
      "/api/projects/1/requirements",
      "/api/projects/1/rubrics",
      "/api/projects/1/evaluators",
    ])
      expect((await request(app).get(path)).status).toBe(401);
    expect(
      (
        await client(3)
          .put("/api/projects/1/requirements")
          .unset("X-CSRF-Protection")
          .send({ requirements })
      ).status,
    ).toBe(403);
  });
  it("cadastra grupos apenas na turma própria e atualiza o escopo", async () => {
    const { client, auth } = context();
    const teacher = client(3);
    expect((await client(1).get("/api/classes/1/administration")).status).toBe(
      403,
    );
    expect((await teacher.get("/api/classes/99/administration")).status).toBe(
      404,
    );
    const overview = (await teacher.get("/api/classes/1/administration")).body
      .data;
    expect(overview.groups).toHaveLength(3);
    expect(overview.people).toEqual([
      { id: 1, fullName: "Marina Oliveira", role: "ALUNO" },
      { id: 2, fullName: "Rafael Costa", role: "AVALIADOR" },
    ]);
    const group = await teacher
      .post("/api/classes/1/groups")
      .send({ name: "Grupo 04" });
    expect(group.status).toBe(201);
    expect(group.body.data).toMatchObject({ id: 4, classId: 1, memberIds: [] });
    expect((await teacher.get("/api/scope")).body.data.groups).toContainEqual({
      id: 4,
      classId: 1,
      name: "Grupo 04",
    });
    expect(
      (await teacher.post("/api/classes/1/groups").send({ name: "Grupo 04" }))
        .status,
    ).toBe(409);
    expect(
      (await teacher.post("/api/classes/1/groups").send({ name: " " })).status,
    ).toBe(400);
    expect(
      (await client(2).post("/api/classes/1/groups").send({ name: "x" }))
        .status,
    ).toBe(403);
    // Empty directories still start IDs at 1.
    auth.directory.groups = [];
    expect(
      (await teacher.post("/api/classes/1/groups").send({ name: "Primeiro" }))
        .body.data.id,
    ).toBe(1);
  });
  it("preserva antes/depois dos integrantes e revoga acesso na sessão existente", async () => {
    const { client } = context({
      now: () => Date.parse("2026-10-23T12:00:00Z"),
    });
    const teacher = client(3),
      student = client(1);
    expect((await student.get("/api/projects/2")).status).toBe(200);
    expect((await student.get("/api/projects/2")).body.data.academicYear).toBe(
      2026,
    );
    const removed = await teacher
      .put("/api/classes/1/groups/2/members")
      .send({ memberIds: [] });
    expect(removed.status).toBe(200);
    expect(removed.body.data.history[0]).toMatchObject({
      before: [1],
      after: [],
      changedBy: 3,
      changedAt: "2026-10-23T12:00:00.000Z",
    });
    expect((await student.get("/api/projects/2")).status).toBe(404);
    await teacher
      .put("/api/classes/1/groups/2/members")
      .send({ memberIds: [1] });
    expect((await student.get("/api/projects/2")).status).toBe(200);
    const groups = (await teacher.get("/api/classes/1/administration")).body
      .data.groups;
    expect(
      groups.find((group: { id: number }) => group.id === 2).history,
    ).toHaveLength(2);
    expect(
      groups.find((group: { id: number }) => group.id === 2).history[0].after,
    ).toEqual([]);
    for (const memberIds of [[2], [999], [1, 1]])
      expect(
        (
          await teacher
            .put("/api/classes/1/groups/2/members")
            .send({ memberIds })
        ).status,
      ).toBe(400);
    expect(
      (
        await teacher
          .put("/api/classes/1/groups/99/members")
          .send({ memberIds: [] })
      ).status,
    ).toBe(404);
  });
  it("preserva o histórico dos avaliadores sem permitir vínculo de perfil inválido", async () => {
    const { client, auth } = context();
    const teacher = client(3),
      evaluator = client(2);
    expect((await teacher.get("/api/projects/1/evaluators")).body.data).toEqual(
      { evaluatorIds: [2], history: [] },
    );
    await teacher.put("/api/projects/1/evaluators").send({ evaluatorIds: [] });
    expect((await evaluator.get("/api/projects/1")).status).toBe(404);
    const restored = await teacher
      .put("/api/projects/1/evaluators")
      .send({ evaluatorIds: [2] });
    expect(restored.body.data.history).toHaveLength(2);
    expect(restored.body.data.history[0].before).toEqual([2]);
    expect((await evaluator.get("/api/projects/1")).status).toBe(200);
    for (const evaluatorIds of [[1], [999], [2, 2]])
      expect(
        (await teacher.put("/api/projects/1/evaluators").send({ evaluatorIds }))
          .status,
      ).toBe(400);
    auth.directory.users.find((user) => user.id === 2)!.active = false;
    expect(
      (
        await teacher
          .put("/api/projects/1/evaluators")
          .send({ evaluatorIds: [2] })
      ).status,
    ).toBe(400);
    expect((await client(1).get("/api/projects/2/evaluators")).status).toBe(
      403,
    );
  });
  it("configura os três materiais com limites e prazos explícitos sem inventar defaults", async () => {
    const { client } = context();
    const teacher = client(3);
    expect(
      (await teacher.get("/api/projects/2/requirements")).body.data,
    ).toEqual([]);
    expect(
      (await teacher.put("/api/projects/2/requirements").send({ requirements }))
        .body.data,
    ).toEqual(requirements);
    expect(
      (await client(1).get("/api/projects/2/requirements")).body.data,
    ).toEqual(requirements);
    for (const invalid of [
      requirements.slice(1),
      [requirements[0], requirements[0], requirements[2]],
      [{ ...requirements[0], maxSizeBytes: 0 }, ...requirements.slice(1)],
      [{ ...requirements[0], allowedMimeTypes: [] }, ...requirements.slice(1)],
      [{ ...requirements[0], required: false }, ...requirements.slice(1)],
      [{ ...requirements[0], dueAt: "amanhã" }, ...requirements.slice(1)],
      [
        { ...requirements[0], allowedMimeTypes: ["*.pdf"] },
        ...requirements.slice(1),
      ],
    ])
      expect(
        (
          await teacher
            .put("/api/projects/2/requirements")
            .send({ requirements: invalid })
        ).status,
      ).toBe(400);
    expect(
      (await teacher.get("/api/projects/2/requirements")).body.data,
    ).toEqual(requirements);
  });
  it("cria versões imutáveis com pesos positivos somando 100 e escala 0–10", async () => {
    const { client } = context();
    const teacher = client(3);
    expect((await teacher.get("/api/projects/1/rubrics")).body.data).toEqual(
      [],
    );
    const first = await teacher.post("/api/projects/1/rubrics").send(rubric);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      id: 1,
      versionNumber: 1,
      createdBy: 3,
      criteria: rubric.criteria,
    });
    expect(
      (await teacher.post("/api/projects/1/rubrics").send(rubric)).status,
    ).toBe(409);
    const second = await teacher
      .post("/api/projects/1/rubrics")
      .send({ ...rubric, baseVersion: 1, title: "Revisão" });
    expect(second.body.data).toMatchObject({
      id: 2,
      versionNumber: 2,
      title: "Revisão",
    });
    expect((await client(2).get("/api/projects/1/rubrics")).body.data).toEqual([
      first.body.data,
      second.body.data,
    ]);
    const other = await teacher.post("/api/projects/2/rubrics").send(rubric);
    expect(other.body.data.versionNumber).toBe(3); // Prisma versions are per class.
    for (const criteria of [
      [],
      [{ ...rubric.criteria[0], weight: 99 }],
      [{ ...rubric.criteria[0], weight: 0 }],
      [{ ...rubric.criteria[0], weight: 100, maxScore: 20 }],
      [{ ...rubric.criteria[0], weight: 99.999 }],
    ])
      expect(
        (
          await teacher
            .post("/api/projects/1/rubrics")
            .send({ ...rubric, baseVersion: 2, criteria })
        ).status,
      ).toBe(400);
  });
  it("nega escrita de outros perfis e leitura/escrita de outra turma ou grupo", async () => {
    const { client, auth } = context();
    for (const suffix of ["requirements", "rubrics"]) {
      expect((await client(1).get(`/api/projects/1/${suffix}`)).status).toBe(
        404,
      );
      expect((await client(2).get(`/api/projects/2/${suffix}`)).status).toBe(
        404,
      );
    }
    expect(
      (
        await client(1)
          .put("/api/projects/2/requirements")
          .send({ requirements })
      ).status,
    ).toBe(403);
    expect(
      (await client(2).post("/api/projects/1/rubrics").send(rubric)).status,
    ).toBe(403);
    expect((await client(3).get("/api/projects/999/rubrics")).status).toBe(404);
    auth.directory.classes[0].professorId = 999;
    expect(
      (
        await client(3)
          .put("/api/projects/1/evaluators")
          .send({ evaluatorIds: [] })
      ).status,
    ).toBe(404);
    expect(
      (
        await client(3)
          .put("/api/projects/1/requirements")
          .send({ requirements })
      ).status,
    ).toBe(404);
  });
  it("o adapter não entrega referências mutáveis aos snapshots", () => {
    const repository = createMemoryPlanningRepository();
    const input = requirements as Parameters<
      typeof repository.saveRequirements
    >[1];
    repository.saveRequirements(1, input);
    const read = repository.requirements(1);
    read[0].allowedMimeTypes.push("text/plain");
    expect(repository.requirements(1)[0].allowedMimeTypes).toEqual([
      "application/pdf",
    ]);
    const version = repository.createRubric(
      {
        ...rubric,
        projectId: 1,
        classId: 1,
        createdBy: 3,
        createdAt: "now",
      } as Parameters<typeof repository.createRubric>[0],
      0,
    );
    version.criteria[0].weight = 1;
    const versions = repository.rubrics(1);
    versions[0].criteria[0].weight = 2;
    expect(repository.rubrics(1)[0].criteria[0].weight).toBe(70);
  });
});
