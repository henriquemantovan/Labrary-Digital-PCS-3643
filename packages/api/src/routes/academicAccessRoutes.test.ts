import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";

const now = Date.parse("2026-11-22T12:00:00Z");
const profile = {
  fullName: "Marina Nome Completo",
  uspNumber: "12345678",
  entryYear: 2024,
};
function setup() {
  const ctx = context({ now: () => now });
  Object.assign(ctx.auth.directory.users[0], {
    email: "marina@usp.br",
    googleLinked: true,
  });
  ctx.auth.directory.users.push({
    ...ctx.auth.directory.users[2],
    id: 4,
    role: "ADMIN",
    email: "admin@usp.br",
    googleLinked: true,
  });
  return { ...ctx, student: ctx.client(1), admin: ctx.client(4) };
}

describe("cadastro acadêmico e convidados", () => {
  it("bloqueia a área privada até concluir o cadastro, sem bloquear o acervo ou o logout", async () => {
    const app = setup();
    expect(
      (await app.student.get("/api/auth/me")).body.data.requiresAcademicProfile,
    ).toBe(true);
    for (const path of [
      "/api/scope",
      "/api/projects",
      "/api/projects/2/materials",
      "/api/classes/1/administration",
    ]) {
      const response = await app.student.get(path);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ACADEMIC_PROFILE_REQUIRED");
    }
    expect((await request(app.app).get("/api/catalog")).status).toBe(200);
    const saved = await app.student.post("/api/auth/profile").send(profile);
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({
      ...profile,
      requiresAcademicProfile: false,
      role: "ALUNO",
      email: "marina@usp.br",
    });
    expect((await app.student.get("/api/projects")).status).toBe(200);
    expect((await app.student.get("/api/auth/me")).body.data).toMatchObject(
      profile,
    );
    expect((await app.student.post("/api/auth/logout")).status).toBe(204);
  });

  it("valida os dados, evita NUSP duplicado e nunca aceita identidade ou papel enviados pelo cliente", async () => {
    const app = setup();
    expect(
      (
        await request(app.app)
          .post("/api/auth/profile")
          .set("X-CSRF-Protection", "1")
          .send(profile)
      ).status,
    ).toBe(401);
    expect(
      (
        await app.student
          .post("/api/auth/profile")
          .unset("X-CSRF-Protection")
          .send(profile)
      ).status,
    ).toBe(403);
    for (const input of [
      { ...profile, fullName: "Marina" },
      { ...profile, fullName: "   " },
      { ...profile, uspNumber: "abc" },
      { ...profile, uspNumber: "" },
      { ...profile, entryYear: 2027 },
      { ...profile, entryYear: 1899 },
      { ...profile, entryYear: 2024.5 },
      { ...profile, role: "ADMIN" },
      { ...profile, userId: 3 },
      { ...profile, guest: true },
    ])
      expect(
        (await app.student.post("/api/auth/profile").send(input)).status,
      ).toBe(400);
    app.auth.directory.users[1].uspNumber = profile.uspNumber;
    expect(
      (await app.student.post("/api/auth/profile").send(profile)).body.error
        .code,
    ).toBe("USP_NUMBER_IN_USE");
    expect(app.auth.findById(1)?.academicProfileCompleted).not.toBe(true);
    expect(
      (await app.client(3).post("/api/auth/profile").send(profile)).status,
    ).toBe(403);
  });

  it("somente administrador autoriza e revoga convidados, preservando histórico e sem conceder perfis", async () => {
    const app = setup();
    expect((await request(app.app).get("/api/admin/guests")).status).toBe(401);
    for (const user of [2, 3]) {
      expect(
        (
          await app
            .client(user)
            .post("/api/admin/guests")
            .send({ email: "externo@gmail.com" })
        ).status,
      ).toBe(403);
      expect(
        (await app.client(user).delete("/api/admin/guests/1")).status,
      ).toBe(403);
    }
    expect(
      (
        await app.admin
          .post("/api/admin/guests")
          .send({ email: "aluno@usp.br" })
      ).body.error.code,
    ).toBe("GUEST_NOT_REQUIRED");
    expect(
      (await app.admin.post("/api/admin/guests").send({ email: "inválido" }))
        .status,
    ).toBe(400);
    expect(
      (
        await app.admin
          .post("/api/admin/guests")
          .send({ email: "externo@gmail.com", role: "ADMIN" })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.admin
          .post("/api/admin/guests")
          .unset("X-CSRF-Protection")
          .send({ email: "externo@gmail.com" })
      ).status,
    ).toBe(403);
    const first = await app.admin
      .post("/api/admin/guests")
      .send({ email: "EXTERNO@gmail.com" });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      email: "externo@gmail.com",
      invitedBy: 4,
      revokedAt: null,
    });
    expect(
      (
        await app.admin
          .post("/api/admin/guests")
          .send({ email: "externo@gmail.com" })
      ).body.data.id,
    ).toBe(first.body.data.id);
    app.auth.directory.users.push({
      ...app.auth.directory.users[1],
      id: 5,
      email: "externo@gmail.com",
      googleLinked: true,
      guest: true,
    });
    const guest = app.client(5);
    expect((await guest.get("/api/auth/me")).body.data).toMatchObject({
      role: "AVALIADOR",
      guest: true,
      requiresAcademicProfile: false,
    });
    expect((await app.admin.delete("/api/admin/guests/999")).status).toBe(404);
    expect(
      (await app.admin.delete(`/api/admin/guests/${first.body.data.id}`))
        .status,
    ).toBe(204);
    expect((await guest.get("/api/auth/me")).status).toBe(401);
    expect(
      (await app.admin.delete(`/api/admin/guests/${first.body.data.id}`))
        .status,
    ).toBe(204);
    const second = await app.admin
      .post("/api/admin/guests")
      .send({ email: "externo@gmail.com" });
    expect(second.body.data.id).not.toBe(first.body.data.id);
    expect((await app.admin.get("/api/admin/guests")).body.data).toHaveLength(
      2,
    );
    expect((await guest.get("/api/auth/me")).status).toBe(401);
    expect(app.auth.findById(5)?.role).toBe("AVALIADOR");
  });

  it("administrador convidado não pode revogar o próprio acesso", async () => {
    const app = setup();
    const entry = (
      await app.admin
        .post("/api/admin/guests")
        .send({ email: "admin.externo@gmail.com" })
    ).body.data;
    app.auth.directory.users.push({
      ...app.auth.directory.users[3],
      id: 5,
      email: entry.email,
      guest: true,
    });
    expect(
      (await app.client(5).delete(`/api/admin/guests/${entry.id}`)).body.error
        .code,
    ).toBe("OWN_INVITATION");
  });
});
