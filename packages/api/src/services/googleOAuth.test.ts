import { describe, it, expect, vi } from "vitest";
import { generateKeyPair } from "jose";
import { createGoogleOAuth } from "./googleOAuth.js";
import {
  googleKeys,
  googleNow,
  googleConfig,
  signGoogleToken,
} from "../test/google.js";
import { loadGoogleConfig } from "./googleConfiguration.js";
const clientWith = (transport: typeof fetch) =>
  createGoogleOAuth(googleConfig, {
    keys: googleKeys,
    transport,
    now: () => googleNow,
  });
describe("Google OpenID Connect", () => {
  it("solicita código, state, nonce e PKCE sem colocar segredo na URL", () => {
    const url = new URL(
      clientWith(vi.fn()).authorizationUrl("state", "nonce", "verifier"),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "test-client",
      redirect_uri: googleConfig.callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state: "state",
      nonce: "nonce",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("code_challenge")).toBe(
      "iMnq5o6zALKXGivsnlom_0F5_WYda32GHkxlV7mq7hQ",
    );
    expect(url.href).not.toContain("test-secret");
  });
  it("troca o código no servidor e valida assinatura e identidade", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ id_token: await signGoogleToken() })),
      );
    const profile = await clientWith(transport).profile(
      "code",
      "verifier",
      "nonce",
    );
    expect(profile).toEqual({
      subject: "google-123",
      fullName: "Maria Google",
      email: "maria@gmail.com",
      emailVerified: true,
    });
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init?.redirect).toBe("error");
    expect(Object.fromEntries(init?.body as URLSearchParams)).toMatchObject({
      grant_type: "authorization_code",
      code: "code",
      code_verifier: "verifier",
      client_secret: "test-secret",
    });
  });
  it.each([
    { iss: "https://evil.example" },
    { aud: "other-client" },
    { exp: googleNow / 1000 - 60 },
    { nonce: "other-nonce" },
    { azp: "other-client" },
    { email_verified: false },
    { sub: "" },
    { email: "invalid" },
    { iat: googleNow / 1000 + 120 },
    { exp: undefined },
    { nonce: undefined },
    { aud: ["test-client", "other-client"] },
  ])("rejeita claims inválidas %j", async (patch) => {
    const token = await signGoogleToken(patch);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id_token: token })));
    await expect(
      clientWith(transport).profile("code", "verifier", "nonce"),
    ).rejects.toMatchObject({ code: "GOOGLE_AUTH_FAILED" });
  });
  it("rejeita assinatura de outra chave", async () => {
    const forged = await generateKeyPair("RS256");
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id_token: await signGoogleToken({}, forged.privateKey),
          }),
        ),
      );
    await expect(
      clientWith(transport).profile("code", "verifier", "nonce"),
    ).rejects.toMatchObject({ status: 502 });
  });
  it.each(["http", "network", "missing", "invalid"])(
    "trata falha %s",
    async (mode) => {
      const transport = vi.fn<typeof fetch>();
      if (mode === "network") transport.mockRejectedValue(new Error("private"));
      else
        transport.mockResolvedValue(
          mode === "http"
            ? new Response("private", { status: 500 })
            : new Response(mode === "missing" ? "{}" : "invalid"),
        );
      await expect(
        clientWith(transport).profile("code", "v", "n"),
      ).rejects.toMatchObject({ code: "GOOGLE_AUTH_FAILED" });
    },
  );
  it("usa e-mail como nome quando ausente e normaliza o e-mail", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id_token: await signGoogleToken({
              name: undefined,
              email: "MARIA@gmail.com",
              azp: "test-client",
              aud: ["test-client", "other-client"],
            }),
          }),
        ),
      );
    expect(
      await clientWith(transport).profile("c", "v", "nonce"),
    ).toMatchObject({ fullName: "MARIA@gmail.com", email: "maria@gmail.com" });
  });
  it("instancia o cliente padrão com chaves remotas do Google", () => {
    expect(
      createGoogleOAuth(googleConfig).authorizationUrl("s", "n", "v"),
    ).toContain("accounts.google.com");
  });
});
describe("configuração Google", () => {
  const env = {
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    DATABASE_URL: "postgres://localhost/test",
  };
  it("exige configuração completa e exclui contas locais", () => {
    expect(loadGoogleConfig({}, "http://localhost:5173")).toBeUndefined();
    expect(
      loadGoogleConfig(
        { ...env, AUTH_PROVIDER: "local" },
        "http://localhost:5173",
      ),
    ).toBeUndefined();
    expect(loadGoogleConfig(env, "http://localhost:5173")).toMatchObject({
      callbackUrl: "http://localhost:5173/api/auth/google/callback",
    });
    for (const patch of [
      { GOOGLE_CLIENT_SECRET: "" },
      { GOOGLE_CLIENT_ID: "" },
      { DATABASE_URL: "" },
      { AUTH_DEMO: "true" },
      { AUTH_USERS_FILE: "file" },
      { AUTH_PROVIDER: "usp" },
    ])
      expect(() =>
        loadGoogleConfig({ ...env, ...patch }, "http://localhost:5173"),
      ).toThrow();
    expect(() =>
      loadGoogleConfig({ AUTH_PROVIDER: "google" }, "http://localhost:5173"),
    ).toThrow();
  });
  it("valida a origem e permite HTTP apenas local fora de produção", () => {
    expect(
      loadGoogleConfig(
        { ...env, NODE_ENV: "production" },
        "https://labrary.example",
      ),
    ).toBeTruthy();
    for (const origin of [
      "http://evil.example",
      "https://x/?a=b",
      "https://x/#hash",
      "https://user:pass@x",
      "https://x/path",
      "invalid",
    ])
      expect(() => loadGoogleConfig(env, origin)).toThrow();
    expect(() =>
      loadGoogleConfig(
        { ...env, NODE_ENV: "production" },
        "http://localhost:5173",
      ),
    ).toThrow();
  });
});
