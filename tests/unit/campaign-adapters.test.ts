import { afterEach, describe, expect, it, vi } from "vitest";
import { platformAdapter } from "@/features/campaigns/adapters";

vi.mock("@/server/storage", () => ({
  getObjectBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
  createDownloadUrl: vi.fn(async () => "https://storage.example/signed-image"),
}));

const campaign = {
  id: "campaign_local_1",
  name: "Trail launch",
  objective: "TRAFFIC",
  dailyBudget: 25,
  currency: "USD",
  audience: { locations: ["US"], ageMin: 18, ageMax: 55 },
  creatives: [
    {
      id: "creative_local_1",
      position: 0,
      copy: {
        headline: "Built for the trail",
        primaryText: "Carry more comfortably on every weekend route.",
        description: "See the collection.",
        cta: "LEARN_MORE",
        destinationUrl: "https://example.com/trail",
      },
      asset: { type: "IMAGE" },
    },
  ],
  adConnection: { metadata: {} },
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
});

describe("advertising provider contracts", () => {
  it("creates Meta campaign, ad set, uploaded creative and paused ad", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/campaigns")) return Response.json({ id: "10" });
      if (url.endsWith("/adsets")) return Response.json({ id: "20" });
      if (url.endsWith("/adimages"))
        return Response.json({
          images: { "creative.png": { hash: "hash-30" } },
        });
      if (url.endsWith("/adcreatives")) return Response.json({ id: "30" });
      return Response.json({ id: "40" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await platformAdapter("META").publish(
      {
        ...campaign,
        adConnection: { metadata: { pageId: "page-1" } },
      } as never,
      "access-token",
      "123",
    );
    expect(result.externalId).toBe("10");
    expect(result.creatives).toEqual([
      { localId: "creative_local_1", externalId: "40" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("publishes multiple Meta images as one native carousel ad", async () => {
    let image = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/campaigns")) return Response.json({ id: "10" });
      if (url.endsWith("/adsets")) return Response.json({ id: "20" });
      if (url.endsWith("/adimages"))
        return Response.json({
          images: { [`slide-${image}.png`]: { hash: `hash-${++image}` } },
        });
      if (url.endsWith("/adcreatives")) {
        const story = JSON.parse(
          String((init?.body as URLSearchParams).get("object_story_spec")),
        ) as { link_data: { child_attachments: unknown[] } };
        expect(story.link_data.child_attachments).toHaveLength(2);
        return Response.json({ id: "30" });
      }
      return Response.json({ id: "40" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const second = {
      ...campaign.creatives[0],
      id: "creative_local_2",
      position: 1,
    };
    const result = await platformAdapter("META").publish(
      {
        ...campaign,
        settings: { creativeFormat: "CAROUSEL" },
        creatives: [campaign.creatives[0], second],
        adConnection: { metadata: { pageId: "page-1" } },
      } as never,
      "access-token",
      "123",
    );
    expect(result.creatives).toEqual([
      { localId: "creative_local_1", externalId: "40" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("builds a complete Google Search hierarchy in one atomic mutation", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer-token";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        mutateOperations: unknown[];
        partialFailure: boolean;
      };
      expect(request.partialFailure).toBe(false);
      expect(request.mutateOperations).toHaveLength(5);
      return new Response(
        JSON.stringify({
          mutateOperationResponses: [
            {
              campaignBudgetResult: {
                resourceName: "customers/123/campaignBudgets/10",
              },
            },
            { campaignResult: { resourceName: "customers/123/campaigns/20" } },
            { adGroupResult: { resourceName: "customers/123/adGroups/30" } },
            {
              adGroupCriterionResult: {
                resourceName: "customers/123/adGroupCriteria/40",
              },
            },
            {
              adGroupAdResult: { resourceName: "customers/123/adGroupAds/50" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await platformAdapter("GOOGLE").publish(
      campaign as never,
      "access-token",
      "123",
    );
    expect(result.externalId).toBe("20");
    expect(result.status).toBe("PAUSED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses current LinkedIn headers and creates both campaign and creative", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("LinkedIn-Version")).toBe("202607");
      if (url.includes("adTargetingEntities"))
        return Response.json({ elements: [{ urn: "urn:li:geo:103644278" }] });
      if (url.endsWith("/adCampaigns"))
        return new Response("{}", {
          status: 201,
          headers: { "x-restli-id": "700" },
        });
      return new Response("{}", {
        status: 201,
        headers: { "x-restli-id": "800" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await platformAdapter("LINKEDIN").publish(
      campaign as never,
      "access-token",
      "123",
    );
    expect(result.externalId).toBe("700");
    expect((result.raw as { creativeId: string }).creativeId).toBe("800");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("creates TikTok campaign, ad group, media and paused ad", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("campaign/create"))
        return Response.json({ code: 0, data: { campaign_id: "10" } });
      if (url.includes("tool/region"))
        return Response.json({
          code: 0,
          data: { list: [{ region_code: "US", region_id: "6252001" }] },
        });
      if (url.includes("adgroup/create"))
        return Response.json({ code: 0, data: { adgroup_id: "20" } });
      if (url.includes("file/image"))
        return Response.json({ code: 0, data: { image_id: "30" } });
      return Response.json({ code: 0, data: { ad_ids: ["40"] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await platformAdapter("TIKTOK").publish(
      {
        ...campaign,
        adConnection: { metadata: { identityId: "identity-1" } },
      } as never,
      "access-token",
      "123",
    );
    expect(result.externalId).toBe("10");
    expect(result.creatives).toEqual([
      { localId: "creative_local_1", externalId: "40" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("creates Pinterest campaign, ad group, Pin and paused ad", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/campaigns"))
        return Response.json({ items: [{ id: "10" }] });
      if (url.endsWith("/ad_groups"))
        return Response.json({ items: [{ id: "20" }] });
      if (url.endsWith("/pins")) return Response.json({ id: "30" });
      return Response.json({ items: [{ id: "40" }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await platformAdapter("PINTEREST").publish(
      {
        ...campaign,
        adConnection: { metadata: { boardId: "board-1" } },
      } as never,
      "access-token",
      "123",
    );
    expect(result.externalId).toBe("10");
    expect(result.creatives).toEqual([
      { localId: "creative_local_1", externalId: "40" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
