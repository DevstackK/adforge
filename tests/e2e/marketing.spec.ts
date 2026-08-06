import { expect, test } from "@playwright/test";
test("marketing page communicates the product and entry points", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Forge advertising",
  );
  await expect(
    page.getByRole("link", { name: /Start forging/ }),
  ).toHaveAttribute("href", "/sign-up");
  const response = await page.request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
});

test("public health and OpenAPI endpoints are operational", async ({
  request,
}) => {
  const health = await request.get("/api/v1/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).data.status).toBe("healthy");

  const specification = await request.get("/api/v1/openapi");
  expect(specification.ok()).toBeTruthy();
  const document = await specification.json();
  expect(document.openapi).toMatch(/^3\./);
  expect(document.paths["/campaigns"]).toBeTruthy();
});

test("marketing entry remains usable on a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start forging/ })).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
