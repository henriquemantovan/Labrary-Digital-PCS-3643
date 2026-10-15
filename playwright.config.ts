import { defineConfig, devices } from "@playwright/test";
const targets = [
  { name: "desktop", webPort: 5179, apiPort: 3002 },
  { name: "mobile", webPort: 5180, apiPort: 3003 },
];
export default defineConfig({
  testDir: "./e2e",
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
  webServer: targets.flatMap(({ webPort, apiPort }) => [
    {
      command: "pnpm --filter @labrary/api dev",
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: false,
      env: {
        API_PORT: String(apiPort),
        AUTH_DEMO: "true",
        AUTH_USERS_FILE: "",
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
});
