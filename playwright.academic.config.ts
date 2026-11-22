import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Uma nova instância preserva a cota de login por IP dos demais fluxos.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/google-academic.spec.ts",
  outputDir: "test-results/academic",
  webServer: [
    {
      command:
        "pnpm --filter @labrary/api exec tsx integration/googleFixture.ts",
      url: "http://localhost:3004/api/health",
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @labrary/web dev --port 5181 --strictPort",
      url: "http://localhost:5181",
      reuseExistingServer: false,
      env: { API_PORT: "3004", WEB_PORT: "5181" },
    },
  ],
});
