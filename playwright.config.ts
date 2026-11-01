import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://app_rw:mm_app_dev_only@127.0.0.1:5432/meme_market";
const migratorUrl = process.env.MIGRATOR_DATABASE_URL ?? "postgres://mm_migrator:mm_dev_only@127.0.0.1:5432/meme_market";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Optional: use an already-installed Chromium instead of the one Playwright downloads.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    // Spec: Playwright at 390x844 and desktop. The smoke test also checks 360 wide itself.
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node scripts/migrate.mjs && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      MIGRATOR_DATABASE_URL: migratorUrl,
      APP_URL: "http://localhost:3000",
      EMAIL_CAPTURE: "true",
      RATE_LIMIT_DISABLED: "1",
    },
  },
});
