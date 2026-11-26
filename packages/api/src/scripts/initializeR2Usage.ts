import { resolve } from "node:path";
import { config } from "dotenv";
import { initializeR2Usage } from "../services/r2Usage.js";
import { loadR2Config } from "../services/storageConfiguration.js";
import { Pool } from "pg";

const root = resolve(process.cwd(), "../..");
config({ path: resolve(root, ".env"), quiet: true });
const mode =
  process.env.AUTH_PROVIDER === "google"
    ? "google"
    : process.env.AUTH_DEMO === "true"
      ? "demo"
      : "local";
const dataFile =
  process.env.PROJECT_DATA_FILE ?? resolve(root, `.data/projects-${mode}.json`);
const settings = loadR2Config(process.env, root, dataFile);
if (process.env.AUTH_PROVIDER === "google") {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("INSERT INTO r2_usage(scope,month) VALUES($1,$2)", [settings.scope, new Date().toISOString().slice(0, 7)]);
    console.log("Controle R2 inicializado no PostgreSQL. Use somente em bucket novo sem consumo anterior.");
  } finally {
    await pool.end();
  }
} else {
  initializeR2Usage(settings.usageFile, settings.scope);
  console.log("Controle R2 inicializado no ambiente local isolado.");
}
