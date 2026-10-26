import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { affiliationSchema } from "../models/auth.js";
import { ApiError } from "../errors.js";

export interface UspConfig {
  key: string;
  secret: string;
  callbackId: string;
  callbackUrl: string;
  baseUrl: string;
}
export interface OAuthToken {
  token: string;
  secret: string;
}
const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
export function oauthHeader(
  url: string,
  key: string,
  secret: string,
  token?: OAuthToken,
  parameters: Record<string, string> = {},
  nonce = randomBytes(24).toString("hex"),
  timestamp = String(Math.floor(Date.now() / 1000)),
  body: Record<string, string> = {},
) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: key,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
    ...parameters,
  };
  if (token) oauth.oauth_token = token.token;
  const uri = new URL(url);
  // Match USPdev's league/oauth1-client normalization: access_token sends
  // verifier/token in multiple locations, but signs each parameter once.
  const entries = Object.entries({
    ...Object.fromEntries(uri.searchParams),
    ...oauth,
    ...body,
  }).map(([k, v]) => [encode(k), encode(v)]);
  entries.sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
  );
  const normalized = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const base = ["POST", `${uri.origin}${uri.pathname}`, normalized]
    .map(encode)
    .join("&");
  oauth.oauth_signature = createHmac(
    "sha1",
    `${encode(secret)}&${encode(token?.secret ?? "")}`,
  )
    .update(base)
    .digest("base64");
  return (
    "OAuth " +
    Object.entries(oauth)
      .map(([k, v]) => `${encode(k)}="${encode(v)}"`)
      .join(", ")
  );
}
export const uspProfileSchema = z.object({
  loginUsuario: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().regex(/^\d{1,32}$/)),
  nomeUsuario: z.string().trim().min(1).max(160),
  emailPrincipalUsuario: z.string().nullish(),
  emailUspUsuario: z.string().nullish(),
  vinculo: z.array(affiliationSchema),
});
export type UspProfile = z.infer<typeof uspProfileSchema>;
export function profileRole(profile: UspProfile): "PROFESSOR" | "ALUNO" {
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  if (
    profile.vinculo.some(
      (v) =>
        normalized(v.tipoVinculo) === "DOCENTE" ||
        (["SERVIDOR", "SERVIIDOR"].includes(normalized(v.tipoVinculo)) &&
          normalized(v.tipoFuncao ?? "") === "DOCENTE"),
    )
  )
    return "PROFESSOR";
  if (
    profile.vinculo.some((v) =>
      [
        "ALUNO",
        "ALUNOGR",
        "ALUNOPOS",
        "ALUNOCEU",
        "ALUNOEAD",
        "ALUNOPD",
        "ALUNOCONVENIOINT",
      ].includes(normalized(v.tipoVinculo)),
    )
  )
    return "ALUNO";
  throw new ApiError(
    403,
    "USP_AFFILIATION_REQUIRED",
    "É necessário vínculo de aluno ou docente com a USP.",
  );
}
export function profileEmail(profile: UspProfile) {
  for (const candidate of [
    profile.emailUspUsuario,
    profile.emailPrincipalUsuario,
  ]) {
    const parsed = z.email().max(254).safeParse(candidate);
    if (parsed.success) return parsed.data.toLowerCase();
  }
  throw new ApiError(
    403,
    "USP_EMAIL_REQUIRED",
    "A USP não retornou um e-mail válido para sua conta.",
  );
}
export function createUspOAuth(
  config: UspConfig,
  transport: typeof fetch = fetch,
) {
  async function post(
    path: string,
    token?: OAuthToken,
    parameters: Record<string, string> = {},
    body: Record<string, string> = {},
  ) {
    const url = `${config.baseUrl}/${path}`;
    try {
      const response = await transport(url, {
        method: "POST",
        headers: {
          Authorization: oauthHeader(
            url,
            config.key,
            config.secret,
            token,
            parameters,
            undefined,
            undefined,
            body,
          ),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body).toString(),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("USP response");
      return await response.text();
    } catch {
      throw new ApiError(
        502,
        "USP_UNAVAILABLE",
        "Não foi possível autenticar com a USP. Tente novamente.",
      );
    }
  }
  function parseToken(body: string): OAuthToken {
    const data = new URLSearchParams(body);
    const token = data.get("oauth_token"),
      secret = data.get("oauth_token_secret");
    if (!token || !secret)
      throw new ApiError(
        502,
        "USP_INVALID_RESPONSE",
        "A USP retornou uma resposta inválida.",
      );
    return { token, secret };
  }
  return {
    async requestToken() {
      return parseToken(
        await post("request_token", undefined, {
          oauth_callback: config.callbackUrl,
        }),
      );
    },
    authorizationUrl(token: string) {
      const url = new URL(`${config.baseUrl}/authorize`);
      url.searchParams.set("oauth_token", token);
      url.searchParams.set("callback_id", config.callbackId);
      return url.toString();
    },
    async profile(token: OAuthToken, verifier: string) {
      const access = parseToken(
        await post(
          `access_token?oauth_verifier=${encode(verifier)}`,
          token,
          {},
          { oauth_verifier: verifier, oauth_token: token.token },
        ),
      );
      try {
        return uspProfileSchema.parse(
          JSON.parse(await post("usuariousp", access)),
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          502,
          "USP_INVALID_RESPONSE",
          "A USP retornou uma resposta inválida.",
        );
      }
    },
  };
}
export type UspOAuth = ReturnType<typeof createUspOAuth>;
