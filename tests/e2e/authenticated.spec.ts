import { expect, test } from "@playwright/test";

test("authenticated workspace navigation and project lifecycle", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Good morning/ }),
  ).toBeVisible();

  await page.goto("/products");
  const name = `E2E project ${Date.now()}`;
  await page.getByLabel("New project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const projects = await page.request.get(
    "/api/v1/projects?includeArchived=true",
  );
  expect(projects.ok()).toBeTruthy();
  const body = (await projects.json()) as {
    data: Array<{ id: string; name: string }>;
  };
  const project = body.data.find((item) => item.name === name);
  expect(project).toBeTruthy();
  const archived = await page.request.patch(`/api/v1/projects/${project!.id}`, {
    data: { status: "ARCHIVED" },
  });
  expect(archived.ok()).toBeTruthy();

  for (const route of [
    "/copy-studio",
    "/image-studio",
    "/video-studio",
    "/campaigns",
    "/analytics",
    "/team",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
  }
});
