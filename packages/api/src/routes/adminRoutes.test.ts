import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { context, projectInput, materialInput } from "../test/context.js";
function setup() {
  const ctx = context();
  ctx.auth.directory.users.push({
    id: 4,
    fullName: "Administrador",
    email: "admin@example.com",
    passwordHash: null,
    active: true,
    role: "ADMIN",
  });
  const token = ctx.auth.createSession(4, Date.now(), 60000);
  const client = {
    get: (path: string) =>
      request(ctx.app).get(path).set("Cookie", `labrary_session=${token}`),
    post: (path: string) =>
      request(ctx.app)
        .post(path)
        .set("Cookie", `labrary_session=${token}`)
        .set("X-CSRF-Protection", "1"),
    patch: (id: number, role: unknown) =>
      request(ctx.app)
        .patch(`/api/admin/users/${id}/role`)
        .set("Cookie", `labrary_session=${token}`)
        .set("X-CSRF-Protection", "1")
        .send({ role }),
  };
  return { ...ctx, admin: client, token };
}
describe("administração e visualização de perfis", () => {
  it("nega administração e mudança de visualização a perfis comuns e visitantes", async () => {
    const ctx = setup();
    expect((await request(ctx.app).get("/api/admin/users")).status).toBe(401);
    for (const id of [1, 2, 3]) {
      const token = ctx.auth.createSession(id, Date.now(), 60000);
      const cookie = `labrary_session=${token}`;
      expect(
        (
          await request(ctx.app)
            .get("/api/admin/users")
            .set("Cookie", cookie)
            .set("X-Role", "ADMIN")
        ).status,
      ).toBe(403);
      expect(
        (
          await request(ctx.app)
            .patch("/api/admin/users/1/role")
            .set("Cookie", cookie)
            .set("X-CSRF-Protection", "1")
            .send({ role: "ADMIN" })
        ).status,
      ).toBe(403);
      expect(
        (
          await ctx
            .client(id)
            .post("/api/auth/view-role")
            .send({ role: "PROFESSOR" })
        ).status,
      ).toBe(403);
    }
  });
  it("lista somente campos administrativos, promove outro administrador e preserva os vínculos", async () => {
    const ctx = setup();
    const users = (await ctx.admin.get("/api/admin/users")).body.data;
    expect(users).toHaveLength(4);
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(users[0]).not.toHaveProperty("googleLinked");
    const before = structuredClone(ctx.auth.directory.groups);
    expect((await ctx.admin.patch(1, "ADMIN")).body.data.role).toBe("ADMIN");
    expect(ctx.auth.directory.groups).toEqual(before);
    const newAdmin = ctx.client(1);
    expect((await newAdmin.get("/api/admin/users")).status).toBe(200);
    expect((await ctx.admin.patch(4, "ALUNO")).status).toBe(200);
    expect((await ctx.admin.get("/api/admin/users")).status).toBe(403);
  });
  it("protege o último administrador e valida ID, papel e campos inesperados", async () => {
    const ctx = setup();
    expect((await ctx.admin.patch(4, "ALUNO")).body.error.code).toBe(
      "LAST_ADMIN",
    );
    expect(ctx.auth.findById(4)?.role).toBe("ADMIN");
    expect((await ctx.admin.patch(4, "ADMIN")).status).toBe(200);
    expect((await ctx.admin.patch(999, "ALUNO")).status).toBe(404);
    expect((await ctx.admin.patch(1, "ROOT")).status).toBe(400);
    expect((await ctx.admin.patch(-1, "ADMIN")).status).toBe(400);
    expect(
      (
        await request(ctx.app)
          .patch("/api/admin/users/1/role")
          .set("Cookie", `labrary_session=${ctx.token}`)
          .set("X-CSRF-Protection", "1")
          .send({ role: "ADMIN", active: true })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(ctx.app)
          .patch("/api/admin/users/1/role")
          .set("Cookie", `labrary_session=${ctx.token}`)
          .send({ role: "ADMIN" })
      ).status,
    ).toBe(403);
    expect(
      (await ctx.admin.post("/api/auth/view-role").send({ role: "ADMIN" }))
        .status,
    ).toBe(400);
  });
  it("administração vê todos os projetos e pode criar para grupos de qualquer turma", async () => {
    const ctx = setup();
    expect((await ctx.admin.get("/api/projects")).body.data).toHaveLength(2);
    expect((await ctx.admin.get("/api/scope")).body.data.groups).toHaveLength(
      3,
    );
    expect(
      (await ctx.admin.post("/api/projects").send(projectInput)).status,
    ).toBe(201);
    expect(
      (await ctx.admin.post("/api/projects/2/materials").send(materialInput))
        .status,
    ).toBe(403);
    const message = await ctx.admin
      .post("/api/projects/2/messages")
      .send({
        clientMessageId: crypto.randomUUID(),
        body: "Mensagem administrativa",
      });
    expect(message.body.data.author.role).toBe("ADMIN");
  });
  it("a visualização é da própria conta e limita a autorização no servidor", async () => {
    const ctx = setup();
    for (const role of ["ALUNO", "AVALIADOR", "PROFESSOR"]) {
      const view = await ctx.admin.post("/api/auth/view-role").send({ role });
      expect(view.body.data).toMatchObject({
        id: 4,
        role: "ADMIN",
        viewRole: role,
      });
      expect((await ctx.admin.get("/api/projects")).body.data).toEqual([]);
      expect((await ctx.admin.get("/api/projects/1")).status).toBe(404);
      expect((await ctx.admin.get("/api/admin/users")).status).toBe(200);
      expect((await ctx.admin.get("/api/auth/me")).body.data.viewRole).toBe(
        role,
      );
    }
    const anotherSession = ctx.client(4);
    expect(
      (await anotherSession.get("/api/auth/me")).body.data.viewRole,
    ).toBeUndefined();
    await ctx.admin.post("/api/auth/view-role").send({ role: null });
    expect((await ctx.admin.get("/api/projects")).body.data).toHaveLength(2);
  });
  it("prévia respeita vínculos, não altera identidade e ignora prévia antiga após perder ADMIN", async () => {
    const ctx = setup();
    ctx.auth.directory.groups[1].memberIds.push(4);
    await ctx.admin.post("/api/auth/view-role").send({ role: "ALUNO" });
    expect(
      (await ctx.admin.get("/api/projects")).body.data.map(
        (p: { id: number }) => p.id,
      ),
    ).toEqual([2]);
    const message = await ctx.admin
      .post("/api/projects/2/messages")
      .send({
        clientMessageId: crypto.randomUUID(),
        body: "Mensagem em prévia",
      });
    expect(message.body.data.author).toMatchObject({ id: 4, role: "ADMIN" });
    await ctx.admin.patch(1, "ADMIN");
    expect((await ctx.admin.patch(4, "AVALIADOR")).status).toBe(200);
    const me = await ctx.admin.get("/api/auth/me");
    expect(me.body.data.role).toBe("AVALIADOR");
    expect(me.body.data.viewRole).toBeUndefined();
    expect(
      (await ctx.admin.post("/api/auth/view-role").send({ role: null })).status,
    ).toBe(403);
  });
  it("trata expiração entre autenticação e atualização da prévia", async () => {
    const ctx = setup();
    vi.spyOn(ctx.auth, "setViewRole").mockReturnValue(false);
    expect(
      (await ctx.admin.post("/api/auth/view-role").send({ role: "ALUNO" }))
        .status,
    ).toBe(401);
  });
});
