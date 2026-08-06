import { defineConfig, devices } from "@playwright/test";
const authenticated = Boolean(
  process.env.E2E_CLERK_USER_EMAIL &&
  process.env.E2E_CLERK_ORGANIZATION_ID &&
  process.env.CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY,
);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      testMatch: /marketing\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    ...(authenticated
      ? [
          {
            name: "clerk-setup",
            testMatch: /global\.setup\.ts/,
          },
          {
            name: "authenticated",
            testMatch: /authenticated\.spec\.ts/,
            dependencies: ["clerk-setup"],
            use: {
              ...devices["Desktop Chrome"],
              storageState: "playwright/.clerk/user.json",
            },
          },
        ]
      : []),
  ],
});
