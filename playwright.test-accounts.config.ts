import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/development-test-login.spec.ts",
  outputDir: "test-results/test-accounts",
  projects: base.projects!.map((project) => ({ ...project, use: { ...project.use, baseURL: project.name === "desktop" ? "http://localhost:5186" : "http://localhost:5188" } })),
  webServer: [
    {
      command: "pnpm --filter @labrary/api exec tsx integration/developmentTestLoginFixture.ts",
      url: "http://127.0.0.1:3010/api/health", reuseExistingServer: false,
    },
    ...[{ webPort: 5186, apiPort: 3010 }, { webPort: 5187, apiPort: 3011 }, { webPort: 5188, apiPort: 3012 }, { webPort: 5189, apiPort: 3013 }].map(({ webPort, apiPort }) => ({
      command: `pnpm --filter @labrary/web dev --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`, reuseExistingServer: false,
      env: { API_PORT: String(apiPort), WEB_PORT: String(webPort) },
    })),
  ],
});
