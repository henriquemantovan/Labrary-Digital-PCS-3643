import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createPostgresAuthRepository } from "../src/repositories/postgresAuthRepository.js";
import { createPostgresAdminRepository } from "../src/repositories/postgresAdminRepository.js";
import { createPostgresAcademicAccessRepository } from "../src/repositories/postgresAcademicAccessRepository.js";
import { developmentTestAccounts, developmentTestPassword } from "../src/services/developmentTestAccounts.js";

export async function verifyDevelopmentTestAccounts(pool: Pool, databaseUrl: string) {
  const before = (await pool.query("SELECT id,email,role,password_hash,google_subject,active FROM app_user ORDER BY id")).rows;
  const emails = developmentTestAccounts.map(({ email }) => email);
  const provision = () => spawnSync("pnpm", ["exec", "tsx", "src/scripts/provisionDevelopmentTestAccounts.ts"], {
    env: { ...process.env, DATABASE_URL: databaseUrl, AUTH_PROVIDER: "google", AUTH_DEMO: "false", AUTH_USERS_FILE: "", NODE_ENV: "development", DEV_TEST_LOGIN: "true", APP_ORIGIN: "http://localhost:5173", GOOGLE_CLIENT_ID: "cliente-do-teste", GOOGLE_CLIENT_SECRET: "segredo-do-teste" }, encoding: "utf8",
  });
  assert.equal(provision().status, 0, "Provisionamento de contas de teste falhou.");
  const first = (await pool.query("SELECT id,email,role,password_hash,google_subject,email_verified FROM app_user WHERE email=ANY($1::text[]) ORDER BY email", [emails])).rows;
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map((u) => u.password_hash)).size, 8);
  assert(first.every((u) => u.google_subject === null && !u.email_verified));
  assert.equal(provision().status, 0);
  assert.deepEqual((await pool.query("SELECT id,email,role,password_hash,google_subject,email_verified FROM app_user WHERE email=ANY($1::text[]) ORDER BY email", [emails])).rows, first);
  assert.deepEqual((await pool.query("SELECT id,email,role,password_hash,google_subject,active FROM app_user WHERE NOT (email=ANY($1::text[])) ORDER BY id", [emails])).rows, before);

  const auth = createPostgresAuthRepository(pool);
  auth.developmentTestLogin = true;
  const access = createPostgresAcademicAccessRepository(pool, true);
  const app = createApp({ auth, academicAccess: access, localLogin: false });
  const login = (email: string) => request(app).post("/api/auth/login").set("X-CSRF-Protection", "1").send({ email, password: developmentTestPassword });
  for (const person of developmentTestAccounts) {
    const result = await login(person.email);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.role, person.role);
  }
  const newcomer = await login("cadastro@labrary.test");
  const newcomerCookie = newcomer.headers["set-cookie"][0].split(";")[0];
  assert.equal(newcomer.body.data.requiresAcademicProfile, true);
  assert.equal(newcomer.body.data.googleLinked, undefined);
  assert.equal((await request(app).get("/api/projects").set("Cookie", newcomerCookie)).status, 403);
  const profile = { fullName: "Cadastro Fictício Teste", uspNumber: "99000000001", entryYear: 2024 };
  const saved = await request(app).post("/api/auth/profile").set("Cookie", newcomerCookie).set("X-CSRF-Protection", "1").send(profile);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.requiresAcademicProfile, false);
  const afterRestart = createPostgresAuthRepository(pool);
  afterRestart.developmentTestLogin = true;
  const restarted = createApp({ auth: afterRestart, academicAccess: access, localLogin: false });
  assert.equal((await request(restarted).get("/api/auth/me").set("Cookie", newcomerCookie)).body.data.uspNumber, profile.uspNumber);
  await assert.rejects(createPostgresAcademicAccessRepository(pool).saveProfile(saved.body.data.id, profile, Date.now()), { code: "ACADEMIC_PROFILE_UNAVAILABLE" });
  const guest = await login("convidado@labrary.test");
  const guestCookie = guest.headers["set-cookie"][0].split(";")[0];
  assert.equal(guest.body.data.guest, true);
  assert.equal(guest.body.data.requiresAcademicProfile, false);
  const invitation = (await access.listInvitations()).find(item => item.email === "convidado@labrary.test" && !item.revokedAt)!;
  const adminId = Number(first.find(item => item.email === "admin@labrary.test")!.id);
  await access.revoke(adminId, invitation.id, Date.now());
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", guestCookie)).status, 401);
  assert.equal((await login("convidado@labrary.test")).status, 401);
  assert.equal(provision().status, 0);
  assert.equal(await access.isGuest("convidado@labrary.test"), false, "Repetir o seed não pode reativar convite revogado.");
  await access.invite(adminId, "convidado@labrary.test", Date.now());
  assert.equal((await login("convidado@labrary.test")).status, 200);
  const signed = await login("aluno@labrary.test");
  const cookie = signed.headers["set-cookie"][0].split(";")[0];
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", cookie)).status, 200);
  const disabled = createApp({ auth: createPostgresAuthRepository(pool), localLogin: false });
  assert.equal((await request(disabled).get("/api/auth/me").set("Cookie", cookie)).status, 401);
  assert.equal(await auth.getSession(cookie.split("=")[1], Date.now()), undefined);

  const normal = (await pool.query("SELECT id FROM app_user WHERE active AND google_subject IS NOT NULL AND email LIKE '%@usp.br' LIMIT 1")).rows[0];
  const normalToken = await auth.createSession(Number(normal.id), Date.now(), 60000);
  assert.equal((await request(disabled).get("/api/auth/me").set("Cookie", `labrary_session=${normalToken}`)).status, 200);
  await auth.deleteSession(normalToken);

  // Somente neste banco descartável: testa um único ADMIN real ao lado do fictício.
  const realAdmins = (await pool.query("SELECT id FROM app_user WHERE active AND role='ADMIN' AND NOT(email=ANY($1::text[])) ORDER BY id", [emails])).rows;
  assert(realAdmins.length > 0);
  const others = realAdmins.slice(1).map((row) => row.id);
  const fakeAdmin = first.find((row) => row.email === "admin@labrary.test")!;
  try {
    await pool.query("UPDATE app_user SET role='PROFESSOR' WHERE id=ANY($1::bigint[])", [others]);
    await assert.rejects(createPostgresAdminRepository(pool).changeRole(Number(fakeAdmin.id), Number(realAdmins[0].id), "ALUNO", Date.now()), { code: "LAST_ADMIN" });
  } finally {
    await pool.query("UPDATE app_user SET role='ADMIN' WHERE id=ANY($1::bigint[])", [others]);
  }

  const reserved = first[0];
  await pool.query("UPDATE app_user SET google_subject='identidade-reservada-no-teste' WHERE id=$1", [reserved.id]);
  assert.notEqual(provision().status, 0, "Uma identidade Google existente não pode ser sobrescrita pelo seed.");
  assert.equal((await pool.query("SELECT google_subject FROM app_user WHERE id=$1", [reserved.id])).rows[0].google_subject, "identidade-reservada-no-teste");
  await pool.query("UPDATE app_user SET google_subject=NULL WHERE id=$1", [reserved.id]);
  console.log("Contas de teste: oito identidades locais, cadastro fictício persistente, convite/revogação, seed idempotente, preservação do último ADMIN real e revogação de sessão ao desligar a exceção verificadas no PostgreSQL.");
}
