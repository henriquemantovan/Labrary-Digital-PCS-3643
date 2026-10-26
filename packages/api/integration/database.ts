// Run only against a disposable PostgreSQL cluster: creates and drops two databases.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { createPostgresIdentityRepository } from "../src/repositories/postgresIdentityRepository.js";
import { UspProfile } from "../src/services/uspOAuth.js";
import { Directory } from "../src/models/auth.js";
const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl)
  throw new Error(
    "Defina TEST_DATABASE_URL para um cluster PostgreSQL descartável (com permissão CREATEDB).",
  );
const admin = new Pool({ connectionString: adminUrl });
const suffix = `${process.pid}_${Date.now()}`;
const databases = [`labrary_fresh_${suffix}`, `labrary_existing_${suffix}`];
const migrate = (url: string, args: string[]) => {
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", ...args], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
};
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
          "INSERT INTO app_user(full_name,email,password_hash,role) VALUES ('Antigo','legacy@usp.br','existing-hash','ALUNO')",
        );
        migrate(url.toString(), [
          "resolve",
          "--applied",
          "20261001000000_baseline",
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
        2,
      );
      if (index === 1)
        assert.equal(
          (
            await pool.query(
              "SELECT password_hash FROM app_user WHERE email='legacy@usp.br'",
            )
          ).rows[0].password_hash,
          "existing-hash",
        );
      const repository = createPostgresIdentityRepository(pool);
      const profile: UspProfile = {
        loginUsuario: "1234567",
        nomeUsuario: "Maria USP",
        emailUspUsuario: "maria@usp.br",
        vinculo: [{ tipoVinculo: "ALUNOGR" }],
      };
      const user = await repository.saveProfile(profile);
      assert.equal(user.role, "ALUNO");
      assert.equal(user.passwordHash, null);
      const relogin = await repository.saveProfile({
        ...profile,
        nomeUsuario: "Maria Atualizada",
      });
      assert.equal(relogin.id, user.id);
      assert.equal(relogin.fullName, "Maria Atualizada");
      await assert.rejects(
        repository.saveProfile({ ...profile, loginUsuario: "7654321" }),
        { code: "USP_ACCOUNT_CONFLICT" },
      );
      const docente = await repository.saveProfile({
        ...profile,
        vinculo: [{ tipoVinculo: "SERVIDOR", tipoFuncao: "Docente" }],
      });
      assert.equal(docente.role, "PROFESSOR");
      await pool.query(
        "UPDATE app_user SET role='AVALIADOR', active=false WHERE id=$1",
        [user.id],
      );
      const evaluator = await repository.saveProfile(profile);
      assert.equal(evaluator.role, "AVALIADOR");
      assert.equal(evaluator.active, false);
      await assert.rejects(
        repository.saveProfile({
          ...profile,
          vinculo: [{ tipoVinculo: "SERVIDOR" }],
        }),
        { code: "USP_AFFILIATION_REQUIRED" },
      );
      const directory: Directory = {
        users: [],
        classes: [],
        groups: [],
        assignments: [],
      };
      await repository.refresh(directory);
      assert.equal(
        directory.users.find((u) => u.id === user.id)?.active,
        false,
      );
      console.log(
        `PASS: ${index === 0 ? "banco vazio" : "baseline do schema implantado com dados preservados"}; migrations idempotentes; identidade e vínculos persistidos.`,
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
