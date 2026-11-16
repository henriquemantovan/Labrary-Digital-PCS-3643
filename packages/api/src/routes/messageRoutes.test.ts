import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { context, storedMaterial, versionInput } from "../test/context.js";

const input = () => ({
  clientMessageId: randomUUID(),
  body: "Podemos revisar a temporização?",
  materialVersionId: null,
});
describe("HU07: feedback privado", () => {
  it("conversa entre aluno, avaliador atribuído e professor com autor, data e versão fixa", async () => {
    const { auth, repository, client } = context({
      now: () => Date.parse("2026-11-02T12:00:00.000Z"),
    });
    auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
    const material = storedMaterial(repository, 2);
    const version = material.versions[0];
    const sent = await client(1)
      .post("/api/projects/2/messages")
      .send({ ...input(), materialVersionId: version.id });
    expect(sent.status).toBe(201);
    expect(sent.body.data).toMatchObject({
      author: { id: 1, fullName: "Marina Oliveira", role: "ALUNO" },
      createdAt: "2026-11-02T12:00:00.000Z",
      materialVersion: { id: version.id, versionNumber: 1 },
    });
    repository.addVersion(2, material.id, versionInput);
    for (const actor of [2, 3])
      expect(
        (await client(actor).post("/api/projects/2/messages").send(input()))
          .status,
      ).toBe(201);
    const messages = await client(1).get("/api/projects/2/messages");
    expect(
      messages.body.data.map(
        (item: { author: { id: number } }) => item.author.id,
      ),
    ).toEqual([1, 2, 3]);
    expect(messages.body.data[0].materialVersion.versionNumber).toBe(1);
    expect(messages.body.data[1].materialVersion).toBeNull();
    expect(messages.body.data[0].author).not.toHaveProperty("email");
  });
  it("não permite leitura/envio sem vínculo ou sessão, nem CSRF", async () => {
    const { app, auth, client } = context();
    for (const [actor, project] of [
      [1, 1],
      [2, 2],
    ] as const) {
      expect(
        (await client(actor).get(`/api/projects/${project}/messages`)).status,
      ).toBe(404);
      expect(
        (
          await client(actor)
            .post(`/api/projects/${project}/messages`)
            .send(input())
        ).status,
      ).toBe(404);
    }
    expect((await request(app).get("/api/projects/2/messages")).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .post("/api/projects/2/messages")
          .set("X-CSRF-Protection", "1")
          .send(input())
      ).status,
    ).toBe(401);
    expect(
      (
        await client(1)
          .post("/api/projects/2/messages")
          .set("X-CSRF-Protection", "")
          .send(input())
      ).status,
    ).toBe(403);
    auth.directory.assignments = [];
    auth.directory.groups[1].memberIds = [];
    auth.directory.classes[0].professorId = 999;
    for (const actor of [1, 2, 3])
      expect((await client(actor).get("/api/projects/2/messages")).status).toBe(
        404,
      );
    expect((await client(3).get("/api/projects/999/messages")).status).toBe(
      404,
    );
  });
  it("valida texto, contexto e identidade sem aceitar autor do cliente", async () => {
    const { repository, client } = context();
    const other = storedMaterial(repository, 1).versions[0];
    for (const patch of [
      { body: "  " },
      { body: "a".repeat(5001) },
      { clientMessageId: "inválido" },
      { authorId: 3 },
      { materialVersionId: -1 },
    ]) {
      expect(
        (
          await client(1)
            .post("/api/projects/2/messages")
            .send({ ...input(), ...patch })
        ).status,
      ).toBe(400);
    }
    for (const materialVersionId of [other.id, 999])
      expect(
        (
          await client(1)
            .post("/api/projects/2/messages")
            .send({ ...input(), materialVersionId })
        ).status,
      ).toBe(404);
    expect((await client(1).get("/api/projects/abc/messages")).status).toBe(
      400,
    );
    const result = await client(1)
      .post("/api/projects/2/messages")
      .send({ ...input(), body: " <script>alert(1)</script> " });
    expect(result.body.data.body).toBe("<script>alert(1)</script>");
  });
  it("repetir envio após resposta perdida não duplica; alteração do payload conflita", async () => {
    const { client } = context();
    const message = input();
    const first = await client(1)
      .post("/api/projects/2/messages")
      .send(message);
    const retry = await client(1)
      .post("/api/projects/2/messages")
      .send(message);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    expect(
      (
        await client(1)
          .post("/api/projects/2/messages")
          .send({ ...message, body: "Outro texto" })
      ).status,
    ).toBe(409);
    expect(
      (await client(1).get("/api/projects/2/messages")).body.data,
    ).toHaveLength(1);
  });
  it("informa erro de armazenamento sem confirmar envio", async () => {
    const { client, repository } = context();
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(repository, "createMessage").mockImplementation(() => {
      throw new Error("disco");
    });
    expect(
      (await client(1).post("/api/projects/2/messages").send(input())).status,
    ).toBe(500);
    expect((await client(1).get("/api/projects/2/messages")).body.data).toEqual(
      [],
    );
    logger.mockRestore();
  });
});
