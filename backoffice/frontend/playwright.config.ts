import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.SCALARIS_E2E_URL || "http://127.0.0.1:8081",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "../../artifacts/playwright",
});
