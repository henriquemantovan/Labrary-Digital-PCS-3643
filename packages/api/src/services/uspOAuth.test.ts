import { describe, expect, it, vi } from "vitest";
import {
  createUspOAuth,
  oauthHeader,
  profileEmail,
  profileRole,
  UspProfile,
  uspProfileSchema,
} from "./uspOAuth.js";
import { loadUspConfig } from "./uspConfiguration.js";
const config = {
  key: "consumer",
  secret: "secret",
  callbackId: "0",
  callbackUrl: "https://app.example/api/auth/usp/callback",
  baseUrl: "https://uspdigital.usp.br/wsusuario/oauth",
};
const profile: UspProfile = {
  loginUsuario: "123",
  nomeUsuario: "Pessoa USP",
  emailUspUsuario: "pessoa@usp.br",
  vinculo: [{ tipoVinculo: "ALUNO" }],
};
describe("cliente USP", () => {
  it("normaliza parâmetros OAuth repetidos como a referência USPdev/league", () => {
    const header = oauthHeader(
      "https://example.com/access_token?oauth_verifier=approved",
      "key",
      "secret",
      { token: "temp", secret: "temp-secret" },
      {},
      "fixed",
      "123",
      { oauth_verifier: "approved", oauth_token: "temp" },
    );
    expect(header).toContain(
      'oauth_signature="h1%2FzSnvcFPS%2BVZNa7CCFvp24Ujg%3D"',
    );
  });
  it("aceita campos opcionais nulos e código de unidade numérico", () => {
    const parsed = uspProfileSchema.parse({
      ...profile,
      emailPrincipalUsuario: null,
      vinculo: [
        {
          tipoVinculo: "ALUNOGR",
          tipoFuncao: null,
          codigoUnidade: 3,
          nomeVinculo: null,
        },
      ],
    });
    expect(parsed.vinculo[0].codigoUnidade).toBe("3");
    expect(parsed.vinculo[0].tipoFuncao).toBeUndefined();
    expect(profileRole(parsed)).toBe("ALUNO");
  });
  it("assina com parâmetros ordenados e escaping RFC 3986", () => {
    const a = oauthHeader(
      "https://example.com/path?b=2&a=1",
      "key",
      "secret",
      { token: "token", secret: "token-secret" },
      { oauth_callback: "https://app.example/!'()*" },
      "fixed",
      "123",
    );
    expect(a).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(a).toContain('oauth_signature="QVqegv2HaTdSRRzZsB2oklvLqAY%3D"');
    expect(a).toContain(
      'oauth_callback="https%3A%2F%2Fapp.example%2F%21%27%28%29%2A"',
    );
    expect(a).toBe(
      oauthHeader(
        "https://example.com/path?a=1&b=2",
        "key",
        "secret",
        { token: "token", secret: "token-secret" },
        { oauth_callback: "https://app.example/!'()*" },
        "fixed",
        "123",
      ),
    );
    expect(
      oauthHeader(
        "https://example.com/path?a=2&a=1&a=1",
        "key",
        "secret",
        undefined,
        {},
        "n",
        "1",
      ),
    ).toContain("oauth_signature=");
  });
  it("obtém tokens e perfil via POST sem expor segredos na URL de autorização", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("oauth_token=temp&oauth_token_secret=temp-secret"),
      )
      .mockResolvedValueOnce(
        new Response("oauth_token=access&oauth_token_secret=access-secret"),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(profile)));
    const client = createUspOAuth(config, transport);
    const token = await client.requestToken();
    expect(token).toEqual({ token: "temp", secret: "temp-secret" });
    expect(client.authorizationUrl(token.token)).toBe(
      `${config.baseUrl}/authorize?oauth_token=temp&callback_id=0`,
    );
    expect(await client.profile(token, "verifier")).toEqual(profile);
    expect(
      transport.mock.calls.every(([, options]) => options?.method === "POST"),
    ).toBe(true);
    expect(transport.mock.calls[1][0]).toContain(
      "access_token?oauth_verifier=verifier",
    );
    expect(transport.mock.calls[1][1]?.body).toBe(
      "oauth_verifier=verifier&oauth_token=temp",
    );
  });
  it.each(["http", "network", "token", "json", "profile"])(
    "trata falha %s sem vazar credenciais",
    async (mode) => {
      const transport = vi.fn<typeof fetch>();
      if (mode === "network")
        transport.mockRejectedValue(new Error("sensitive"));
      else if (mode === "http")
        transport.mockResolvedValue(new Response("sensitive", { status: 500 }));
      else if (mode === "token")
        transport.mockResolvedValue(new Response("oauth_token=missing-secret"));
      else
        transport
          .mockResolvedValueOnce(
            new Response("oauth_token=t&oauth_token_secret=s"),
          )
          .mockResolvedValueOnce(
            new Response(mode === "json" ? "invalid" : "{}"),
          );
      const client = createUspOAuth(config, transport);
      const call = ["json", "profile"].includes(mode)
        ? client.profile({ token: "t", secret: "s" }, "v")
        : client.requestToken();
      await expect(call).rejects.toMatchObject({ status: 502 });
    },
  );
  it("propaga indisponibilidade ao buscar perfil", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("oauth_token=t&oauth_token_secret=s"))
      .mockRejectedValueOnce(new Error("network"));
    await expect(
      createUspOAuth(config, transport).profile(
        { token: "t", secret: "s" },
        "v",
      ),
    ).rejects.toMatchObject({ status: 502 });
  });
  it("reconhece vínculos e prioriza docente, sem promover servidor administrativo", () => {
    expect(profileRole(profile)).toBe("ALUNO");
    expect(
      profileRole({ ...profile, vinculo: [{ tipoVinculo: "ALUNOGR" }] }),
    ).toBe("ALUNO");
    expect(
      profileRole({
        ...profile,
        vinculo: [...profile.vinculo, { tipoVinculo: "docente" }],
      }),
    ).toBe("PROFESSOR");
    expect(
      profileRole({
        ...profile,
        vinculo: [{ tipoVinculo: "SERVIDOR", tipoFuncao: "Docente" }],
      }),
    ).toBe("PROFESSOR");
    expect(() =>
      profileRole({ ...profile, vinculo: [{ tipoVinculo: "SERVIDOR" }] }),
    ).toThrow();
    expect(() => profileRole({ ...profile, vinculo: [] })).toThrow();
    expect(
      profileEmail({
        ...profile,
        emailUspUsuario: "invalid",
        emailPrincipalUsuario: "PESSOA@usp.br",
      }),
    ).toBe("pessoa@usp.br");
    expect(() =>
      profileEmail({ ...profile, emailUspUsuario: undefined }),
    ).toThrow();
  });
});
describe("configuração USP", () => {
  const env = {
    SENHAUNICA_KEY: "key",
    SENHAUNICA_SECRET: "secret",
    SENHAUNICA_CALLBACK_ID: "0",
    DATABASE_URL: "postgres://localhost/labrary",
  };
  it("é opcional, mas exige configuração completa e exclui contas locais", () => {
    expect(loadUspConfig({}, "https://app.example")).toBeUndefined();
    expect(loadUspConfig(env, "https://app.example")).toMatchObject({
      callbackUrl: "https://app.example/api/auth/usp/callback",
    });
    for (const patch of [
      { SENHAUNICA_SECRET: "" },
      { DATABASE_URL: "" },
      { AUTH_DEMO: "true" },
      { AUTH_USERS_FILE: "file" },
      { SENHAUNICA_CALLBACK_ID: "invalid" },
    ])
      expect(() =>
        loadUspConfig({ ...env, ...patch }, "https://app.example"),
      ).toThrow();
  });
  it("valida endereço do provedor e permite fake local fora de produção", () => {
    expect(
      loadUspConfig(
        { ...env, SENHAUNICA_BASE_URL: "http://localhost:3009/" },
        "http://localhost",
      ),
    ).toMatchObject({ baseUrl: "http://localhost:3009" });
    for (const url of [
      "http://evil.example",
      "https://x?a=1",
      "https://x/#hash",
      "https://user:pass@x",
      "ftp://localhost",
      "invalid",
    ])
      expect(() =>
        loadUspConfig(
          { ...env, SENHAUNICA_BASE_URL: url },
          "https://app.example",
        ),
      ).toThrow();
    expect(() =>
      loadUspConfig(
        {
          ...env,
          NODE_ENV: "production",
          SENHAUNICA_BASE_URL: "http://localhost",
        },
        "https://app.example",
      ),
    ).toThrow();
  });
});
