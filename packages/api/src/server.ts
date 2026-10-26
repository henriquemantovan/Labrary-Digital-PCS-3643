import { loadDirectory } from "./services/configuration.js";
import { Pool } from "pg";
import { createPostgresIdentityRepository } from "./repositories/postgresIdentityRepository.js";
import { createUspOAuth } from "./services/uspOAuth.js";
import { loadUspConfig } from "./services/uspConfiguration.js";
import {
  AuthRepository,
  createAuthRepository,
} from "./repositories/authRepository.js";
import { createApp } from "./app.js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.API_PORT ?? 3000);

const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
if (
  process.env.NODE_ENV === "production" &&
  new URL(origin).protocol !== "https:"
) {
  throw new Error("APP_ORIGIN deve usar HTTPS em produção.");
}
const uspConfig = loadUspConfig(process.env, origin);
let auth: AuthRepository;
let usp;
if (uspConfig) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const identity = createPostgresIdentityRepository(pool);
  auth = createAuthRepository();
  auth.refresh = () => identity.refresh(auth.directory);
  await auth.refresh();
  usp = {
    client: createUspOAuth(uspConfig),
    saveProfile: identity.saveProfile,
    origin,
  };
} else {
  auth = createAuthRepository(await loadDirectory(process.env));
}
createApp({
  auth,
  usp,
  localLogin: !usp,
  origin,
  secureCookies: process.env.NODE_ENV === "production",
}).listen(port, () => {
  console.log(`Labrary API listening on http://localhost:${port}`);
});
