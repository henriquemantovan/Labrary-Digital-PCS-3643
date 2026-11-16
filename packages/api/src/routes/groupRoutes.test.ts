import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";
describe("HU02 — grupos e vínculos", () => {
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
  it("exige sessão e protege os novos prefixos contra CSRF", async () => {
    const { app, client } = context();
    for (const path of [
      "/api/classes/1/administration",
      "/api/projects/1/evaluators",
    ])
      expect((await request(app).get(path)).status).toBe(401);
    expect(
      (
        await client(3)
          .put("/api/classes/1/groups/2/members")
          .unset("X-CSRF-Protection")
          .send({ memberIds: [] })
      ).status,
    ).toBe(403);
  });
});

it("isola turmas e projetos e não expõe credenciais nas contas selecionáveis", async () => {
  const { auth, client, repository } = context();
  auth.directory.users.push({
    ...auth.directory.users[2],
    id: 10,
    email: "outra@example.com",
  });
  auth.directory.classes.push({
    id: 2,
    name: "Outra turma",
    academicYear: 2026,
    professorId: 10,
  });
  auth.directory.groups.push({
    id: 4,
    classId: 2,
    name: "Grupo externo",
    memberIds: [],
  });
  const external = repository.create({
    classId: 2,
    groupId: 4,
    title: "Privado",
    category: "Digital",
  });
  const teacher = client(3);
  expect((await teacher.get("/api/classes/2/administration")).status).toBe(404);
  expect(
    (await teacher.post("/api/classes/2/groups").send({ name: "Invasão" }))
      .status,
  ).toBe(404);
  expect(
    (
      await teacher
        .put("/api/classes/1/groups/4/members")
        .send({ memberIds: [1] })
    ).status,
  ).toBe(404);
  for (const method of ["get", "put"] as const)
    expect(
      (
        await teacher[method](`/api/projects/${external.id}/evaluators`).send(
          method === "put" ? { evaluatorIds: [2] } : undefined,
        )
      ).status,
    ).toBe(404);
  expect((await teacher.get("/api/classes/1/administration")).text).not.toMatch(
    /passwordHash|email|google_subject|googleLinked/,
  );
  for (const input of [
    { memberIds: [-1] },
    { memberIds: [1], role: "ADMIN" },
    { memberIds: "1" },
  ])
    expect(
      (await teacher.put("/api/classes/1/groups/2/members").send(input)).status,
    ).toBe(400);
  expect((await teacher.get("/api/classes/abc/administration")).status).toBe(
    400,
  );
});
it("usa IDs reais de contas Google e ADMIN respeitando a visualização acadêmica", async () => {
  const { auth, client } = context();
  auth.directory.users.push({
    ...auth.directory.users[0],
    id: 105,
    email: "google@example.com",
    googleLinked: true,
    passwordHash: null,
  });
  auth.directory.users.push({
    ...auth.directory.users[2],
    id: 200,
    email: "admin@example.com",
    role: "ADMIN",
    passwordHash: null,
    googleLinked: true,
  });
  const admin = client(200);
  expect(
    (
      await admin
        .put("/api/classes/1/groups/3/members")
        .send({ memberIds: [105, 200] })
    ).status,
  ).toBe(200);
  expect(
    (
      await admin
        .put("/api/projects/1/evaluators")
        .send({ evaluatorIds: [200] })
    ).body.data.history[0].changedBy,
  ).toBe(200);
  expect(
    (await admin.post("/api/auth/view-role").send({ role: "PROFESSOR" }))
      .status,
  ).toBe(200);
  expect((await admin.get("/api/classes/1/administration")).status).toBe(404);
  await admin.post("/api/auth/view-role").send({ role: "ALUNO" });
  expect(
    (await admin.post("/api/classes/1/groups").send({ name: "Vedado" })).status,
  ).toBe(403);
});
