import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  // In CI we also emit an HTML report into ./playwright-report so the
  // workflow can upload it as a build artifact (see .github/workflows/test.yml).
  // `open: "never"` keeps `playwright test` from launching a browser locally
  // when CI=1 is set ad-hoc.
  reporter: process.env.CI
    ? [
        ["github"],
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "list",
  expect: { timeout: 5_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    storageState: "./e2e/.admin-state.json",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  webServer: {
    command:
      process.env.BROWSLATRO_SERVER_MODE === "production"
        ? "node scripts/serve.ts"
        : `yarn vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    env: { PORT: String(PORT), HOST: "127.0.0.1" },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
