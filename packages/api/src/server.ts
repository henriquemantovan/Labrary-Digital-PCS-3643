import { createMemoryProjectRepository } from "./repositories/projectRepository.js";
import { createFileProjectStorage } from "./repositories/fileProjectStorage.js";
import { loadDirectory, resolveUploadDir } from "./services/configuration.js";
import { createDiskStorage } from "./services/fileStorage.js";
import { createPostgresAdminRepository } from "./repositories/postgresAdminRepository.js";
import { Pool } from "pg";
import { createPostgresIdentityRepository } from "./repositories/postgresIdentityRepository.js";
import { createGoogleOAuth } from "./services/googleOAuth.js";
import {
  createPostgresAuthRepository,
  createPostgresOAuthAttempts,
} from "./repositories/postgresAuthRepository.js";
import { loadGoogleConfig } from "./services/googleConfiguration.js";
import {
  AuthRepository,
  createAuthRepository,
} from "./repositories/authRepository.js";
import { createApp } from "./app.js";
import { config } from "dotenv";
import { resolve } from "node:path";

const repositoryRoot = resolve(process.cwd(), "../..");
config({ path: resolve(repositoryRoot, ".env") });

const port = Number(process.env.API_PORT ?? 3000);

const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
if (
  process.env.NODE_ENV === "production" &&
  new URL(origin).protocol !== "https:"
) {
  throw new Error("APP_ORIGIN deve usar HTTPS em produção.");
}
const googleConfig = loadGoogleConfig(process.env, origin);
let auth: AuthRepository;
let google;
let admin;
if (googleConfig) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const identity = createPostgresIdentityRepository(pool);
  admin = createPostgresAdminRepository(pool);
  auth = createPostgresAuthRepository(pool);
  await auth.refresh!();
  google = {
    attempts: createPostgresOAuthAttempts(pool),
    client: createGoogleOAuth(googleConfig),
    saveProfile: identity.saveProfile,
    origin,
  };
} else {
  auth = createAuthRepository(await loadDirectory(process.env));
}
const dataFile =
  process.env.PROJECT_DATA_FILE ??
  resolve(
    process.cwd(),
    `../../.data/projects-${google ? "google" : process.env.AUTH_DEMO === "true" ? "demo" : "local"}.json`,
  );
const repository = createMemoryProjectRepository(
  !google,
  createFileProjectStorage(dataFile),
);
createApp({
  repository,
  admin,
  auth,
  google,
  localLogin: !google,
  origin,
  secureCookies: process.env.NODE_ENV === "production",
  storage: createDiskStorage(resolveUploadDir(process.env, repositoryRoot)),
}).listen(port, () => {
  console.log(`Labrary API listening on http://localhost:${port}`);
});
