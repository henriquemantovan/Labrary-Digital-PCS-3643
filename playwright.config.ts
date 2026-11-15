import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
const runId = randomUUID();
const targets = [
  { name: "desktop", webPort: 5179, apiPort: 3002 },
  { name: "mobile", webPort: 5180, apiPort: 3003 },
];
export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/grades-flow.spec.ts", "**/submission.spec.ts"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: targets.map(({ name, webPort }) => ({
    name,
    use: {
      ...(name === "desktop"
        ? {
            ...devices["Desktop Chrome"],
            viewport: { width: 1440, height: 960 },
          }
        : devices["iPhone 13"]),
      defaultBrowserType: "chromium",
      baseURL: `http://localhost:${webPort}`,
    },
  })),
  webServer: [
    ...[
      { apiPort: 3006, webPort: 5182 },
      { apiPort: 3007, webPort: 5183 },
    ].flatMap(({ apiPort, webPort }) => [
      {
        command:
          "pnpm --filter @labrary/api exec tsx integration/publicationFixture.ts",
        url: `http://localhost:${apiPort}/api/health`,
        reuseExistingServer: false,
        env: {
          PUBLICATION_FIXTURE_PORT: String(apiPort),
          APP_ORIGIN: `http://localhost:${webPort}`,
        },
      },
      {
        command: `pnpm --filter @labrary/web dev --port ${webPort} --strictPort`,
        url: `http://localhost:${webPort}`,
        reuseExistingServer: false,
        env: { API_PORT: String(apiPort), WEB_PORT: String(webPort) },
      },
    ]),
    ...targets.flatMap(({ name, webPort, apiPort }) => [
      {
        command: "pnpm --filter @labrary/api dev",
        url: `http://localhost:${apiPort}/api/health`,
        reuseExistingServer: false,
        env: {
          API_PORT: String(apiPort),
          AUTH_DEMO: "true",
          AUTH_PROVIDER: "local",
          PROJECT_DATA_FILE: `../../test-results/projects-${runId}-${name}.json`,
          GROUP_DATA_FILE: `../../test-results/groups-${runId}-${name}.json`,
          AUTH_USERS_FILE: "",
          APP_ORIGIN: `http://localhost:${webPort}`,
          UPLOAD_DIR: `test-results/uploads-${runId}-${name}`,
        },
      },
      {
        command: `pnpm --filter @labrary/web dev --port ${webPort} --strictPort`,
        url: `http://localhost:${webPort}`,
        reuseExistingServer: false,
        env: { API_PORT: String(apiPort), WEB_PORT: String(webPort) },
      },
    ]),
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
