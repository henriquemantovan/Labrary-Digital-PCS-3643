import { loadDirectory, resolveUploadDir } from "./services/configuration.js";
import { createDiskStorage } from "./services/fileStorage.js";
import { createAuthRepository } from "./repositories/authRepository.js";
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
const auth = createAuthRepository(await loadDirectory(process.env));
createApp({
  auth,
  origin,
  secureCookies: process.env.NODE_ENV === "production",
  storage: createDiskStorage(resolveUploadDir(process.env, repositoryRoot)),
}).listen(port, () => {
  console.log(`Labrary API listening on http://localhost:${port}`);
});
