import { verifyGroups } from "./groups.js";
// Disposable cluster only: this test creates and removes its own databases.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import request from "supertest";
import { Pool } from "pg";
import { createPostgresAdminRepository } from "../src/repositories/postgresAdminRepository.js";
import { createApp } from "../src/app.js";
import { createPostgresIdentityRepository } from "../src/repositories/postgresIdentityRepository.js";
import {
  createPostgresAuthRepository,
  createPostgresOAuthAttempts,
} from "../src/repositories/postgresAuthRepository.js";
import { GoogleProfile } from "../src/services/googleOAuth.js";
const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl)
  throw new Error(
    "Defina TEST_DATABASE_URL para um cluster PostgreSQL descartável com permissão CREATEDB.",
  );
const admin = new Pool({ connectionString: adminUrl });
const suffix = `${process.pid}_${Date.now()}`;
const databases = [`labrary_fresh_${suffix}`, `labrary_existing_${suffix}`];
function migrate(url: string, args: string[]) {
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", ...args], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
try {
  for (const [index, database] of databases.entries()) {
    await admin.query(`CREATE DATABASE "${database}"`);
    const url = new URL(adminUrl);
    url.pathname = `/${database}`;
    const pool = new Pool({ connectionString: url.toString() });
    try {
      if (index === 1) {
        await pool.query(await readFile("../../db/schema.sql", "utf8"));
        await pool.query(
          "INSERT INTO app_user(full_name,email,password_hash,role) VALUES ('Antigo','legacy@usp.br','existing-hash','PROFESSOR')",
        );
        migrate(url.toString(), [
          "resolve",
          "--applied",
          "20261001000000_baseline",
        ]);
        await pool.query(
          await readFile(
            "prisma/migrations/20261022000000_usp_identity/migration.sql",
            "utf8",
          ),
        );
        await pool.query(
          "UPDATE app_user SET usp_number='1234567', usp_affiliations='[{\"tipoVinculo\":\"DOCENTE\"}]'",
        );
        migrate(url.toString(), [
          "resolve",
          "--applied",
          "20261022000000_usp_identity",
        ]);
      }
      migrate(url.toString(), ["deploy"]);
      migrate(url.toString(), ["deploy"]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL",
          )
        ).rows[0].count,
        5,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'",
          )
        ).rows[0].count,
        24,
      );
      if (index === 1)
        assert.deepEqual(
          (
            await pool.query(
              "SELECT password_hash,role,usp_number FROM app_user WHERE email='legacy@usp.br'",
            )
          ).rows[0],
          {
            password_hash: "existing-hash",
            role: "PROFESSOR",
            usp_number: "1234567",
          },
        );
      const identity = createPostgresIdentityRepository(pool);
      const profile: GoogleProfile = {
        subject: "google-student",
        fullName: "Maria Google",
        email: "maria@gmail.com",
        emailVerified: true,
      };
      const user = await identity.saveProfile(profile);
      assert.equal(user.role, "ALUNO");
      assert.equal(user.passwordHash, null);
      assert.equal(user.googleLinked, true);
      const updated = await identity.saveProfile({
        ...profile,
        fullName: "Maria Atualizada",
        email: "maria.updated@gmail.com",
      });
      assert.equal(updated.id, user.id);
      assert.equal(updated.fullName, "Maria Atualizada");
      await assert.rejects(
        identity.saveProfile({
          ...profile,
          subject: "another-sub",
          email: updated.email.toUpperCase(),
        }),
        { code: "GOOGLE_ACCOUNT_CONFLICT" },
      );
      if (index === 1) {
        await assert.rejects(
          identity.saveProfile({
            ...profile,
            subject: "legacy-sub",
            email: "legacy@usp.br",
          }),
          { code: "GOOGLE_ACCOUNT_CONFLICT" },
        );
        await pool.query(
          "UPDATE app_user SET google_subject='legacy-sub' WHERE email='legacy@usp.br'",
        );
        assert.equal(
          (
            await identity.saveProfile({
              ...profile,
              subject: "legacy-sub",
              email: "legacy@usp.br",
            })
          ).role,
          "PROFESSOR",
        );
      }
      await pool.query("UPDATE app_user SET role='AVALIADOR' WHERE id=$1", [
        user.id,
      ]);
      assert.equal((await identity.saveProfile(profile)).role, "AVALIADOR");
      const first = createPostgresAuthRepository(pool);
      const session = await first.createSession(user.id, 1000, 3000);
      const stored = (await pool.query("SELECT token_hash FROM auth_session"))
        .rows[0].token_hash;
      assert.equal(stored, hash(session));
      assert.notEqual(stored, session);
      const second = createPostgresAuthRepository(pool); // Simulates another process/restart.
      let now = 1001;
      const app = createApp({ auth: second, now: () => now });
      const cookie = `labrary_session=${session}`;
      assert.equal(
        (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.data
          .role,
        "AVALIADOR",
      );
      await pool.query("UPDATE app_user SET role='PROFESSOR' WHERE id=$1", [
        user.id,
      ]);
      assert.equal(
        (await request(app).get("/api/auth/me").set("Cookie", cookie)).body.data
          .role,
        "PROFESSOR",
      );
      assert.equal(
        (
          await request(app)
            .post("/api/auth/logout")
            .set("Cookie", cookie)
            .set("X-CSRF-Protection", "1")
        ).status,
        204,
      );
      assert.equal(await first.getSession(session, now), undefined);
      const expires = await first.createSession(user.id, 1000, 100);
      now = 1100;
      assert.equal(
        (
          await request(app)
            .get("/api/auth/me")
            .set("Cookie", `labrary_session=${expires}`)
        ).status,
        401,
      );
      const inactive = await first.createSession(user.id, 1000, 3000);
      await pool.query("UPDATE app_user SET active=false WHERE id=$1", [
        user.id,
      ]);
      assert.equal(
        (
          await request(app)
            .get("/api/auth/me")
            .set("Cookie", `labrary_session=${inactive}`)
        ).status,
        401,
      );
      await pool.query("UPDATE app_user SET active=true WHERE id=$1", [
        user.id,
      ]);
      assert.equal(await first.getSession(inactive, now), undefined);
      const attempts = createPostgresOAuthAttempts(pool),
        otherAttempts = createPostgresOAuthAttempts(pool);
      await attempts.save(
        "state",
        { nonce: "nonce", verifier: "verifier", expiresAt: 1000 },
        0,
      );
      assert.equal(
        (await pool.query("SELECT state_hash FROM oauth_login_attempt")).rows[0]
          .state_hash,
        hash("state"),
      );
      const results = await Promise.all([
        attempts.consume("state", 1),
        otherAttempts.consume("state", 1),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      await attempts.save(
        "expired",
        { nonce: "n", verifier: "v", expiresAt: 1 },
        0,
      );
      assert.equal(await attempts.consume("expired", 2), undefined);
      await attempts.save(
        "cleanup",
        { nonce: "n", verifier: "v", expiresAt: 1 },
        0,
      );
      await attempts.save(
        "fresh",
        { nonce: "n", verifier: "v", expiresAt: 10 },
        2,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM oauth_login_attempt",
          )
        ).rows[0].count,
        1,
      );
      // Administrator operations run against the real adapter and HTTP middleware.
      await pool.query("UPDATE app_user SET role='ADMIN' WHERE id=$1", [
        user.id,
      ]);
      const administrator = createPostgresAdminRepository(pool);
      const adminToken = await first.createSession(user.id, 1000, 9000);
      const adminCookie = `labrary_session=${adminToken}`;
      const adminApp = createApp({
        auth: first,
        admin: administrator,
        now: () => 1100,
      });
      const me = (
        await request(adminApp).get("/api/auth/me").set("Cookie", adminCookie)
      ).body.data;
      assert.equal(me.role, "ADMIN");
      assert.equal((await identity.saveProfile(profile)).role, "ADMIN");
      assert.equal(
        (
          await request(adminApp)
            .patch(`/api/admin/users/${user.id}/role`)
            .set("Cookie", adminCookie)
            .set("X-CSRF-Protection", "1")
            .send({ role: "ALUNO" })
        ).body.error.code,
        "LAST_ADMIN",
      );
      const student = await identity.saveProfile({
        ...profile,
        subject: "second-admin-sub",
        email: "second-admin@gmail.com",
      });
      await request(adminApp)
        .post("/api/auth/view-role")
        .set("Cookie", adminCookie)
        .set("X-CSRF-Protection", "1")
        .send({ role: "ALUNO" })
        .expect(200);
      assert.equal(
        (await second.getSession(adminToken, 1100))?.viewRole,
        "ALUNO",
      );
      assert.equal(
        (await request(adminApp).get("/api/auth/me").set("Cookie", adminCookie))
          .body.data.role,
        "ADMIN",
      );
      assert.equal(
        (
          await request(adminApp)
            .get("/api/admin/users")
            .set("Cookie", adminCookie)
        ).status,
        200,
      );
      const promoted = await request(adminApp)
        .patch(`/api/admin/users/${student.id}/role`)
        .set("Cookie", adminCookie)
        .set("X-CSRF-Protection", "1")
        .send({ role: "ADMIN" });
      assert.equal(promoted.status, 200);
      assert.equal(promoted.body.data.role, "ADMIN");
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM user_role_audit"))
          .rows[0].count,
        1,
      );
      const secondToken = await second.createSession(student.id, 1000, 9000);
      await second.setViewRole(secondToken, "PROFESSOR", 1100);
      const otherAdmin = createPostgresAdminRepository(pool);
      const changes = await Promise.allSettled([
        administrator.changeRole(user.id, user.id, "ALUNO", 1100),
        otherAdmin.changeRole(student.id, student.id, "ALUNO", 1100),
      ]);
      assert.equal(
        changes.filter((result) => result.status === "fulfilled").length,
        1,
      );
      const rejected = changes.find(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult;
      assert.equal(rejected.reason.code, "LAST_ADMIN");
      const admins = (
        await pool.query(
          "SELECT id FROM app_user WHERE active AND role='ADMIN'",
        )
      ).rows;
      assert.equal(admins.length, 1);
      const demoted =
        changes[0].status === "fulfilled"
          ? { id: user.id, token: adminToken }
          : { id: student.id, token: secondToken };
      assert.equal(
        (await first.getSession(demoted.token, 1100))?.viewRole,
        undefined,
      );
      const denied = await request(adminApp)
        .get("/api/admin/users")
        .set("Cookie", `labrary_session=${demoted.token}`);
      assert.equal(denied.status, 403);
      await assert.rejects(
        administrator.changeRole(
          demoted.id,
          Number(admins[0].id),
          "ALUNO",
          1100,
        ),
        { code: "ADMIN_REQUIRED" },
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM user_role_audit"))
          .rows[0].count,
        2,
      );
      await verifyGroups(pool, url.toString());
      console.log(
        `PASS: ${index === 0 ? "banco vazio" : "banco existente com identidade USP preservada"}; 24 tabelas, administrador com auditoria, proteção concorrente do último admin, visualização por sessão, migrations idempotentes, identidade Google, perfis, sessão entre processos, expiração, logout, desativação e tentativa OAuth de uso único.`,
      );
    } finally {
      await pool.end();
    }
  }
} finally {
  for (const database of databases)
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
}
