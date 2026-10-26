import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { context } from "../test/context.js";
import { UspProfile } from "../services/uspOAuth.js";

const profile: UspProfile = {
  loginUsuario: "1234567",
  nomeUsuario: "Maria USP",
  emailUspUsuario: "maria@usp.br",
  vinculo: [{ tipoVinculo: "ALUNO" }],
};
function setup(extra = {}) {
  let now = 0;
  const client = {
    requestToken: vi.fn(async () => ({
      token: "temporary",
      secret: "private",
    })),
    authorizationUrl: vi.fn(
      () => "https://uspdigital.usp.br/authorize?oauth_token=temporary",
    ),
    profile: vi.fn(async () => profile),
  };
  const saveProfile = vi.fn(async () => ({
    id: 50,
    fullName: "Maria USP",
    email: "maria@usp.br",
    passwordHash: null,
    active: true,
    role: "ALUNO" as const,
    uspNumber: "1234567",
    uspAffiliations: profile.vinculo,
  }));
  const ctx = context({
    now: () => now,
    secureCookies: true,
    usp: { client, saveProfile, origin: "https://labrary.example" },
    ...extra,
  });
  const start = () => request(ctx.app).get("/api/auth/usp");
  const callback = (
    cookie?: string,
    query = "oauth_token=temporary&oauth_verifier=approved",
  ) => {
    const call = request(ctx.app).get(`/api/auth/usp/callback?${query}`);
    return cookie ? call.set("Cookie", cookie) : call;
  };
  return {
    ...ctx,
    client,
    saveProfile,
    start,
    callback,
    expire: () => {
      now += 600_001;
    },
  };
}
const cookieOf = (res: request.Response) =>
  (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
describe("Senha Única HTTP", () => {
  it("retorna ao login quando a USP falha ao iniciar a autenticação", async () => {
    const ctx = setup();
    ctx.client.requestToken.mockRejectedValue(new Error("network"));
    const result = await ctx.start();
    expect(result.headers.location).toContain("authError=usp");
    expect(result.headers["set-cookie"]).toBeUndefined();
  });
  it("informa os provedores, desabilita senha local e não expõe segredos", async () => {
    const ctx = setup();
    expect(
      (await request(ctx.app).get("/api/auth/providers")).body.data,
    ).toEqual({ usp: true, local: false });
    expect((await ctx.login()).status).toBe(403);
    const start = await ctx.start();
    expect(start.status).toBe(302);
    expect(start.headers.location).toContain("https://uspdigital.usp.br/");
    expect(start.headers["set-cookie"][0]).toMatch(
      /HttpOnly; Secure; SameSite=Lax/,
    );
    expect(JSON.stringify(start.headers)).not.toContain("private");
  });
  it("cria sessão, restaura identidade e impede reutilizar callback", async () => {
    const ctx = setup();
    const state = cookieOf(await ctx.start());
    const result = await ctx.callback(state);
    expect(result.headers.location).toBe("https://labrary.example/projetos");
    expect(ctx.saveProfile).toHaveBeenCalledWith(profile);
    const cookies = result.headers["set-cookie"] as unknown as string[];
    const session = cookies
      .find((c) => c.startsWith("labrary_session="))!
      .split(";")[0];
    const me = await request(ctx.app)
      .get("/api/auth/me")
      .set("Cookie", session);
    expect(me.body.data.uspNumber).toBe("1234567");
    expect(me.body.data).not.toHaveProperty("passwordHash");
    expect(
      (await request(ctx.app).get("/api/projects").set("Cookie", session)).body
        .data,
    ).toEqual([]);
    expect((await ctx.callback(state)).headers.location).toContain(
      "authError=usp",
    );
    expect(ctx.saveProfile).toHaveBeenCalledTimes(1);
  });
  it("atualiza usuário já autenticado e permite logout", async () => {
    const ctx = setup();
    ctx.saveProfile.mockResolvedValue({
      ...ctx.auth.directory.users[0],
      uspNumber: "1234567",
      uspAffiliations: profile.vinculo,
    });
    const old = ctx.auth.createSession(1, 0, 10_000);
    const state = cookieOf(await ctx.start());
    const result = await ctx.callback(`${state}; labrary_session=${old}`);
    expect(ctx.auth.getSession(old, 0)).toBeUndefined();
    const session = (result.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("labrary_session="))!
      .split(";")[0];
    expect(
      (
        await request(ctx.app)
          .post("/api/auth/logout")
          .set("Cookie", session)
          .set("X-CSRF-Protection", "1")
      ).status,
    ).toBe(204);
    expect(
      (await request(ctx.app).get("/api/auth/me").set("Cookie", session))
        .status,
    ).toBe(401);
  });
  it.each([
    "oauth_token=wrong&oauth_verifier=x",
    "oauth_token=temporary",
    "oauth_token=temporary&oauth_verifier=",
    "oauth_token=temporary&oauth_verifier=x&oauth_verifier=y",
  ])("rejeita callback inválido: %s", async (query) => {
    const ctx = setup();
    const state = cookieOf(await ctx.start());
    expect((await ctx.callback(state, query)).headers.location).toContain(
      "authError=usp",
    );
    expect(ctx.client.profile).not.toHaveBeenCalled();
  });
  it("rejeita estado ausente e expirado", async () => {
    const ctx = setup();
    expect((await ctx.callback()).headers.location).toContain("authError=usp");
    const state = cookieOf(await ctx.start());
    ctx.expire();
    expect((await ctx.callback(state)).headers.location).toContain(
      "authError=usp",
    );
    await ctx.start();
    ctx.expire();
    await ctx.start();
    expect(ctx.client.profile).not.toHaveBeenCalled();
  });
  it.each(["provider", "database", "inactive"])(
    "não cria sessão em falha %s",
    async (failure) => {
      const ctx = setup();
      if (failure === "provider")
        ctx.client.profile.mockRejectedValue(new Error("upstream"));
      if (failure === "database")
        ctx.saveProfile.mockRejectedValue(new Error("db"));
      if (failure === "inactive")
        ctx.saveProfile.mockResolvedValue({
          ...(await ctx.saveProfile(profile)),
          active: false,
        });
      const result = await ctx.callback(cookieOf(await ctx.start()));
      expect(result.headers.location).toContain("authError=usp");
      expect(JSON.stringify(result.headers["set-cookie"])).not.toContain(
        "labrary_session=",
      );
    },
  );
  it("limita tentativas pendentes", async () => {
    const ctx = setup();
    for (let i = 0; i < 1000; i++) await ctx.start();
    expect((await ctx.start()).status).toBe(429);
    ctx.expire();
    expect((await ctx.start()).status).toBe(302);
  });
});
