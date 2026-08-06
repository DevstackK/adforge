import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing", async () => {
  await clerkSetup();
});

setup("authenticate workspace user", async ({ page }) => {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    emailAddress: process.env.E2E_CLERK_USER_EMAIL!,
  });
  await page.evaluate(async (organizationId) => {
    const clerkClient = (
      window as typeof window & {
        Clerk?: {
          setActive(input: { organization: string }): Promise<void>;
        };
      }
    ).Clerk;
    if (!clerkClient) throw new Error("Clerk browser client did not load");
    await clerkClient.setActive({ organization: organizationId });
  }, process.env.E2E_CLERK_ORGANIZATION_ID!);
  await page.goto("/dashboard");
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  await page.context().storageState({ path: "playwright/.clerk/user.json" });
});
