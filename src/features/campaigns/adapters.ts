import { AppError } from "@/lib/errors";
import { createDownloadUrl, getObjectBytes } from "@/server/storage";
import type {
  AdConnection,
  Asset,
  Campaign,
  CampaignCreative,
} from "@/generated/prisma/client";

type Publishable = Campaign & {
  creatives: Array<CampaignCreative & { asset: Asset }>;
  adConnection: AdConnection;
};
type MetricCampaign = Campaign & { creatives: CampaignCreative[] };
type AdCopy = {
  headline: string;
  primaryText: string;
  description?: string;
  cta: string;
  destinationUrl: string;
};

function campaignCopy(campaign: Publishable): AdCopy {
  const copy = campaign.creatives[0]?.copy as Partial<AdCopy> | undefined;
  if (!copy?.headline || !copy.primaryText || !copy.cta || !copy.destinationUrl)
    throw new AppError(
      "Campaign creative copy is incomplete",
      "INVALID_CAMPAIGN_CREATIVE",
      422,
    );
  return copy as AdCopy;
}

function distinctText(values: string[], max: number) {
  return [...new Set(values.map((value) => value.trim().slice(0, max)))].filter(
    Boolean,
  );
}

function assertTikTok(result: Record<string, unknown>) {
  const code = Number(result.code ?? 0);
  if (code !== 0)
    throw new AppError(
      String(result.message ?? "TikTok rejected the request"),
      "PLATFORM_ERROR",
      502,
      result,
    );
  return result;
}
export interface PublishResult {
  externalId: string;
  status: "ACTIVE" | "PAUSED";
  raw: unknown;
  creatives?: Array<{ localId: string; externalId: string }>;
}
export interface MetricsResult {
  impressions: bigint;
  clicks: bigint;
  conversions: number;
  spend: number;
  revenue: number;
  raw: unknown;
  creatives?: Array<{
    externalId: string;
    impressions: bigint;
    clicks: bigint;
    conversions: number;
    spend: number;
    revenue: number;
    raw: unknown;
  }>;
}
export interface AdPlatformAdapter {
  publish(
    campaign: Publishable,
    token: string,
    accountId: string,
  ): Promise<PublishResult>;
  metrics(
    campaign: MetricCampaign,
    token: string,
    accountId: string,
  ): Promise<MetricsResult>;
  setStatus(
    campaign: Campaign,
    token: string,
    accountId: string,
    status: "ACTIVE" | "PAUSED",
  ): Promise<void>;
}

async function requestJson(url: string, init: RequestInit) {
  return (await requestJsonResponse(url, init)).body;
}

async function requestJsonResponse(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AppError(
      "Advertising platform rejected the request",
      "PLATFORM_ERROR",
      502,
      { status: response.status, body },
    );
  return { body: body as Record<string, unknown>, headers: response.headers };
}

class MetaAdapter implements AdPlatformAdapter {
  async setStatus(
    campaign: Campaign,
    token: string,
    _accountId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    await requestJson(
      `https://graph.facebook.com/v23.0/${campaign.externalId}`,
      {
        method: "POST",
        body: new URLSearchParams({ status, access_token: token }),
      },
    );
  }
  async publish(campaign: Publishable, token: string, accountId: string) {
    const metadata = campaign.adConnection.metadata as Record<string, unknown>;
    const pageId =
      typeof metadata.pageId === "string" ? metadata.pageId : undefined;
    if (!pageId)
      throw new AppError(
        "Select a Meta Page in connection settings before publishing",
        "META_PAGE_REQUIRED",
        422,
      );
    const objective =
      (
        {
          SALES: "OUTCOME_SALES",
          LEADS: "OUTCOME_LEADS",
          TRAFFIC: "OUTCOME_TRAFFIC",
          AWARENESS: "OUTCOME_AWARENESS",
          APP_PROMOTION: "OUTCOME_APP_PROMOTION",
        } as Record<string, string>
      )[campaign.objective] ?? "OUTCOME_TRAFFIC";
    const body = new URLSearchParams({
      name: campaign.name,
      objective,
      status: "PAUSED",
      special_ad_categories: "[]",
      access_token: token,
    });
    const result = await requestJson(
      `https://graph.facebook.com/v23.0/act_${accountId}/campaigns`,
      { method: "POST", body },
    );
    const campaignId = String(result.id ?? "");
    if (!campaignId)
      throw new AppError(
        "Meta did not return a campaign ID",
        "PLATFORM_ERROR",
        502,
        result,
      );
    const audience = campaign.audience as {
      locations?: string[];
      ageMin?: number;
      ageMax?: number;
      genders?: string[];
    };
    const countries = (audience.locations ?? []).filter((location) =>
      /^[A-Z]{2}$/.test(location),
    );
    if (!countries.length)
      throw new AppError(
        "Meta audiences require at least one ISO country code",
        "INVALID_AUDIENCE",
        422,
      );
    const optimizationGoal =
      campaign.objective === "AWARENESS"
        ? "REACH"
        : campaign.objective === "LEADS"
          ? "LEAD_GENERATION"
          : campaign.objective === "SALES"
            ? "OFFSITE_CONVERSIONS"
            : campaign.objective === "APP_PROMOTION"
              ? "APP_INSTALLS"
              : "LANDING_PAGE_VIEWS";
    const promotedObject =
      campaign.objective === "SALES"
        ? metadata.pixelId
          ? { pixel_id: metadata.pixelId, custom_event_type: "PURCHASE" }
          : undefined
        : campaign.objective === "LEADS"
          ? { page_id: pageId }
          : campaign.objective === "APP_PROMOTION" && metadata.appId
            ? {
                application_id: metadata.appId,
                object_store_url: campaignCopy(campaign).destinationUrl,
              }
            : undefined;
    if (
      ["SALES", "APP_PROMOTION"].includes(campaign.objective) &&
      !promotedObject
    )
      throw new AppError(
        `Meta ${campaign.objective.toLowerCase()} campaigns require ${campaign.objective === "SALES" ? "a pixel" : "an app ID"} in connection settings`,
        "META_PROMOTED_OBJECT_REQUIRED",
        422,
      );
    const adSet = await requestJson(
      `https://graph.facebook.com/v23.0/act_${accountId}/adsets`,
      {
        method: "POST",
        body: new URLSearchParams({
          name: `${campaign.name} audience`,
          campaign_id: campaignId,
          daily_budget: String(Math.round(Number(campaign.dailyBudget) * 100)),
          billing_event: "IMPRESSIONS",
          optimization_goal: optimizationGoal,
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: JSON.stringify({
            geo_locations: { countries },
            age_min: audience.ageMin ?? 18,
            age_max: audience.ageMax ?? 65,
          }),
          ...(promotedObject
            ? { promoted_object: JSON.stringify(promotedObject) }
            : {}),
          status: "PAUSED",
          access_token: token,
        }),
      },
    );
    const adSetId = String(adSet.id ?? "");
    if (!adSetId)
      throw new AppError(
        "Meta did not return an ad set ID",
        "PLATFORM_ERROR",
        502,
        adSet,
      );
    const copy = campaignCopy(campaign);
    const publishedCreatives: Array<{ localId: string; externalId: string }> =
      [];
    const providerResponses: unknown[] = [];
    const creativeFormat = (
      (campaign.settings ?? {}) as { creativeFormat?: string }
    ).creativeFormat;
    if (creativeFormat === "CAROUSEL") {
      if (
        campaign.creatives.length < 2 ||
        campaign.creatives.some((item) => item.asset.type !== "IMAGE")
      )
        throw new AppError(
          "Meta carousel publishing requires at least two images",
          "INVALID_CAMPAIGN_CREATIVE",
          422,
        );
      const childAttachments = [];
      for (const item of campaign.creatives) {
        const form = new FormData();
        form.set("access_token", token);
        const bytes = await getObjectBytes(item.asset.storageKey);
        const arrayBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        form.set(
          "filename",
          new Blob([arrayBuffer], { type: item.asset.mimeType }),
          item.asset.name,
        );
        const uploaded = await requestJson(
          `https://graph.facebook.com/v23.0/act_${accountId}/adimages`,
          { method: "POST", body: form },
        );
        const image = Object.values(
          (uploaded.images as Record<string, { hash?: string }> | undefined) ??
            {},
        )[0];
        if (!image?.hash)
          throw new AppError(
            "Meta carousel image upload failed",
            "PLATFORM_ERROR",
            502,
            uploaded,
          );
        const itemCopy = item.copy as Partial<AdCopy>;
        childAttachments.push({
          image_hash: image.hash,
          link: copy.destinationUrl,
          name: itemCopy.headline || copy.headline,
          description: itemCopy.description || copy.description,
          call_to_action: {
            type: itemCopy.cta || copy.cta,
            value: { link: copy.destinationUrl },
          },
        });
      }
      const creative = await requestJson(
        `https://graph.facebook.com/v23.0/act_${accountId}/adcreatives`,
        {
          method: "POST",
          body: new URLSearchParams({
            name: `${campaign.name} carousel creative`,
            object_story_spec: JSON.stringify({
              page_id: pageId,
              link_data: {
                link: copy.destinationUrl,
                message: copy.primaryText,
                name: copy.headline,
                child_attachments: childAttachments,
                multi_share_optimized: true,
              },
            }),
            access_token: token,
          }),
        },
      );
      const creativeId = String(creative.id ?? "");
      if (!creativeId)
        throw new AppError(
          "Meta did not return a carousel creative ID",
          "PLATFORM_ERROR",
          502,
          creative,
        );
      const ad = await requestJson(
        `https://graph.facebook.com/v23.0/act_${accountId}/ads`,
        {
          method: "POST",
          body: new URLSearchParams({
            name: `${campaign.name} carousel ad`,
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: "PAUSED",
            access_token: token,
          }),
        },
      );
      const adId = String(ad.id ?? "");
      if (!adId)
        throw new AppError(
          "Meta did not return a carousel ad ID",
          "PLATFORM_ERROR",
          502,
          ad,
        );
      return {
        externalId: campaignId,
        status: "PAUSED" as const,
        raw: { campaign: result, adSet, carousel: { creative, ad } },
        creatives: [{ localId: campaign.creatives[0]!.id, externalId: adId }],
      };
    }
    for (const item of campaign.creatives) {
      let media: Record<string, unknown>;
      if (item.asset.type === "VIDEO") {
        const uploaded = await requestJson(
          `https://graph.facebook.com/v23.0/act_${accountId}/advideos`,
          {
            method: "POST",
            body: new URLSearchParams({
              file_url: await createDownloadUrl(item.asset.storageKey),
              title: item.asset.name,
              access_token: token,
            }),
          },
        );
        if (!uploaded.id)
          throw new AppError(
            "Meta video upload failed",
            "PLATFORM_ERROR",
            502,
            uploaded,
          );
        media = {
          video_data: {
            video_id: String(uploaded.id),
            message: copy.primaryText,
            title: copy.headline,
            call_to_action: {
              type: copy.cta,
              value: { link: copy.destinationUrl },
            },
          },
        };
      } else {
        const form = new FormData();
        form.set("access_token", token);
        const bytes = await getObjectBytes(item.asset.storageKey);
        const arrayBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        form.set(
          "filename",
          new Blob([arrayBuffer], {
            type: item.asset.mimeType,
          }),
          item.asset.name,
        );
        const uploaded = await requestJson(
          `https://graph.facebook.com/v23.0/act_${accountId}/adimages`,
          { method: "POST", body: form },
        );
        const image = Object.values(
          (uploaded.images as Record<string, { hash?: string }> | undefined) ??
            {},
        )[0];
        if (!image?.hash)
          throw new AppError(
            "Meta image upload failed",
            "PLATFORM_ERROR",
            502,
            uploaded,
          );
        media = {
          link_data: {
            image_hash: image.hash,
            link: copy.destinationUrl,
            message: copy.primaryText,
            name: copy.headline,
            description: copy.description,
            call_to_action: {
              type: copy.cta,
              value: { link: copy.destinationUrl },
            },
          },
        };
      }
      const creative = await requestJson(
        `https://graph.facebook.com/v23.0/act_${accountId}/adcreatives`,
        {
          method: "POST",
          body: new URLSearchParams({
            name: `${campaign.name} creative ${item.position + 1}`,
            object_story_spec: JSON.stringify({ page_id: pageId, ...media }),
            access_token: token,
          }),
        },
      );
      const creativeId = String(creative.id ?? "");
      if (!creativeId)
        throw new AppError(
          "Meta did not return a creative ID",
          "PLATFORM_ERROR",
          502,
          creative,
        );
      const ad = await requestJson(
        `https://graph.facebook.com/v23.0/act_${accountId}/ads`,
        {
          method: "POST",
          body: new URLSearchParams({
            name: `${campaign.name} ad ${item.position + 1}`,
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: "PAUSED",
            access_token: token,
          }),
        },
      );
      const adId = String(ad.id ?? "");
      if (!adId)
        throw new AppError(
          "Meta did not return an ad ID",
          "PLATFORM_ERROR",
          502,
          ad,
        );
      publishedCreatives.push({ localId: item.id, externalId: adId });
      providerResponses.push({ creative, ad });
    }
    return {
      externalId: campaignId,
      status: "PAUSED" as const,
      raw: { campaign: result, adSet, creatives: providerResponses },
      creatives: publishedCreatives,
    };
  }
  async metrics(campaign: Campaign, token: string) {
    const params = new URLSearchParams({
      fields: "impressions,clicks,spend,actions,action_values",
      access_token: token,
      date_preset: "today",
    });
    const result = await requestJson(
      `https://graph.facebook.com/v23.0/${campaign.externalId}/insights?${params}`,
      { method: "GET" },
    );
    const row =
      (result.data as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
    const actions =
      (row.actions as
        Array<{ action_type: string; value: string }> | undefined) ?? [];
    const values =
      (row.action_values as
        Array<{ action_type: string; value: string }> | undefined) ?? [];
    const conversions = actions
      .filter((action) => /purchase|lead|conversion/.test(action.action_type))
      .reduce((sum, action) => sum + Number(action.value || 0), 0);
    const revenue = values
      .filter((action) => /purchase|conversion/.test(action.action_type))
      .reduce((sum, action) => sum + Number(action.value || 0), 0);
    const creativeParams = new URLSearchParams({
      fields: "ad_id,impressions,clicks,spend,actions,action_values",
      access_token: token,
      date_preset: "today",
      level: "ad",
      limit: "500",
    });
    const creativeResult = await requestJson(
      `https://graph.facebook.com/v23.0/${campaign.externalId}/insights?${creativeParams}`,
      { method: "GET" },
    );
    const creativeRows =
      (creativeResult.data as Array<Record<string, unknown>> | undefined) ?? [];
    const creativeMetrics = creativeRows.map((creativeRow) => {
      const rowActions =
        (creativeRow.actions as
          Array<{ action_type: string; value: string }> | undefined) ?? [];
      const rowValues =
        (creativeRow.action_values as
          Array<{ action_type: string; value: string }> | undefined) ?? [];
      return {
        externalId: String(creativeRow.ad_id),
        impressions: BigInt(String(creativeRow.impressions ?? 0)),
        clicks: BigInt(String(creativeRow.clicks ?? 0)),
        conversions: rowActions
          .filter((action) =>
            /purchase|lead|conversion/.test(action.action_type),
          )
          .reduce((sum, action) => sum + Number(action.value || 0), 0),
        spend: Number(creativeRow.spend ?? 0),
        revenue: rowValues
          .filter((action) => /purchase|conversion/.test(action.action_type))
          .reduce((sum, action) => sum + Number(action.value || 0), 0),
        raw: creativeRow,
      };
    });
    return {
      impressions: BigInt(String(row.impressions ?? 0)),
      clicks: BigInt(String(row.clicks ?? 0)),
      conversions,
      spend: Number(row.spend ?? 0),
      revenue,
      raw: { campaign: result, creatives: creativeResult },
      creatives: creativeMetrics,
    };
  }
}

class TikTokAdapter implements AdPlatformAdapter {
  async setStatus(
    campaign: Campaign,
    token: string,
    accountId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    assertTikTok(
      await requestJson(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/status/update/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": token,
          },
          body: JSON.stringify({
            advertiser_id: accountId,
            campaign_ids: [campaign.externalId],
            operation_status: status === "ACTIVE" ? "ENABLE" : "DISABLE",
          }),
        },
      ),
    );
  }
  async publish(campaign: Publishable, token: string, accountId: string) {
    const headers = {
      "Content-Type": "application/json",
      "Access-Token": token,
    };
    const metadata = campaign.adConnection.metadata as Record<string, unknown>;
    const identityId =
      typeof metadata.identityId === "string" ? metadata.identityId : undefined;
    if (!identityId)
      throw new AppError(
        "Configure a TikTok advertising identity before publishing",
        "TIKTOK_IDENTITY_REQUIRED",
        422,
      );
    const objective =
      (
        {
          SALES: "WEB_CONVERSIONS",
          LEADS: "LEAD_GENERATION",
          TRAFFIC: "TRAFFIC",
          AWARENESS: "REACH",
          APP_PROMOTION: "APP_PROMOTION",
        } as Record<string, string>
      )[campaign.objective] ?? "TRAFFIC";
    const result = assertTikTok(
      await requestJson(
        "https://business-api.tiktok.com/open_api/v1.3/campaign/create/",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            advertiser_id: accountId,
            campaign_name: campaign.name,
            objective_type: objective,
            budget_mode: "BUDGET_MODE_DAY",
            budget: Number(campaign.dailyBudget),
            operation_status: "DISABLE",
          }),
        },
      ),
    );
    const data = result.data as Record<string, unknown> | undefined;
    const campaignId = String(data?.campaign_id ?? "");
    if (!campaignId)
      throw new AppError(
        "TikTok did not return a campaign ID",
        "PLATFORM_ERROR",
        502,
        result,
      );
    const audience = campaign.audience as {
      locations?: string[];
      ageMin?: number;
      ageMax?: number;
    };
    const regionResult = assertTikTok(
      await requestJson(
        `https://business-api.tiktok.com/open_api/v1.3/tool/region/?${new URLSearchParams(
          {
            advertiser_id: accountId,
            placements: JSON.stringify(["PLACEMENT_TIKTOK"]),
          },
        )}`,
        { headers: { "Access-Token": token } },
      ),
    );
    const regionList =
      (regionResult.data as { list?: Array<Record<string, unknown>> })?.list ??
      [];
    const locationIds = (audience.locations ?? []).map((location) => {
      const region = regionList.find(
        (item) =>
          String(item.region_code ?? item.country_code ?? "").toUpperCase() ===
          location.toUpperCase(),
      );
      return region ? String(region.region_id ?? region.location_id) : location;
    });
    const schedule = (campaign.schedule ?? {}) as {
      startAt?: string;
      endAt?: string;
    };
    const time = (value: string | undefined, fallback: number) =>
      new Date(value ?? fallback).toISOString().slice(0, 19).replace("T", " ");
    const optimizationGoal =
      campaign.objective === "AWARENESS"
        ? "REACH"
        : campaign.objective === "SALES"
          ? "CONVERT"
          : campaign.objective === "LEADS"
            ? "LEAD_GENERATION"
            : campaign.objective === "APP_PROMOTION"
              ? "INSTALL"
              : "CLICK";
    const adGroupResult = assertTikTok(
      await requestJson(
        "https://business-api.tiktok.com/open_api/v1.3/adgroup/create/",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            advertiser_id: accountId,
            campaign_id: campaignId,
            adgroup_name: `${campaign.name} audience`,
            promotion_type:
              campaign.objective === "APP_PROMOTION" ? "APP" : "WEBSITE",
            placement_type: "PLACEMENT_TYPE_AUTOMATIC",
            location_ids: locationIds,
            age_groups: [
              "AGE_18_24",
              "AGE_25_34",
              "AGE_35_44",
              "AGE_45_54",
              "AGE_55_100",
            ],
            optimization_goal: optimizationGoal,
            billing_event: campaign.objective === "AWARENESS" ? "CPM" : "CPC",
            bid_type: "BID_TYPE_NO_BID",
            budget_mode: "BUDGET_MODE_DAY",
            budget: Number(campaign.dailyBudget),
            schedule_type: "SCHEDULE_START_END",
            schedule_start_time: time(
              schedule.startAt,
              Date.now() + 15 * 60_000,
            ),
            schedule_end_time: time(
              schedule.endAt,
              Date.now() + 30 * 24 * 60 * 60_000,
            ),
            operation_status: "DISABLE",
            ...(metadata.pixelId && campaign.objective === "SALES"
              ? {
                  pixel_id: metadata.pixelId,
                  optimization_event: "COMPLETE_PAYMENT",
                }
              : {}),
            ...(metadata.appId && campaign.objective === "APP_PROMOTION"
              ? { app_id: metadata.appId }
              : {}),
          }),
        },
      ),
    );
    const adGroupId = String(
      (adGroupResult.data as Record<string, unknown> | undefined)?.adgroup_id ??
        "",
    );
    if (!adGroupId)
      throw new AppError(
        "TikTok did not return an ad group ID",
        "PLATFORM_ERROR",
        502,
        adGroupResult,
      );
    const copy = campaignCopy(campaign);
    const creativeMappings: Array<{ localId: string; externalId: string }> = [];
    const adResponses: unknown[] = [];
    for (const item of campaign.creatives) {
      const form = new FormData();
      form.set("advertiser_id", accountId);
      const bytes = await getObjectBytes(item.asset.storageKey);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const isVideo = item.asset.type === "VIDEO";
      form.set("upload_type", "UPLOAD_BY_FILE");
      form.set(
        isVideo ? "video_file" : "image_file",
        new Blob([arrayBuffer], { type: item.asset.mimeType }),
        item.asset.name,
      );
      const uploadResult = assertTikTok(
        await requestJson(
          `https://business-api.tiktok.com/open_api/v1.3/file/${isVideo ? "video" : "image"}/ad/upload/`,
          { method: "POST", headers: { "Access-Token": token }, body: form },
        ),
      );
      const uploadData = uploadResult.data as Record<string, unknown>;
      const mediaId = String(
        uploadData[isVideo ? "video_id" : "image_id"] ?? "",
      );
      if (!mediaId)
        throw new AppError(
          "TikTok media upload returned no ID",
          "PLATFORM_ERROR",
          502,
          uploadResult,
        );
      const adResult = assertTikTok(
        await requestJson(
          "https://business-api.tiktok.com/open_api/v1.3/ad/create/",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              advertiser_id: accountId,
              adgroup_id: adGroupId,
              creatives: [
                {
                  ad_name: `${campaign.name} ad ${item.position + 1}`,
                  identity_type: "TT_USER",
                  identity_id: identityId,
                  ad_format: isVideo ? "SINGLE_VIDEO" : "SINGLE_IMAGE",
                  ...(isVideo
                    ? { video_id: mediaId }
                    : { image_ids: [mediaId] }),
                  ad_text: copy.primaryText.slice(0, 100),
                  landing_page_url: copy.destinationUrl,
                  call_to_action: copy.cta,
                },
              ],
              operation_status: "DISABLE",
            }),
          },
        ),
      );
      const adIds = (adResult.data as { ad_ids?: string[] })?.ad_ids ?? [];
      if (!adIds[0])
        throw new AppError(
          "TikTok did not return an ad ID",
          "PLATFORM_ERROR",
          502,
          adResult,
        );
      creativeMappings.push({ localId: item.id, externalId: String(adIds[0]) });
      adResponses.push(adResult);
    }
    return {
      externalId: campaignId,
      status: "PAUSED" as const,
      raw: { campaign: result, adGroup: adGroupResult, ads: adResponses },
      creatives: creativeMappings,
    };
  }
  async metrics(campaign: Campaign, token: string, accountId: string) {
    const params = new URLSearchParams({
      advertiser_id: accountId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id"]),
      metrics: JSON.stringify(["spend", "impressions", "clicks", "conversion"]),
      filtering: JSON.stringify([
        {
          field_name: "campaign_ids",
          filter_type: "IN",
          filter_value: JSON.stringify([campaign.externalId]),
        },
      ]),
    });
    const result = assertTikTok(
      await requestJson(
        `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${params}`,
        { headers: { "Access-Token": token } },
      ),
    );
    const row =
      (
        (result.data as Record<string, unknown>)?.list as
          Array<{ metrics: Record<string, string> }> | undefined
      )?.[0]?.metrics ?? {};
    const creativeParams = new URLSearchParams({
      advertiser_id: accountId,
      report_type: "BASIC",
      data_level: "AUCTION_AD",
      dimensions: JSON.stringify(["ad_id"]),
      metrics: JSON.stringify([
        "spend",
        "impressions",
        "clicks",
        "conversion",
        "total_purchase_value",
      ]),
      filtering: JSON.stringify([
        {
          field_name: "campaign_ids",
          filter_type: "IN",
          filter_value: JSON.stringify([campaign.externalId]),
        },
      ]),
      page_size: "1000",
    });
    const creativeResult = assertTikTok(
      await requestJson(
        `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?${creativeParams}`,
        { headers: { "Access-Token": token } },
      ),
    );
    const creativeRows =
      (
        creativeResult.data as {
          list?: Array<{
            dimensions: Record<string, string>;
            metrics: Record<string, string>;
          }>;
        }
      )?.list ?? [];
    return {
      impressions: BigInt(row.impressions ?? 0),
      clicks: BigInt(row.clicks ?? 0),
      conversions: Number(row.conversion ?? 0),
      spend: Number(row.spend ?? 0),
      revenue: 0,
      raw: { campaign: result, creatives: creativeResult },
      creatives: creativeRows.map((item) => ({
        externalId: item.dimensions.ad_id,
        impressions: BigInt(item.metrics.impressions ?? 0),
        clicks: BigInt(item.metrics.clicks ?? 0),
        conversions: Number(item.metrics.conversion ?? 0),
        spend: Number(item.metrics.spend ?? 0),
        revenue: Number(item.metrics.total_purchase_value ?? 0),
        raw: item,
      })),
    };
  }
}

class LinkedInAdapter implements AdPlatformAdapter {
  private headers(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202607",
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }
  async setStatus(
    campaign: Campaign,
    token: string,
    _accountId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    await requestJson(
      `https://api.linkedin.com/rest/adAccounts/${_accountId}/adCampaigns/${campaign.externalId}`,
      {
        method: "POST",
        headers: {
          ...this.headers(token),
          "X-RestLi-Method": "PARTIAL_UPDATE",
        },
        body: JSON.stringify({ patch: { $set: { status } } }),
      },
    );
  }
  async publish(campaign: Publishable, token: string, accountId: string) {
    const copy = campaignCopy(campaign);
    const objective =
      (
        {
          SALES: "WEBSITE_CONVERSION",
          LEADS: "LEAD_GENERATION",
          TRAFFIC: "WEBSITE_VISIT",
          AWARENESS: "BRAND_AWARENESS",
          APP_PROMOTION: "WEBSITE_VISIT",
        } as Record<string, string>
      )[campaign.objective] ?? "WEBSITE_VISIT";
    const audience = campaign.audience as { locations?: string[] };
    const locationUrns: string[] = [];
    for (const location of audience.locations ?? []) {
      if (location.startsWith("urn:li:geo:")) {
        locationUrns.push(location);
        continue;
      }
      const query = new URLSearchParams({
        q: "typeahead",
        queryVersion: "QUERY_USES_URNS",
        facet: "urn:li:adTargetingFacet:locations",
        query: location,
      });
      const found = await requestJson(
        `https://api.linkedin.com/rest/adTargetingEntities?${query}`,
        { headers: this.headers(token) },
      );
      const urn = (found.elements as Array<{ urn?: string }> | undefined)?.[0]
        ?.urn;
      if (urn) locationUrns.push(urn);
    }
    if (!locationUrns.length)
      throw new AppError(
        "LinkedIn could not resolve the campaign locations",
        "INVALID_AUDIENCE",
        422,
      );
    const response = await requestJsonResponse(
      `https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns`,
      {
        method: "POST",
        headers: this.headers(token),
        body: JSON.stringify({
          account: `urn:li:sponsoredAccount:${accountId}`,
          name: `${campaign.name} [AdForge ${campaign.id}]`,
          objectiveType: objective,
          status: "DRAFT",
          dailyBudget: {
            amount: String(campaign.dailyBudget),
            currencyCode: campaign.currency,
          },
          locale: { country: "US", language: "en" },
          audienceExpansionEnabled: false,
          offsiteDeliveryEnabled: false,
          creativeSelection: "OPTIMIZED",
          costType: "CPC",
          unitCost: { amount: "2", currencyCode: campaign.currency },
          targetingCriteria: {
            include: {
              and: [
                {
                  or: {
                    "urn:li:adTargetingFacet:locations": locationUrns,
                  },
                },
              ],
            },
          },
          type: "TEXT_AD",
        }),
      },
    );
    const externalId = response.headers.get("x-restli-id");
    if (!externalId)
      throw new AppError(
        "LinkedIn did not return the created campaign ID",
        "PLATFORM_ERROR",
        502,
        response.body,
      );
    const creative = await requestJsonResponse(
      `https://api.linkedin.com/rest/adAccounts/${accountId}/creatives`,
      {
        method: "POST",
        headers: this.headers(token),
        body: JSON.stringify({
          campaign: `urn:li:sponsoredCampaign:${externalId}`,
          status: "PAUSED",
          type: "TEXT_AD",
          variables: {
            clickUri: copy.destinationUrl,
            data: {
              "com.linkedin.ads.TextAdCreativeVariables": {
                text: copy.primaryText.slice(0, 75),
                title: copy.headline.slice(0, 25),
              },
            },
          },
        }),
      },
    );
    const creativeId = creative.headers.get("x-restli-id");
    return {
      externalId,
      status: "PAUSED" as const,
      raw: {
        campaign: response.body,
        campaignId: externalId,
        creative: creative.body,
        creativeId,
      },
      creatives:
        campaign.creatives[0] && creativeId
          ? [{ localId: campaign.creatives[0].id, externalId: creativeId }]
          : [],
    };
  }
  async metrics(campaign: Campaign, token: string) {
    const query = new URLSearchParams({
      q: "analytics",
      pivot: "CAMPAIGN",
      timeGranularity: "DAILY",
      campaigns: `List(urn:li:sponsoredCampaign:${campaign.externalId})`,
      fields:
        "impressions,clicks,costInLocalCurrency,externalWebsiteConversions",
    });
    const result = await requestJson(
      `https://api.linkedin.com/rest/adAnalytics?${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202607",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );
    const row =
      (result.elements as Array<Record<string, string>> | undefined)?.[0] ?? {};
    const creativeIds = ((campaign as MetricCampaign).creatives ?? [])
      .map((creative) => creative.externalId)
      .filter((value): value is string => Boolean(value));
    let creativeResult: Record<string, unknown> = { elements: [] };
    if (creativeIds.length) {
      const creativeQuery = new URLSearchParams({
        q: "analytics",
        pivot: "CREATIVE",
        timeGranularity: "DAILY",
        creatives: `List(${creativeIds
          .map((id) => `urn:li:sponsoredCreative:${id}`)
          .join(",")})`,
        fields:
          "pivotValues,impressions,clicks,costInLocalCurrency,externalWebsiteConversions",
      });
      creativeResult = await requestJson(
        `https://api.linkedin.com/rest/adAnalytics?${creativeQuery}`,
        { headers: this.headers(token) },
      );
    }
    const creativeRows =
      (creativeResult.elements as
        Array<Record<string, string | string[]>> | undefined) ?? [];
    return {
      impressions: BigInt(row.impressions ?? 0),
      clicks: BigInt(row.clicks ?? 0),
      conversions: Number(row.externalWebsiteConversions ?? 0),
      spend: Number(row.costInLocalCurrency ?? 0),
      revenue: 0,
      raw: { campaign: result, creatives: creativeResult },
      creatives: creativeRows.map((item) => ({
        externalId: String(item.pivotValues?.[0] ?? "")
          .split(":")
          .at(-1)!,
        impressions: BigInt(String(item.impressions ?? 0)),
        clicks: BigInt(String(item.clicks ?? 0)),
        conversions: Number(item.externalWebsiteConversions ?? 0),
        spend: Number(item.costInLocalCurrency ?? 0),
        revenue: 0,
        raw: item,
      })),
    };
  }
}

class GoogleAdapter implements AdPlatformAdapter {
  async setStatus(
    campaign: Campaign,
    token: string,
    accountId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    const customerId = accountId.replaceAll("-", "");
    await requestJson(
      `https://googleads.googleapis.com/v25/customers/${customerId}/campaigns:mutate`,
      {
        method: "POST",
        headers: this.headers(token),
        body: JSON.stringify({
          operations: [
            {
              update: {
                resourceName: `customers/${customerId}/campaigns/${campaign.externalId}`,
                status: status === "ACTIVE" ? "ENABLED" : "PAUSED",
              },
              updateMask: "status",
            },
          ],
        }),
      },
    );
  }
  private headers(token: string) {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken)
      throw new AppError(
        "Google Ads developer token is not configured",
        "PLATFORM_NOT_CONFIGURED",
        503,
      );
    return {
      Authorization: `Bearer ${token}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };
  }
  async publish(campaign: Publishable, token: string, accountId: string) {
    const customerId = accountId.replaceAll("-", "");
    const base = `https://googleads.googleapis.com/v25/customers/${customerId}`;
    const copy = campaignCopy(campaign);
    const keyword = copy.headline
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const headlines = distinctText(
      [
        copy.headline,
        `${copy.cta.replaceAll("_", " ")} ${copy.headline}`,
        `Discover ${copy.headline}`,
        campaign.name,
      ],
      30,
    );
    while (headlines.length < 3)
      headlines.push(
        `Explore the difference ${headlines.length + 1}`.slice(0, 30),
      );
    const descriptions = distinctText(
      [
        copy.primaryText,
        copy.description ?? "",
        `${copy.primaryText} ${copy.cta.replaceAll("_", " ")}`,
      ],
      90,
    );
    while (descriptions.length < 2)
      descriptions.push(
        "Learn more and choose the option that fits your needs.".slice(0, 90),
      );
    const budgetName = `customers/${customerId}/campaignBudgets/-1`;
    const campaignName = `customers/${customerId}/campaigns/-2`;
    const adGroupName = `customers/${customerId}/adGroups/-3`;
    const result = await requestJson(`${base}/googleAds:mutate`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({
        partialFailure: false,
        responseContentType: "RESOURCE_NAME_ONLY",
        mutateOperations: [
          {
            campaignBudgetOperation: {
              create: {
                resourceName: budgetName,
                name: `${campaign.name} budget ${campaign.id}`,
                amountMicros: String(
                  Math.round(Number(campaign.dailyBudget) * 1_000_000),
                ),
                deliveryMethod: "STANDARD",
                explicitlyShared: false,
              },
            },
          },
          {
            campaignOperation: {
              create: {
                resourceName: campaignName,
                name: `${campaign.name} [AdForge ${campaign.id}]`,
                status: "PAUSED",
                advertisingChannelType: "SEARCH",
                campaignBudget: budgetName,
                manualCpc: { enhancedCpcEnabled: false },
                networkSettings: {
                  targetGoogleSearch: true,
                  targetSearchNetwork: true,
                  targetContentNetwork: false,
                  targetPartnerSearchNetwork: false,
                },
                containsEuPoliticalAdvertising:
                  "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
              },
            },
          },
          {
            adGroupOperation: {
              create: {
                resourceName: adGroupName,
                name: `${campaign.name} ad group`,
                campaign: campaignName,
                status: "PAUSED",
                type: "SEARCH_STANDARD",
                cpcBidMicros: "1000000",
              },
            },
          },
          {
            adGroupCriterionOperation: {
              create: {
                adGroup: adGroupName,
                status: "ENABLED",
                keyword: { text: keyword, matchType: "BROAD" },
              },
            },
          },
          {
            adGroupAdOperation: {
              create: {
                adGroup: adGroupName,
                status: "PAUSED",
                ad: {
                  finalUrls: [copy.destinationUrl],
                  responsiveSearchAd: {
                    headlines: headlines.map((text) => ({ text })),
                    descriptions: descriptions.map((text) => ({ text })),
                  },
                },
              },
            },
          },
        ],
      }),
    });
    const responses = result.mutateOperationResponses as
      | Array<{
          campaignResult?: { resourceName?: string };
          adGroupAdResult?: { resourceName?: string };
        }>
      | undefined;
    const resourceName = responses?.[1]?.campaignResult?.resourceName;
    if (!resourceName)
      throw new AppError(
        "Google Ads did not return the created campaign",
        "PLATFORM_ERROR",
        502,
        result,
      );
    const adResourceName = responses?.[4]?.adGroupAdResult?.resourceName;
    return {
      externalId: resourceName.split("/").at(-1)!,
      status: "PAUSED" as const,
      raw: result,
      creatives:
        campaign.creatives[0] && adResourceName
          ? [
              {
                localId: campaign.creatives[0].id,
                externalId: adResourceName
                  .split("~")
                  .at(-1)!
                  .split("/")
                  .at(-1)!,
              },
            ]
          : [],
    };
  }
  async metrics(campaign: Campaign, token: string, accountId: string) {
    const customerId = accountId.replaceAll("-", "");
    const query = `SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros, metrics.conversions_value FROM campaign WHERE campaign.id = ${campaign.externalId} AND segments.date DURING TODAY`;
    const result = await requestJson(
      `https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: this.headers(token),
        body: JSON.stringify({ query }),
      },
    );
    const metrics =
      (
        result.results as Array<{ metrics: Record<string, string> }> | undefined
      )?.[0]?.metrics ?? {};
    const creativeQuery = `SELECT ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros, metrics.conversions_value FROM ad_group_ad WHERE campaign.id = ${campaign.externalId} AND segments.date DURING TODAY`;
    const creativeResult = await requestJson(
      `https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: this.headers(token),
        body: JSON.stringify({ query: creativeQuery }),
      },
    );
    const creativeRows =
      (creativeResult.results as
        | Array<{
            adGroupAd?: { ad?: { id?: string } };
            metrics?: Record<string, string>;
          }>
        | undefined) ?? [];
    return {
      impressions: BigInt(metrics.impressions ?? 0),
      clicks: BigInt(metrics.clicks ?? 0),
      conversions: Number(metrics.conversions ?? 0),
      spend: Number(metrics.costMicros ?? 0) / 1_000_000,
      revenue: Number(metrics.conversionsValue ?? 0),
      raw: { campaign: result, creatives: creativeResult },
      creatives: creativeRows
        .filter((item) => item.adGroupAd?.ad?.id)
        .map((item) => ({
          externalId: String(item.adGroupAd!.ad!.id),
          impressions: BigInt(item.metrics?.impressions ?? 0),
          clicks: BigInt(item.metrics?.clicks ?? 0),
          conversions: Number(item.metrics?.conversions ?? 0),
          spend: Number(item.metrics?.costMicros ?? 0) / 1_000_000,
          revenue: Number(item.metrics?.conversionsValue ?? 0),
          raw: item,
        })),
    };
  }
}

class PinterestAdapter implements AdPlatformAdapter {
  async setStatus(
    campaign: Campaign,
    token: string,
    accountId: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    await requestJson(
      `https://api.pinterest.com/v5/ad_accounts/${accountId}/campaigns`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ id: campaign.externalId, status }]),
      },
    );
  }
  async publish(campaign: Publishable, token: string, accountId: string) {
    const metadata = campaign.adConnection.metadata as Record<string, unknown>;
    const boardId =
      typeof metadata.boardId === "string" ? metadata.boardId : undefined;
    if (!boardId)
      throw new AppError(
        "Configure a Pinterest board before publishing",
        "PINTEREST_BOARD_REQUIRED",
        422,
      );
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const objective =
      (
        {
          SALES: "SALES",
          LEADS: "LEADS",
          TRAFFIC: "CONSIDERATION",
          AWARENESS: "AWARENESS",
          APP_PROMOTION: "CONSIDERATION",
        } as Record<string, string>
      )[campaign.objective] ?? "CONSIDERATION";
    const result = await requestJson(
      `https://api.pinterest.com/v5/ad_accounts/${accountId}/campaigns`,
      {
        method: "POST",
        headers,
        body: JSON.stringify([
          {
            name: campaign.name,
            status: "PAUSED",
            objective_type: objective,
            intended_promotion_type: "STANDARD_AD",
            daily_spend_cap: Math.round(Number(campaign.dailyBudget) * 1000000),
          },
        ]),
      },
    );
    const item =
      (result.items as Array<Record<string, unknown>> | undefined)?.[0] ??
      result;
    if (!item.id)
      throw new AppError(
        "Pinterest did not create a campaign",
        "PLATFORM_ERROR",
        502,
        result,
      );
    const campaignId = String(item.id);
    const audience = campaign.audience as { locations?: string[] };
    const adGroupResult = await requestJson(
      `https://api.pinterest.com/v5/ad_accounts/${accountId}/ad_groups`,
      {
        method: "POST",
        headers,
        body: JSON.stringify([
          {
            campaign_id: campaignId,
            name: `${campaign.name} audience`,
            status: "PAUSED",
            budget_type: "DAILY",
            budget_in_micro_currency: Math.round(
              Number(campaign.dailyBudget) * 1_000_000,
            ),
            bid_strategy_type: "AUTOMATIC_BID",
            billable_event:
              campaign.objective === "AWARENESS"
                ? "IMPRESSION"
                : "CLICKTHROUGH",
            targeting_spec: { GEO: audience.locations ?? [] },
          },
        ]),
      },
    );
    const adGroup =
      (
        adGroupResult.items as Array<Record<string, unknown>> | undefined
      )?.[0] ?? adGroupResult;
    const adGroupId = String(adGroup.id ?? "");
    if (!adGroupId)
      throw new AppError(
        "Pinterest did not create an ad group",
        "PLATFORM_ERROR",
        502,
        adGroupResult,
      );
    const copy = campaignCopy(campaign);
    const mappings: Array<{ localId: string; externalId: string }> = [];
    const providerResponses: unknown[] = [];
    for (const creative of campaign.creatives) {
      let mediaSource: Record<string, unknown>;
      if (creative.asset.type === "VIDEO") {
        const registration = await requestJson(
          "https://api.pinterest.com/v5/media",
          {
            method: "POST",
            headers,
            body: JSON.stringify({ media_type: "video" }),
          },
        );
        const mediaId = String(registration.media_id ?? "");
        const uploadUrl = String(registration.upload_url ?? "");
        const parameters = registration.upload_parameters as
          Record<string, string> | undefined;
        if (!mediaId || !uploadUrl || !parameters)
          throw new AppError(
            "Pinterest did not initialize the video upload",
            "PLATFORM_ERROR",
            502,
            registration,
          );
        const form = new FormData();
        for (const [key, value] of Object.entries(parameters))
          form.set(key, value);
        const bytes = await getObjectBytes(creative.asset.storageKey);
        const part = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;
        form.set(
          "file",
          new Blob([part], { type: creative.asset.mimeType }),
          creative.asset.name,
        );
        const upload = await fetch(uploadUrl, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(120_000),
        });
        if (!upload.ok)
          throw new AppError(
            "Pinterest video storage rejected the upload",
            "PLATFORM_ERROR",
            502,
          );
        let ready = false;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const status = await requestJson(
            `https://api.pinterest.com/v5/media/${mediaId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (status.status === "succeeded") {
            ready = true;
            break;
          }
          if (status.status === "failed")
            throw new AppError(
              "Pinterest could not process the video",
              "PLATFORM_ERROR",
              502,
              status,
            );
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
        if (!ready)
          throw new AppError(
            "Pinterest video processing timed out",
            "PLATFORM_TIMEOUT",
            504,
          );
        mediaSource = { source_type: "video_id", media_id: mediaId };
      } else {
        mediaSource = {
          source_type: "image_url",
          url: await createDownloadUrl(creative.asset.storageKey),
        };
      }
      const pin = await requestJson("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers,
        body: JSON.stringify({
          board_id: boardId,
          title: copy.headline.slice(0, 100),
          description: copy.primaryText.slice(0, 500),
          link: copy.destinationUrl,
          media_source: mediaSource,
        }),
      });
      const pinId = String(pin.id ?? "");
      if (!pinId)
        throw new AppError(
          "Pinterest did not create a Pin",
          "PLATFORM_ERROR",
          502,
          pin,
        );
      const adResult = await requestJson(
        `https://api.pinterest.com/v5/ad_accounts/${accountId}/ads`,
        {
          method: "POST",
          headers,
          body: JSON.stringify([
            {
              ad_group_id: adGroupId,
              pin_id: pinId,
              name: `${campaign.name} ad ${creative.position + 1}`,
              status: "PAUSED",
            },
          ]),
        },
      );
      const ad =
        (adResult.items as Array<Record<string, unknown>> | undefined)?.[0] ??
        adResult;
      const adId = String(ad.id ?? "");
      if (!adId)
        throw new AppError(
          "Pinterest did not return an ad ID",
          "PLATFORM_ERROR",
          502,
          adResult,
        );
      mappings.push({ localId: creative.id, externalId: adId });
      providerResponses.push({ pin, ad: adResult });
    }
    return {
      externalId: campaignId,
      status: "PAUSED" as const,
      raw: { campaign: result, adGroup: adGroupResult, ads: providerResponses },
      creatives: mappings,
    };
  }
  async metrics(campaign: Campaign, token: string, accountId: string) {
    const query = new URLSearchParams({
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      granularity: "TOTAL",
      columns:
        "SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,TOTAL_CONVERSIONS,TOTAL_CONVERSION_VALUE_IN_MICRO_DOLLAR",
      campaign_ids: campaign.externalId!,
    });
    const result = await requestJson(
      `https://api.pinterest.com/v5/ad_accounts/${accountId}/analytics?${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const row =
      (result.items as Array<Record<string, number>> | undefined)?.[0] ??
      (result as Record<string, number>);
    const creativeIds = ((campaign as MetricCampaign).creatives ?? [])
      .map((creative) => creative.externalId)
      .filter((value): value is string => Boolean(value));
    let creativeResult: Record<string, unknown> = { items: [] };
    if (creativeIds.length) {
      const creativeQuery = new URLSearchParams({
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        granularity: "TOTAL",
        columns:
          "AD_ID,SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,TOTAL_CONVERSIONS,TOTAL_CONVERSION_VALUE_IN_MICRO_DOLLAR",
        ad_ids: creativeIds.join(","),
      });
      creativeResult = await requestJson(
        `https://api.pinterest.com/v5/ad_accounts/${accountId}/analytics?${creativeQuery}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
    const creativeRows =
      (creativeResult.items as
        Array<Record<string, number | string>> | undefined) ?? [];
    return {
      impressions: BigInt(row.IMPRESSION_1 ?? 0),
      clicks: BigInt(row.CLICKTHROUGH_1 ?? 0),
      conversions: Number(row.TOTAL_CONVERSIONS ?? 0),
      spend: Number(row.SPEND_IN_DOLLAR ?? 0),
      revenue:
        Number(row.TOTAL_CONVERSION_VALUE_IN_MICRO_DOLLAR ?? 0) / 1_000_000,
      raw: { campaign: result, creatives: creativeResult },
      creatives: creativeRows.map((creative) => ({
        externalId: String(creative.AD_ID),
        impressions: BigInt(creative.IMPRESSION_1 ?? 0),
        clicks: BigInt(creative.CLICKTHROUGH_1 ?? 0),
        conversions: Number(creative.TOTAL_CONVERSIONS ?? 0),
        spend: Number(creative.SPEND_IN_DOLLAR ?? 0),
        revenue:
          Number(creative.TOTAL_CONVERSION_VALUE_IN_MICRO_DOLLAR ?? 0) /
          1_000_000,
        raw: creative,
      })),
    };
  }
}

export function platformAdapter(
  platform: Campaign["platform"],
): AdPlatformAdapter {
  if (platform === "META") return new MetaAdapter();
  if (platform === "TIKTOK") return new TikTokAdapter();
  if (platform === "LINKEDIN") return new LinkedInAdapter();
  if (platform === "GOOGLE") return new GoogleAdapter();
  return new PinterestAdapter();
}
