import { describe, expect, it } from "vitest";
import { generateCopySchema, generateMediaSchema } from "@/features/ai/schemas";
import { campaignSchema } from "@/features/campaigns/schemas";

const id = "cm12345678901234567890123";
describe("AI validation", () => {
  it("limits the variant count", () =>
    expect(
      generateCopySchema.safeParse({
        projectId: id,
        kind: "HOOK",
        brief: "A sufficiently detailed product brief",
        audience: "Hikers",
        tone: "Direct",
        variants: 11,
      }).success,
    ).toBe(false));
  it("rejects short media prompts", () =>
    expect(
      generateMediaSchema.safeParse({
        projectId: id,
        kind: "IMAGE",
        prompt: "short",
      }).success,
    ).toBe(false));
  it("requires provider identifiers for talking avatars", () =>
    expect(
      generateMediaSchema.safeParse({
        projectId: id,
        kind: "TALKING_AVATAR",
        prompt: "A concise founder-led product introduction",
        options: { format: "story" },
      }).success,
    ).toBe(false));
  it("accepts a campaign-ready carousel specification", () =>
    expect(
      generateMediaSchema.safeParse({
        projectId: id,
        kind: "CAROUSEL",
        prompt: "A coordinated product education carousel",
        options: {
          format: "square",
          carouselSlides: [
            {
              headline: "Meet the problem",
              prompt: "Show the customer pain point",
            },
            {
              headline: "See the solution",
              prompt: "Show the product benefit clearly",
            },
          ],
        },
      }).success,
    ).toBe(true));
});
describe("campaign validation", () => {
  it("rejects inverted age ranges", () =>
    expect(
      campaignSchema.safeParse({
        projectId: id,
        platform: "META",
        name: "Spring launch",
        objective: "SALES",
        dailyBudget: 50,
        audience: { locations: ["US"], ageMin: 50, ageMax: 30 },
        creativeAssetIds: [id],
        copy: {
          headline: "Go further",
          primaryText: "A useful and truthful description",
          cta: "SHOP_NOW",
          destinationUrl: "https://example.com",
        },
      }).success,
    ).toBe(false));
});
