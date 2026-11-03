import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { context } from "../test/context.js";
import { createMemoryOAuthAttempts } from "../repositories/oauthAttemptRepository.js";
import { ApiError } from "../errors.js";
import { GoogleProfile } from "../services/googleOAuth.js";
const profile: GoogleProfile = {
  subject: "google-123",
  fullName: "Maria Google",
  email: "maria@gmail.com",
  emailVerified: true,
};
function setup(extra = {}) {
  let now = 0;
  const client = {
    authorizationUrl: vi.fn(
      (state: string) =>
        `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    ),
    profile: vi.fn(async () => profile),
  };
  const attempts = createMemoryOAuthAttempts();
  const saveProfile = vi.fn(async () => ({
    id: 50,
    fullName: profile.fullName,
    email: profile.email,
    active: true,
    passwordHash: null,
    role: "ALUNO" as const,
    googleLinked: true,
  }));
  const ctx = context({
    now: () => now,
    secureCookies: true,
    google: {
      client,
      attempts,
      saveProfile,
      origin: "https://labrary.example",
    },
    ...extra,
  });
  const start = () => request(ctx.app).get("/api/auth/google");
  const callback = (cookie?: string, query?: string) => {
    const state = cookie?.split(";")[0].split("=")[1] ?? "";
    const call = request(ctx.app).get(
      `/api/auth/google/callback?${query ?? `state=${state}&code=approved`}`,
    );
    return cookie ? call.set("Cookie", cookie) : call;
  };
  return {
    ...ctx,
    client,
    attempts,
    saveProfile,
    start,
    callback,
    expire: () => {
      now += 15 * 60_000 + 1;
    },
  };
}
const cookieOf = (response: request.Response) =>
  (response.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
const sessionOf = (response: request.Response) =>
  (response.headers["set-cookie"] as unknown as string[])
    .find((s) => s.startsWith("labrary_session="))!
    .split(";")[0];
describe("login Google", () => {
  it("oferece Google, desabilita senha local e inicia tentativa HttpOnly", async () => {
    const ctx = setup();
    expect(
      (await request(ctx.app).get("/api/auth/providers")).body.data,
    ).toEqual({ google: true, local: false });
    expect((await ctx.login()).body.error.code).toBe("LOCAL_LOGIN_DISABLED");
    const start = await ctx.start();
    expect(start.status).toBe(302);
    expect(start.headers.location).toContain("https://accounts.google.com/");
    expect(start.headers["set-cookie"][0]).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
    const state = cookieOf(start).split("=")[1];
    expect(ctx.client.authorizationUrl).toHaveBeenCalledWith(
      state,
      expect.any(String),
      expect.any(String),
    );
  });
  it("cria/restaura sessão, expõe perfil e impede replay do callback", async () => {
    const ctx = setup();
    const cookie = cookieOf(await ctx.start());
    const result = await ctx.callback(cookie);
    expect(result.headers.location).toBe("https://labrary.example/projetos");
    const session = sessionOf(result);
    const me = await request(ctx.app)
      .get("/api/auth/me")
      .set("Cookie", session);
    expect(me.body.data).toEqual({
      id: 50,
      fullName: profile.fullName,
      email: profile.email,
      role: "ALUNO",
      googleLinked: true,
    });
    expect(ctx.saveProfile).toHaveBeenCalledWith(profile);
    expect((await ctx.callback(cookie)).headers.location).toContain(
      "authError=google",
    );
    expect(ctx.saveProfile).toHaveBeenCalledTimes(1);
    expect(
      (await request(ctx.app).get("/api/projects").set("Cookie", session)).body
        .data,
    ).toEqual([]);
  });
  it("rotaciona a sessão anterior, atualiza conta existente e revoga no logout", async () => {
    const ctx = setup();
    ctx.saveProfile.mockResolvedValue({
      ...ctx.auth.directory.users[0],
      googleLinked: true,
    });
    const old = ctx.auth.createSession(1, 0, 10000);
    const result = await ctx.callback(
      `${cookieOf(await ctx.start())}; labrary_session=${old}`,
    );
    expect(await ctx.auth.getSession(String(old), 0)).toBeUndefined();
    const session = sessionOf(result);
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
  it("recusa callback sem cookie ou state correspondente", async () => {
    const ctx = setup();
    expect((await ctx.callback()).headers.location).toContain(
      "authError=google",
    );
    const cookie = cookieOf(await ctx.start());
    for (const query of [
      "state=other&code=x",
      "state=x&state=y&code=z",
      "code=x",
    ])
      expect((await ctx.callback(cookie, query)).headers.location).toContain(
        "authError=google",
      );
    expect(ctx.client.profile).not.toHaveBeenCalled();
  });
  it.each(["denied", "missing", "empty", "duplicate", "long", "expired"])(
    "recusa retorno %s e consome tentativa",
    async (mode) => {
      const ctx = setup();
      const cookie = cookieOf(await ctx.start());
      const state = cookie.split("=")[1];
      const query = {
        denied: `state=${state}&error=access_denied`,
        missing: `state=${state}`,
        empty: `state=${state}&code=`,
        duplicate: `state=${state}&code=x&code=y`,
        long: `state=${state}&code=${"x".repeat(4097)}`,
        expired: `state=${state}&code=x`,
      }[mode]!;
      if (mode === "expired") ctx.expire();
      expect((await ctx.callback(cookie, query)).headers.location).toContain(
        "authError=google",
      );
      expect(ctx.client.profile).not.toHaveBeenCalled();
      expect((await ctx.callback(cookie)).headers.location).toContain(
        "authError=google",
      );
    },
  );
  it.each(["provider", "database", "inactive", "conflict", "session"])(
    "não autentica em falha %s",
    async (mode) => {
      const ctx = setup();
      if (mode === "provider")
        ctx.client.profile.mockRejectedValue(new Error("private"));
      if (mode === "database")
        ctx.saveProfile.mockRejectedValue(new Error("db"));
      if (mode === "inactive")
        ctx.saveProfile.mockResolvedValue({
          ...(await ctx.saveProfile(profile)),
          active: false,
        });
      if (mode === "conflict")
        ctx.saveProfile.mockRejectedValue(
          new ApiError(409, "GOOGLE_ACCOUNT_CONFLICT", "private"),
        );
      if (mode === "session")
        vi.spyOn(ctx.auth, "createSession").mockRejectedValue(new Error("db"));
      const result = await ctx.callback(cookieOf(await ctx.start()));
      expect(result.headers.location).toContain(
        `authError=${mode === "inactive" ? "inactive" : mode === "conflict" ? "account_conflict" : "google"}`,
      );
      expect(JSON.stringify(result.headers["set-cookie"])).not.toContain(
        "labrary_session=",
      );
    },
  );
  it("retorna erro recuperável quando o armazenamento de tentativas falha", async () => {
    const ctx = setup();
    vi.spyOn(ctx.attempts, "save").mockRejectedValue(new Error("offline"));
    expect((await ctx.start()).headers.location).toContain("authError=google");
  });
  it("limita tentativas por IP e libera após o prazo", async () => {
    const ctx = setup({ loginLimit: 1 });
    await ctx.start();
    const limited = await ctx.start();
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("900");
    ctx.expire();
    expect((await ctx.start()).status).toBe(302);
  });
  it("limpa tentativas antigas em memória", async () => {
    const attempts = createMemoryOAuthAttempts();
    await attempts.save("old", { nonce: "n", verifier: "v", expiresAt: 1 }, 0);
    await attempts.save("new", { nonce: "n", verifier: "v", expiresAt: 3 }, 2);
    expect(await attempts.consume("old", 2)).toBeUndefined();
    expect(await attempts.consume("new", 2)).toMatchObject({ nonce: "n" });
    expect(await attempts.consume("new", 2)).toBeUndefined();
  });
});
