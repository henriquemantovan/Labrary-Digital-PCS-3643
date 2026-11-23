import { resolve } from "node:path";
import { config } from "dotenv";
import { initializeR2Usage } from "../services/r2Usage.js";
import { loadR2Config } from "../services/storageConfiguration.js";

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
initializeR2Usage(settings.usageFile, settings.scope);
console.log(
  "Controle R2 inicializado. Preserve este arquivo privado entre reinícios; não o recrie para zerar a franquia.",
);
