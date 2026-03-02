import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL ?? "http://127.0.0.1:3310";

export default defineConfig({
  testDir: "./tests/analytics",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/analytics-results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "unit",
      testDir: "./tests/analytics/unit",
    },
    {
      name: "integration",
      testDir: "./tests/analytics/integration",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "desktop",
      testDir: "./tests/analytics/e2e",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile",
      testDir: "./tests/analytics/e2e",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "PORT=3310 PORTAL_DEV_BYPASS_AUTH=true PORTAL_DATA_PROVIDER_MODE=mock GCP_PROJECT_ID=test-project BIGQUERY_DATASET=test_dataset GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test NEXTAUTH_SECRET=test pnpm dev --port 3310",
    url: `${baseURL}/chart-ui-demo`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
