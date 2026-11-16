import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// O fluxo alterna vários logins; não compartilha a cota por IP com outras suítes.
// Mantém o entrypoint real, o limite de autenticação e as instâncias por perfil.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/submission.spec.ts",
  outputDir: "test-results/submission",
});
