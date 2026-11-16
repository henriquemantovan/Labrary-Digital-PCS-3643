import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Executado depois da suíte principal, um perfil por vez, para limitar memória.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/grades-flow.spec.ts",
  outputDir: "test-results/grades",
  webServer: [
    {
      command: "pnpm --filter @labrary/api exec tsx integration/gradesFixture.ts",
      url: "http://localhost:3006/api/health",
      reuseExistingServer: false,
      env: {
        GRADES_API_PORT: "3006", GRADES_WEB_PORT: "5182",
        RESULT_RELEASE_DATA_FILE: `../../test-results/grades-${randomUUID()}.json`,
      },
    },
    {
      command: "pnpm --filter @labrary/web dev --port 5182 --strictPort",
      url: "http://localhost:5182",
      reuseExistingServer: false,
      env: { API_PORT: "3006", WEB_PORT: "5182" },
    },
  ],
});
