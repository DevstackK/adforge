import { SignJWT, jwtVerify } from "jose";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type {
  AdConnection,
  CampaignPlatform,
  Prisma,
} from "@/generated/prisma/client";

type OAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  authorize: string;
  token: string;
  scopes: string[];
};
const configs: Record<CampaignPlatform, OAuthConfig> = {
  META: {
    clientId: process.env.META_APP_ID,
    clientSecret: process.env.META_APP_SECRET,
    authorize: "https://www.facebook.com/v23.0/dialog/oauth",
    token: "https://graph.facebook.com/v23.0/oauth/access_token",
    scopes: [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
    ],
  },
  GOOGLE: {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/adwords"],
  },
  TIKTOK: {
    clientId: process.env.TIKTOK_APP_ID,
    clientSecret: process.env.TIKTOK_APP_SECRET,
    authorize: "https://business-api.tiktok.com/portal/auth",
    token: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    scopes: ["advertiser_management", "advertiser_report"],
  },
  PINTEREST: {
    clientId: process.env.PINTEREST_APP_ID,
    clientSecret: process.env.PINTEREST_APP_SECRET,
    authorize: "https://www.pinterest.com/oauth/",
    token: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["ads:read", "ads:write"],
  },
  LINKEDIN: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    authorize: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["r_ads", "rw_ads", "r_ads_reporting"],
  },
};

function signingKey() {
  const value = process.env.ENCRYPTION_KEY;
  if (!value)
    throw new AppError(
      "Encryption key is not configured",
      "CONFIGURATION_ERROR",
      500,
    );
  return Buffer.from(value, "base64");
}

function configuration(platform: CampaignPlatform) {
  const config = configs[platform];
  if (!config?.clientId || !config.clientSecret)
    throw new AppError(
      `${platform} OAuth is not configured`,
      "PLATFORM_NOT_CONFIGURED",
      503,
    );
  return config as Required<OAuthConfig>;
}

export async function authorizationUrl(
  platform: CampaignPlatform,
  organizationId: string,
  userId: string,
  origin: string,
) {
  const config = configuration(platform);
  const redirectUri = `${origin}/api/v1/connections/${platform.toLowerCase()}/callback`;
  const state = await new SignJWT({
    organizationId,
    userId,
    platform,
    redirectUri,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setJti(crypto.randomUUID())
    .sign(signingKey());
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(platform === "LINKEDIN" ? " " : ","),
    state,
  });
  if (platform === "GOOGLE") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("scope", config.scopes.join(" "));
  }
  if (platform === "TIKTOK") {
    params.set("app_id", config.clientId);
    params.delete("client_id");
  }
  return `${config.authorize}?${params}`;
}

async function json(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AppError("OAuth provider request failed", "OAUTH_ERROR", 502, {
      status: response.status,
      body,
    });
  return body as Record<string, unknown>;
}

async function accounts(
  platform: CampaignPlatform,
  accessToken: string,
  config: Required<OAuthConfig>,
): Promise<
  Array<{ id: string; name: string; metadata?: Record<string, unknown> }>
> {
  if (platform === "META") {
    const [value, pageResult] = await Promise.all([
      json(
        `https://graph.facebook.com/v23.0/me/adaccounts?fields=id,name,account_id&access_token=${encodeURIComponent(accessToken)}`,
        {},
      ),
      json(
        `https://graph.facebook.com/v23.0/me/accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
        {},
      ),
    ]);
    const pages = (
      (pageResult.data as Array<Record<string, unknown>>) ?? []
    ).map((page) => ({
      id: String(page.id),
      name: String(page.name ?? page.id),
    }));
    return ((value.data as Array<Record<string, unknown>>) ?? []).map((v) => ({
      id: String(v.account_id),
      name: String(v.name),
      metadata: { pages },
    }));
  }
  if (platform === "GOOGLE") {
    const value = await json(
      "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
        },
      },
    );
    return ((value.resourceNames as string[]) ?? []).map((id) => ({
      id: id.split("/").at(-1)!,
      name: `Google Ads ${id.split("/").at(-1)}`,
    }));
  }
  if (platform === "PINTEREST") {
    const value = await json(
      "https://api.pinterest.com/v5/ad_accounts?page_size=100",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return ((value.items as Array<Record<string, unknown>>) ?? []).map((v) => ({
      id: String(v.id),
      name: String(v.name),
    }));
  }
  if (platform === "TIKTOK") {
    const value = await json(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: config.clientId,
          secret: config.clientSecret,
          access_token: accessToken,
        }),
      },
    );
    const list =
      (value.data as { list?: Array<Record<string, unknown>> })?.list ?? [];
    return list.map((v) => ({
      id: String(v.advertiser_id),
      name: String(v.advertiser_name ?? v.advertiser_id),
    }));
  }
  const value = await json(
    "https://api.linkedin.com/rest/adAccounts?q=search&search=(status:(values:List(ACTIVE)))",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": "202607",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
  );
  return ((value.elements as Array<Record<string, unknown>>) ?? []).map(
    (v) => ({ id: String(v.id), name: String(v.name ?? v.id) }),
  );
}

export async function completeOAuth(
  platform: CampaignPlatform,
  code: string,
  state: string,
  expected: { organizationId: string; userId: string },
) {
  const { payload } = await jwtVerify(state, signingKey(), {
    algorithms: ["HS256"],
  });
  if (
    payload.platform !== platform ||
    typeof payload.organizationId !== "string" ||
    typeof payload.redirectUri !== "string" ||
    payload.organizationId !== expected.organizationId ||
    payload.userId !== expected.userId
  )
    throw new AppError("Invalid OAuth state", "INVALID_OAUTH_STATE", 401);
  const config = configuration(platform);
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: payload.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  let headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (platform === "PINTEREST")
    headers = {
      ...headers,
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    };
  const token = await json(config.token, {
    method: "POST",
    headers,
    body: params,
  });
  const tokenData =
    (token.data as Record<string, unknown> | undefined) ?? token;
  const accessToken = String(tokenData.access_token ?? "");
  if (!accessToken)
    throw new AppError(
      "OAuth provider returned no access token",
      "OAUTH_ERROR",
      502,
    );
  const available = await accounts(platform, accessToken, config);
  if (!available.length)
    throw new AppError(
      "No accessible advertising accounts were found",
      "NO_AD_ACCOUNTS",
      422,
    );
  const expiresIn = Number(tokenData.expires_in ?? 0);
  const stored = await Promise.all(
    available.map((account) =>
      db.adConnection.upsert({
        where: {
          organizationId_platform_externalAccountId: {
            organizationId: payload.organizationId as string,
            platform,
            externalAccountId: account.id,
          },
        },
        update: {
          name: account.name,
          status: "CONNECTED",
          encryptedAccessToken: encryptSecret(accessToken),
          encryptedRefreshToken: tokenData.refresh_token
            ? encryptSecret(String(tokenData.refresh_token))
            : undefined,
          tokenExpiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
          metadata: account.metadata as Prisma.InputJsonValue | undefined,
        },
        create: {
          organizationId: payload.organizationId as string,
          platform,
          externalAccountId: account.id,
          name: account.name,
          encryptedAccessToken: encryptSecret(accessToken),
          encryptedRefreshToken: tokenData.refresh_token
            ? encryptSecret(String(tokenData.refresh_token))
            : undefined,
          tokenExpiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
          metadata: (account.metadata ?? {}) as Prisma.InputJsonValue,
        },
      }),
    ),
  );
  return stored;
}

export async function validAccessToken(connection: AdConnection) {
  if (
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt.getTime() > Date.now() + 300_000
  )
    return decryptSecret(connection.encryptedAccessToken);
  if (!connection.encryptedRefreshToken || connection.platform === "META")
    throw new AppError(
      `${connection.platform} authorization expired; reconnect the account`,
      "CONNECTION_EXPIRED",
      401,
    );
  const config = configuration(connection.platform);
  const refreshToken = decryptSecret(connection.encryptedRefreshToken);
  const parameters = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const headers: HeadersInit = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (connection.platform === "PINTEREST")
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  const refreshed = await json(
    connection.platform === "TIKTOK"
      ? "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/"
      : config.token,
    { method: "POST", headers, body: parameters },
  );
  const data =
    (refreshed.data as Record<string, unknown> | undefined) ?? refreshed;
  const accessToken = String(data.access_token ?? "");
  if (!accessToken)
    throw new AppError(
      "Advertising authorization could not be refreshed",
      "CONNECTION_EXPIRED",
      401,
    );
  const expiresIn = Number(data.expires_in ?? 3600);
  await db.adConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptSecret(accessToken),
      encryptedRefreshToken: data.refresh_token
        ? encryptSecret(String(data.refresh_token))
        : connection.encryptedRefreshToken,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      status: "CONNECTED",
    },
  });
  return accessToken;
}
