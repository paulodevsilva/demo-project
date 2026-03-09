import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "npm run build && PORT=4173 ENVIRONMENT=development VITE_ENVIRONMENT=development DATABASE_URL=postgresql://postgres:postgres@localhost:5432/demo_project COOKIE_SECRET=change-me-in-production node .output/server/index.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 180 * 1000,
  },
});
