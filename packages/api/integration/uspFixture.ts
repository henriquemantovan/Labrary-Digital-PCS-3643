// Isolated OAuth provider and API used exclusively by Playwright. Never imported by src/server.ts.
import express from "express";
import { createHmac, randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import {
  createUspOAuth,
  profileRole,
  profileEmail,
} from "../src/services/uspOAuth.js";
const origin = "http://localhost:5181";
const provider = express();
provider.use(express.urlencoded({ extended: false }));
// An independent verifier for the USPdev/league parameter merge contract.
// Reject invalid signatures so browser tests exercise authenticated HTTP calls.
provider.use((req, res, next) => {
  if (req.method !== "POST") {
    next();
    return;
  }
  const fields = Object.fromEntries(
    [
      ...(req.get("Authorization") ?? "").matchAll(/(oauth_\w+)="([^"]*)"/g),
    ].map((match) => [match[1], decodeURIComponent(match[2])]),
  );
  const signature = fields.oauth_signature;
  const params = { ...req.query, ...fields, ...req.body };
  delete params.oauth_signature;
  const encode = (value: string) =>
    encodeURIComponent(value).replace(
      /[!'()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(String(params[key]))}`)
    .join("&");
  const base = ["POST", `http://localhost:3005${req.path}`, normalized]
    .map(encode)
    .join("&");
  const expected = createHmac(
    "sha1",
    `test-secret&${fields.oauth_token ? "test-secret" : ""}`,
  )
    .update(base)
    .digest("base64");
  if (signature !== expected) {
    res.sendStatus(401);
    return;
  }
  next();
});
const tokens = new Map<string, string>();
const oauthToken = (header = "") =>
  decodeURIComponent(header.match(/oauth_token="([^"]+)"/)?.[1] ?? "");
provider.post("/request_token", (_req, res) => {
  const token = randomBytes(16).toString("hex");
  tokens.set(token, "pending");
  res.send(`oauth_token=${token}&oauth_token_secret=test-secret`);
});
provider.get("/authorize", (req, res) => {
  const token = String(req.query.oauth_token);
  res
    .type("html")
    .send(
      `<html lang="pt-BR"><title>Provedor USP de teste</title><h1>Senha Única simulada para testes</h1><a href="/approve?token=${token}&role=ALUNO">Autorizar aluno</a><br><a href="/approve?token=${token}&role=PROFESSOR">Autorizar professor</a><br><a href="/approve?token=${token}&role=SERVIDOR">Autorizar servidor</a></html>`,
    );
});
provider.get("/approve", (req, res) => {
  const token = String(req.query.token);
  tokens.set(token, String(req.query.role));
  res.redirect(
    `${origin}/api/auth/usp/callback?oauth_token=${token}&oauth_verifier=approved`,
  );
});
provider.post("/access_token", (req, res) => {
  const token = oauthToken(req.get("Authorization"));
  if (!tokens.has(token)) {
    res.sendStatus(401);
    return;
  }
  res.send(`oauth_token=${token}&oauth_token_secret=test-secret`);
});
provider.post("/usuariousp", (req, res) => {
  const role = tokens.get(oauthToken(req.get("Authorization")));
  res.json({
    loginUsuario: role === "PROFESSOR" ? "9999999" : "1234567",
    nomeUsuario: role === "PROFESSOR" ? "Helena USP" : "Marina USP",
    emailUspUsuario: role === "PROFESSOR" ? "helena@usp.br" : "marina@usp.br",
    vinculo: [
      {
        tipoVinculo:
          role === "ALUNO"
            ? "ALUNOGR"
            : role === "PROFESSOR"
              ? "DOCENTE"
              : role,
      },
    ],
  });
});
provider.listen(3005);
const auth = createAuthRepository();
const client = createUspOAuth({
  key: "test-key",
  secret: "test-secret",
  callbackId: "0",
  callbackUrl: `${origin}/api/auth/usp/callback`,
  baseUrl: "http://localhost:3005",
});
createApp({
  auth,
  origin,
  usp: {
    origin,
    client,
    async saveProfile(profile) {
      const role = profileRole(profile);
      const existing = auth.directory.users.find(
        (user) => user.uspNumber === profile.loginUsuario,
      );
      return {
        id: existing?.id ?? (role === "PROFESSOR" ? 20 : 10),
        fullName: profile.nomeUsuario,
        email: profileEmail(profile),
        role,
        passwordHash: null,
        active: true,
        uspNumber: profile.loginUsuario,
        uspAffiliations: profile.vinculo,
      };
    },
  },
}).listen(3004);
