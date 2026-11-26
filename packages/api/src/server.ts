import { createMemoryGroupRepository } from "./repositories/groupRepository.js";
import { createMemoryRubricRepository } from "./repositories/rubricRepository.js";
import { createFileRubricStorage } from "./repositories/fileRubricStorage.js";
import { createFileGroupStorage } from "./repositories/fileGroupStorage.js";
import { createPostgresGroupRepository } from "./repositories/postgresGroupRepository.js";
import { createMemoryProjectRepository } from "./repositories/projectRepository.js";
import { createFileProjectStorage } from "./repositories/fileProjectStorage.js";
import { createResultReleaseRepository } from "./repositories/resultReleaseRepository.js";
import { createEvaluationRepository } from "./repositories/evaluationRepository.js";
import { loadDirectory } from "./services/configuration.js";
import { createConfiguredStorage } from "./services/storageConfiguration.js";
import { createPostgresAdminRepository } from "./repositories/postgresAdminRepository.js";
import { Pool } from "pg";
import { createPostgresAcademicAccessRepository } from "./repositories/postgresAcademicAccessRepository.js";
import { createPostgresIdentityRepository } from "./repositories/postgresIdentityRepository.js";
import { createGoogleOAuth } from "./services/googleOAuth.js";
import {
  createPostgresAuthRepository,
  createPostgresOAuthAttempts,
} from "./repositories/postgresAuthRepository.js";
import { loadGoogleConfig } from "./services/googleConfiguration.js";
import { loadDevelopmentTestLogin } from "./services/developmentTestAccounts.js";
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
const developmentTestLogin = loadDevelopmentTestLogin(
  process.env,
  Boolean(googleConfig),
  origin,
);
let auth: AuthRepository;
let google;
let admin;
let groups;
let academicAccess;
if (googleConfig) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  academicAccess = createPostgresAcademicAccessRepository(pool, developmentTestLogin);
  const identity = createPostgresIdentityRepository(pool);
  admin = createPostgresAdminRepository(pool);
  groups = createPostgresGroupRepository(pool);
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
auth.developmentTestLogin = developmentTestLogin;
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
groups ??= createMemoryGroupRepository(
  auth.directory,
  createFileGroupStorage(
    process.env.GROUP_DATA_FILE ?? `${dataFile}.groups.json`,
  ),
);
const app = createApp({
  academicAccess,
  evaluationRepository: createEvaluationRepository(
    process.env.EVALUATION_DATA_FILE ?? `${dataFile}.evaluations.json`,
  ),
  resultReleases: createResultReleaseRepository(
    process.env.RESULT_RELEASE_DATA_FILE ?? `${dataFile}.results.json`,
  ),
  rubrics: createMemoryRubricRepository(
    createFileRubricStorage(
      process.env.RUBRIC_DATA_FILE ?? `${dataFile}.rubrics.json`,
    ),
  ),
  groups,
  repository,
  admin,
  auth,
  google,
  localLogin: !google,
  origin,
  secureCookies: process.env.NODE_ENV === "production",
  storage: createConfiguredStorage(process.env, repositoryRoot, dataFile),
});
const listening = () => {
  console.log(`Labrary API listening on http://localhost:${port}`);
};
if (developmentTestLogin) app.listen(port, "127.0.0.1", listening);
else app.listen(port, listening);
