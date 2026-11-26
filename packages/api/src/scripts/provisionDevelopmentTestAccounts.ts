import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { loadGoogleConfig } from "../services/googleConfiguration.js";
import { developmentTestAccounts, developmentTestPassword, loadDevelopmentTestLogin } from "../services/developmentTestAccounts.js";
import { hashPassword, verifyPassword } from "../services/password.js";

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

async function main() {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
  const google = loadGoogleConfig(process.env, origin);
  if (!loadDevelopmentTestLogin(process.env, Boolean(google), origin))
    throw new Error("Ative DEV_TEST_LOGIN=true com Google e NODE_ENV=development antes de provisionar.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(3643003)");
      const people = [];
      let newGuest = false;
      for (const person of developmentTestAccounts) {
        const encoded = await hashPassword(developmentTestPassword);
        const inserted = await client.query(
          "INSERT INTO app_user(full_name,email,password_hash,role) VALUES ($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id,full_name,email,role,password_hash,google_subject",
          [person.fullName, person.email, encoded, person.role],
        );
        const row = inserted.rows[0] ?? (await client.query(
          "SELECT id,full_name,email,role,password_hash,google_subject FROM app_user WHERE email=$1 FOR UPDATE", [person.email],
        )).rows[0];
        if (row.google_subject || !row.password_hash || !await verifyPassword(developmentTestPassword, row.password_hash))
          throw new Error(`Conta ${person.email} já existe com outra identidade ou senha; nenhum dado foi sobrescrito.`);
        people.push({ id: Number(row.id), email: row.email, role: row.role });
        if (person.email === "convidado@labrary.test") newGuest = inserted.rows.length > 0;
      }
      if (newGuest) {
        const admin = people.find(({ email }) => email === "admin@labrary.test")!;
        await client.query(
          "INSERT INTO guest_invitation(email,invited_by) VALUES ('convidado@labrary.test',$1) ON CONFLICT (email) WHERE revoked_at IS NULL DO NOTHING",
          [admin.id],
        );
      }
      await client.query("COMMIT");
      for (const person of people) console.log(`${person.email} — ${person.role} — ID ${person.id}`);
      console.log(`Senha exclusiva das contas fictícias: ${developmentTestPassword}`);
      console.log("Contas de teste persistidas; usuários e papéis existentes foram preservados.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } finally { await pool.end(); }
}

main().catch((error: Error) => {
  const message = error.message.startsWith("Conta ") || error.message.startsWith("Ative ") || error.message.includes("DEV_TEST_LOGIN")
    ? error.message : "Não foi possível provisionar as contas de teste. Confira a configuração e a conexão com PostgreSQL.";
  console.error(message);
  process.exitCode = 1;
});
