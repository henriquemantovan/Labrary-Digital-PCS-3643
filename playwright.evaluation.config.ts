import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const runId = randomUUID();
const recordDemo = process.env.RECORD_EVALUATION_DEMO === "1";
const targets = [
  { name: "desktop", webPort: 5184, apiPort: 3008 },
  { name: "mobile", webPort: 5185, apiPort: 3009 },
] as const;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/evaluation.spec.ts",
  outputDir: "test-results/evaluation",
  // Duas rodadas, reabertura e várias trocas de conta: o limite global de
  // 30 s encerrou ações válidas ao final do fluxo neste ambiente. As esperas
  // individuais e todas as asserções permanecem com os limites anteriores.
  timeout: recordDemo ? 90_000 : 60_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: targets.map(({ name, webPort }) => ({
    name,
    use: {
      ...(name === "desktop" ? {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
        video: { mode: "on" as const, size: { width: 1440, height: 960 } },
        launchOptions: { slowMo: recordDemo ? 220 : 0 },
      } : devices["iPhone 13"]),
      defaultBrowserType: "chromium",
      baseURL: `http://localhost:${webPort}`,
    },
  })),
  webServer: targets.flatMap(({ name, webPort, apiPort }) => {
    const data = `../../test-results/evaluation-${runId}-${name}`;
    return [
      {
        command: "pnpm --filter @labrary/api dev",
        url: `http://localhost:${apiPort}/api/health`,
        reuseExistingServer: false,
        env: {
          API_PORT: String(apiPort),
          AUTH_DEMO: "true",
          AUTH_PROVIDER: "local",
          AUTH_USERS_FILE: "",
          APP_ORIGIN: `http://localhost:${webPort}`,
          PROJECT_DATA_FILE: `${data}/projects.json`,
          GROUP_DATA_FILE: `${data}/groups.json`,
          RUBRIC_DATA_FILE: `${data}/rubrics.json`,
          EVALUATION_DATA_FILE: `${data}/evaluations.json`,
          RESULT_RELEASE_DATA_FILE: `${data}/results.json`,
          UPLOAD_DIR: `test-results/evaluation-${runId}-${name}/uploads`,
          STORAGE_PROVIDER: "disk",
        },
      },
      {
        command: `pnpm --filter @labrary/web dev --port ${webPort} --strictPort`,
        url: `http://localhost:${webPort}`,
        reuseExistingServer: false,
        env: { API_PORT: String(apiPort), WEB_PORT: String(webPort) },
      },
    ];
  }),
});
