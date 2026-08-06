import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { featureFlag: { findUnique } },
}));

import { isFeatureEnabled } from "@/server/features";

describe("feature rollout", () => {
  beforeEach(() => findUnique.mockReset());

  it("uses the caller default when a flag has not been configured", async () => {
    findUnique.mockResolvedValue(null);
    await expect(isFeatureEnabled("unknown", "org_1", false)).resolves.toBe(
      false,
    );
  });

  it("gives explicit deny rules precedence over allow rules", async () => {
    findUnique.mockResolvedValue({
      enabled: true,
      rules: {
        allowOrganizations: ["org_1"],
        denyOrganizations: ["org_1"],
        rolloutPercentage: 100,
      },
    });
    await expect(isFeatureEnabled("avatars", "org_1")).resolves.toBe(false);
  });

  it("keeps percentage assignment stable for a tenant", async () => {
    findUnique.mockResolvedValue({
      enabled: true,
      rules: { rolloutPercentage: 37 },
    });
    const first = await isFeatureEnabled("new-builder", "org_stable");
    const second = await isFeatureEnabled("new-builder", "org_stable");
    expect(second).toBe(first);
  });
});
