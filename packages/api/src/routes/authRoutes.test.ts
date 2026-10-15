import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { context } from "../test/context.js";

const cookieOf = (response: { headers: Record<string, unknown> }) =>
  (response.headers["set-cookie"] as string[])[0].split(";")[0];
describe("HU01: autenticação e sessão", () => {
  it.each(["aluno", "avaliador", "professor"])(
    "autentica %s e restaura a sessão sem expor hashes",
    async (role) => {
      const { login, app } = context();
      const result = await login(`${role.toUpperCase()}@LABRARY.LOCAL`);
      expect(result.status).toBe(200);
      expect(result.body.data.role).toBe(role.toUpperCase());
      expect(result.body.data).not.toHaveProperty("passwordHash");
      expect(result.body.data).not.toHaveProperty("active");
      const cookie = result.headers["set-cookie"][0];
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Path=/api");
      expect(cookie).not.toContain("Secure");
      const me = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieOf(result));
      expect(me.body.data).toEqual(result.body.data);
      expect(me.headers["cache-control"]).toBe("no-store");
    },
  );
  it("usa o mesmo erro para senha incorreta, usuário inexistente, inativo e dados inválidos", async () => {
    const { login, auth, app } = context();
    const wrong = await login("aluno@labrary.local", "incorrect");
    const missing = await login("unknown@example.com");
    auth.directory.users[0].active = false;
    const inactive = await login();
    const malformed = await login("not-an-email", "");
    const forged = await request(app)
      .post("/api/auth/login")
      .set("X-CSRF-Protection", "1")
      .send({
        email: "aluno@labrary.local",
        password: "Labrary@2026",
        role: "PROFESSOR",
      });
    for (const result of [wrong, missing, inactive, malformed, forged]) {
      expect(result.status).toBe(401);
      expect(result.body).toEqual(wrong.body);
      expect(result.headers["set-cookie"]).toBeUndefined();
    }
  });
  it("invalida a sessão no servidor e permite logout repetido", async () => {
    const { login, app } = context();
    const cookie = cookieOf(await login());
    const result = await request(app)
      .post("/api/auth/logout")
      .set("X-CSRF-Protection", "1")
      .set("Cookie", cookie);
    expect(result.status).toBe(204);
    expect(result.headers["set-cookie"][0]).toContain(
      "Expires=Thu, 01 Jan 1970",
    );
    expect(
      (await request(app).get("/api/projects").set("Cookie", cookie)).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/auth/logout")
          .set("X-CSRF-Protection", "1")
      ).status,
    ).toBe(204);
  });
  it("rotaciona a sessão e rejeita tokens fabricados", async () => {
    const { login, app } = context();
    const first = cookieOf(await login());
    const second = cookieOf(
      await login("professor@labrary.local", "Labrary@2026", first),
    );
    expect(first).not.toBe(second);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", first)).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Cookie", `unrelated=1; ${second}`)
      ).body.data.role,
    ).toBe("PROFESSOR");
    for (const cookie of [
      "labrary_session=fake",
      "labrary_session=%ZZ",
      "other=123",
    ])
      expect(
        (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
      ).toBe(401);
  });
  it("expira sessões e remove sessões antigas na criação", async () => {
    let now = 10_000;
    const { login, app } = context({ now: () => now, sessionTtlMs: 1000 });
    const first = cookieOf(await login());
    const second = cookieOf(await login());
    now += 1000;
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", first)).status,
    ).toBe(401);
    await login();
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", second)).status,
    ).toBe(401);
  });
  it("nega conta desativada e não recupera sua sessão ao reativar", async () => {
    const { login, auth, app } = context();
    const cookie = cookieOf(await login());
    auth.directory.users[0].active = false;
    expect(
      (await request(app).get("/api/projects").set("Cookie", cookie)).status,
    ).toBe(401);
    auth.directory.users[0].active = true;
    expect(
      (await request(app).get("/api/projects").set("Cookie", cookie)).status,
    ).toBe(401);
  });
  it("limita tentativas por IP, ignora X-Forwarded-For não confiável e libera após a janela", async () => {
    let now = 1_000;
    const { app, login } = context({ now: () => now, loginLimit: 2 });
    await login("unknown@example.com");
    await login("unknown@example.com");
    const blocked = await request(app)
      .post("/api/auth/login")
      .set("X-CSRF-Protection", "1")
      .set("X-Forwarded-For", "8.8.8.8")
      .send({ email: "aluno@labrary.local", password: "Labrary@2026" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBe("900");
    now += 900_000;
    expect((await login()).status).toBe(200);
  });
  it("exige cabeçalho CSRF e rejeita origens externas em login/logout/escritas", async () => {
    const { app } = context();
    for (const path of [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/projects",
      "/api/projects/2/materials",
    ]) {
      expect((await request(app).post(path).send({})).status).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set("X-CSRF-Protection", "1")
            .set("Origin", "https://evil.example")
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(path)
            .set("X-CSRF-Protection", "1")
            .set("Sec-Fetch-Site", "cross-site")
            .send({})
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app)
          .options("/api/auth/login")
          .set("Origin", "https://evil.example")
      ).headers["access-control-allow-origin"],
    ).toBeUndefined();
    expect(
      (
        await request(app)
          .post("/api/auth/logout")
          .set("X-CSRF-Protection", "1")
          .set("Origin", "http://localhost:5173")
      ).status,
    ).toBe(204);
  });
  it("usa Secure em HTTPS e não habilita contas de demonstração por padrão", async () => {
    const { login } = context({ secureCookies: true });
    expect((await login()).headers["set-cookie"][0]).toContain("Secure");
    const app = createApp();
    const result = await request(app)
      .post("/api/auth/login")
      .set("X-CSRF-Protection", "1")
      .send({ email: "aluno@labrary.local", password: "Labrary@2026" });
    expect(result.status).toBe(401);
  });
});
