import { defineConfig } from "@playwright/test";
import base from "./playwright.evaluation.config";

const recordDemo = process.env.RECORD_PUBLICATION_DEMO === "1";
// Instâncias do entrypoint normal, novas e isoladas. Nenhum provedor fabricado.
export default defineConfig({
  ...base,
  testMatch: "**/publication-flow.spec.ts",
  outputDir: "test-results/publication",
  timeout: recordDemo ? 90_000 : 30_000,
  projects: base.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      video: recordDemo ? "on" : "retain-on-failure",
      launchOptions: { slowMo: recordDemo ? 180 : 0 },
    },
  })),
});
