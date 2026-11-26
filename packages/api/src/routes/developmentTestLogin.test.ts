import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";
import { hashPassword } from "../services/password.js";
import { developmentTestAccounts, developmentTestPassword } from "../services/developmentTestAccounts.js";

const passwordHash = await hashPassword(developmentTestPassword);
function setup(enabled = true) {
  const ctx = context({ localLogin: false });
  ctx.auth.developmentTestLogin = enabled;
  ctx.auth.directory.users.push(...developmentTestAccounts.map((person, i) => ({
    id: i + 4, ...person, passwordHash, active: true, googleLinked: false,
    guest: person.email === "convidado@labrary.test",
  })));
  const login = (email = "aluno@labrary.test", password = developmentTestPassword) =>
    request(ctx.app).post("/api/auth/login").set("X-CSRF-Protection", "1").send({ email, password });
  return { ...ctx, login };
}

describe("exceção de login das contas de teste", () => {
  it("continua desabilitada por padrão no modo Google", async () => {
    const ctx = setup(false);
    expect((await request(ctx.app).get("/api/auth/providers")).body.data).toEqual({ google: false, local: false });
    expect((await ctx.login()).body.error.code).toBe("LOCAL_LOGIN_DISABLED");
  });
  it("permite as oito contas cadastradas, mantendo papel, senha e sessão privados", async () => {
    const ctx = setup();
    expect((await request(ctx.app).get("/api/auth/providers")).body.data).toEqual({ google: false, local: true, testLogin: true });
    for (const person of developmentTestAccounts) {
      const response = await ctx.login(person.email);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ email: person.email, role: person.role });
      expect(response.body.data).not.toHaveProperty("passwordHash");
      expect(response.body.data).not.toHaveProperty("googleLinked", true);
      const cookie = response.headers["set-cookie"][0];
      expect(cookie).toContain("HttpOnly");
      expect((await request(ctx.app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    }
  });
  it("não libera senha para contas comuns, mesmo com credenciais válidas", async () => {
    const ctx = setup();
    expect((await ctx.login("aluno@labrary.local", "Labrary@2026")).body.error.code).toBe("INVALID_CREDENTIALS");
    expect((await ctx.login("outro@labrary.test")).status).toBe(401);
    expect((await ctx.login(undefined, "senha incorreta")).status).toBe(401);
    const response = await request(ctx.app).post("/api/auth/login").set("X-CSRF-Protection", "1")
      .send({ email: "aluno@labrary.test", password: developmentTestPassword, role: "ADMIN" });
    expect(response.status).toBe(401);
    expect((await request(ctx.app).post("/api/auth/login").send({ email: "aluno@labrary.test", password: developmentTestPassword })).status).toBe(403);
  });
  it("relê contas provisionadas no banco antes de conferir a credencial", async () => {
    const ctx = setup();
    const person = ctx.auth.findByEmail("aluno@labrary.test")!;
    ctx.auth.directory.users = ctx.auth.directory.users.filter((user) => user.id !== person.id);
    Object.assign(ctx.auth, { refresh: async () => { ctx.auth.directory.users.push(person); } });
    expect((await ctx.login()).status).toBe(200);
  });
  it("recusa contas desativadas, vinculadas ao Google ou sem hash de senha", async () => {
    for (const change of [{ active: false }, { googleLinked: true }, { passwordHash: null }]) {
      const ctx = setup();
      Object.assign(ctx.auth.findByEmail("aluno@labrary.test")!, change);
      expect((await ctx.login()).status).toBe(401);
      expect((await ctx.client(7).get("/api/auth/me")).status).toBe(401);
    }
  });
  it("desligar a exceção invalida sessões abertas sem afetar contas normais", async () => {
    const ctx = setup();
    const response = await ctx.login();
    const cookie = response.headers["set-cookie"][0];
    ctx.auth.developmentTestLogin = false;
    for (const path of ["/api/auth/me", "/api/projects", "/api/admin/users", "/api/scope"])
      expect((await request(ctx.app).get(path).set("Cookie", cookie)).status).toBe(401);
    const token = cookie.split(";")[0].split("=")[1];
    expect(await ctx.auth.getSession(token, Date.now())).toBeUndefined();
    expect((await ctx.client(1).get("/api/auth/me")).status).toBe(200);
  });
  it("um ADMIN fictício não substitui a proteção do último administrador real", async () => {
    const ctx = setup();
    ctx.auth.directory.users.push({ id: 100, fullName: "Gestor Real", email: "gestor@usp.br", role: "ADMIN", active: true, passwordHash: null });
    const cookie = (await ctx.login("admin@labrary.test")).headers["set-cookie"][0];
    const change = (id: number) => request(ctx.app).patch(`/api/admin/users/${id}/role`).set("Cookie", cookie).set("X-CSRF-Protection", "1").send({ role: "ALUNO" });
    expect((await change(100)).body.error.code).toBe("LAST_ADMIN");
    expect(ctx.auth.findById(100)?.role).toBe("ADMIN");
    expect((await change(4)).status).toBe(200);
    expect(ctx.auth.findById(4)?.role).toBe("ALUNO");
  });
  it("permite demonstrar o cadastro somente na conta reservada e exige conclusão antes da área privada", async () => {
    const ctx = setup();
    const signed = await ctx.login("cadastro@labrary.test");
    expect(signed.body.data).toMatchObject({ developmentTest: true, requiresAcademicProfile: true });
    expect(signed.body.data.googleLinked).not.toBe(true);
    const cookie = signed.headers["set-cookie"][0];
    expect((await request(ctx.app).get("/api/projects").set("Cookie", cookie)).body.error.code).toBe("ACADEMIC_PROFILE_REQUIRED");
    const save = (input: object) => request(ctx.app).post("/api/auth/profile").set("Cookie", cookie).set("X-CSRF-Protection", "1").send(input);
    expect((await save({ fullName: "Nome", uspNumber: "x", entryYear: 1800 })).status).toBe(400);
    ctx.auth.findById(1)!.uspNumber = "90000001";
    expect((await save({ fullName: "Aluno Fictício", uspNumber: "90000001", entryYear: 2024 })).status).toBe(409);
    const valid = { fullName: "Aluno Fictício", uspNumber: "90000002", entryYear: 2024 };
    expect((await save(valid)).body.data).toMatchObject({ ...valid, developmentTest: true, requiresAcademicProfile: false });
    expect((await request(ctx.app).get("/api/projects").set("Cookie", cookie)).status).toBe(200);
    const other = ctx.client(7);
    expect((await other.post("/api/auth/profile").send(valid)).status).toBe(403);
    ctx.auth.developmentTestLogin = false;
    expect((await save(valid)).status).toBe(401);
  });
  it("convidado fictício exige convite ativo, perde a sessão na revogação e pode ser convidado novamente", async () => {
    const ctx = setup();
    const guest = ctx.auth.findByEmail("convidado@labrary.test")!;
    guest.guest = false;
    expect((await ctx.login(guest.email)).status).toBe(401);
    const invited = await ctx.client(4).post("/api/admin/guests").send({ email: guest.email });
    expect(invited.status).toBe(201);
    const signed = await ctx.login(guest.email);
    expect(signed.status).toBe(200);
    expect(signed.body.data).toMatchObject({ guest: true, requiresAcademicProfile: false, developmentTest: true });
    const cookie = signed.headers["set-cookie"][0];
    expect((await ctx.client(4).delete(`/api/admin/guests/${invited.body.data.id}`)).status).toBe(204);
    expect((await request(ctx.app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await ctx.login(guest.email)).status).toBe(401);
    expect((await ctx.client(4).post("/api/admin/guests").send({ email: guest.email })).status).toBe(201);
    expect((await ctx.login(guest.email)).status).toBe(200);
  });
});
