// Isolated Google-like OIDC server for Playwright. Never imported by server.ts.
import express from "express";
import { randomBytes, createHash } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT, createRemoteJWKSet } from "jose";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import { createMemoryOAuthAttempts } from "../src/repositories/oauthAttemptRepository.js";
import { createGoogleOAuth } from "../src/services/googleOAuth.js";
const origin = "http://localhost:5181",
  providerOrigin = "http://localhost:3005";
const { privateKey, publicKey } = await generateKeyPair("RS256", {
  extractable: true,
});
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "fixture-key",
  alg: "RS256",
  use: "sig",
};
const provider = express();
provider.use(express.urlencoded({ extended: false }));
const pending = new Map<string, URLSearchParams>(),
  codes = new Map<string, { params: URLSearchParams; choice: string }>();
provider.get("/certs", (_req, res) => res.json({ keys: [jwk] }));
provider.get("/authorize", (req, res) => {
  const params = new URLSearchParams(req.originalUrl.split("?")[1]);
  const state = params.get("state");
  if (!state) {
    res.sendStatus(400);
    return;
  }
  pending.set(state, params);
  const links = [
    ["aluno", "Selecionar conta de aluno"],
    ["professor", "Selecionar conta de professor"],
    ["admin", "Selecionar conta de administrador"],
    ["unverified", "Selecionar e-mail não verificado"],
    ["cancel", "Cancelar"],
  ]
    .map(
      ([choice, label]) =>
        `<p><a href="/approve?state=${encodeURIComponent(state)}&choice=${choice}">${label}</a></p>`,
    )
    .join("");
  res
    .type("html")
    .send(
      `<html lang="pt-BR"><title>Google simulado para testes</title><h1>Escolha uma conta de teste</h1>${links}</html>`,
    );
});
provider.get("/approve", (req, res) => {
  const state = String(req.query.state),
    choice = String(req.query.choice),
    params = pending.get(state);
  pending.delete(state);
  if (!params) {
    res.sendStatus(400);
    return;
  }
  const callback = new URL(params.get("redirect_uri")!);
  callback.searchParams.set("state", state);
  if (choice === "cancel") callback.searchParams.set("error", "access_denied");
  else {
    const code = randomBytes(24).toString("base64url");
    codes.set(code, { params, choice });
    callback.searchParams.set("code", code);
  }
  res.redirect(callback.toString());
});
provider.post("/token", async (req, res) => {
  const record = codes.get(req.body.code);
  codes.delete(req.body.code);
  if (
    !record ||
    req.body.client_id !== "fixture-client" ||
    req.body.client_secret !== "fixture-secret" ||
    req.body.redirect_uri !== `${origin}/api/auth/google/callback` ||
    req.body.grant_type !== "authorization_code" ||
    typeof req.body.code_verifier !== "string" ||
    createHash("sha256").update(req.body.code_verifier).digest("base64url") !==
      record.params.get("code_challenge")
  ) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  const teacher = record.choice === "professor";
  const administrator = record.choice === "admin";
  const token = await new SignJWT({
    email: administrator
      ? "admin@gmail.com"
      : teacher
        ? "helena@gmail.com"
        : "marina@gmail.com",
    name: administrator
      ? "Administrador Google"
      : teacher
        ? "Helena Google"
        : "Marina Google",
    email_verified: record.choice !== "unverified",
    nonce: record.params.get("nonce"),
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience("fixture-client")
    .setSubject(
      administrator ? "admin-sub" : teacher ? "teacher-sub" : "student-sub",
    )
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  res.json({ id_token: token });
});
provider.listen(3005);
// The teacher role is provisioned locally, never taken from Google's claims.
const auth = createAuthRepository({
  users: [
    {
      id: 40,
      fullName: "Administrador Google",
      email: "admin@gmail.com",
      passwordHash: null,
      role: "ADMIN",
      active: true,
      googleLinked: true,
    },
    {
      id: 30,
      fullName: "Marina Google",
      email: "marina@gmail.com",
      passwordHash: null,
      role: "ALUNO",
      active: true,
      googleLinked: true,
    },
    {
      id: 20,
      fullName: "Helena Google",
      email: "helena@gmail.com",
      passwordHash: null,
      role: "PROFESSOR",
      active: true,
      googleLinked: true,
    },
  ],
  classes: [],
  groups: [],
  assignments: [],
});
const ids = new Map([
  ["teacher-sub", 20],
  ["admin-sub", 40],
  ["student-sub", 30],
]);
const client = createGoogleOAuth(
  {
    clientId: "fixture-client",
    clientSecret: "fixture-secret",
    callbackUrl: `${origin}/api/auth/google/callback`,
  },
  {
    authorizationEndpoint: `${providerOrigin}/authorize`,
    tokenEndpoint: `${providerOrigin}/token`,
    keys: createRemoteJWKSet(new URL(`${providerOrigin}/certs`)),
  },
);
createApp({
  auth,
  origin,
  google: {
    client,
    origin,
    attempts: createMemoryOAuthAttempts(),
    async saveProfile(profile) {
      const id = ids.get(profile.subject) ?? 30;
      ids.set(profile.subject, id);
      const existing = auth.findById(id);
      return {
        id,
        fullName: profile.fullName,
        email: profile.email,
        role: existing?.role ?? "ALUNO",
        passwordHash: null,
        active: true,
        googleLinked: true,
      };
    },
  },
}).listen(3004);
