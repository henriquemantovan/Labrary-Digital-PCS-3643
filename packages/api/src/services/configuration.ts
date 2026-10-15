import { readFile } from "node:fs/promises";
import { directorySchema } from "../models/auth.js";
import { createDemoDirectory } from "../fixtures/demo.js";

export async function loadDirectory(env: NodeJS.ProcessEnv) {
  if (env.AUTH_DEMO === "true") {
    if (env.NODE_ENV === "production")
      throw new Error("AUTH_DEMO não é permitido em produção.");
    if (env.AUTH_USERS_FILE)
      throw new Error("Configure apenas AUTH_DEMO ou AUTH_USERS_FILE.");
    return createDemoDirectory();
  }
  if (!env.AUTH_USERS_FILE)
    throw new Error(
      "Configure AUTH_USERS_FILE ou habilite AUTH_DEMO=true para demonstração local.",
    );
  return directorySchema.parse(
    JSON.parse(await readFile(env.AUTH_USERS_FILE, "utf8")),
  );
}
