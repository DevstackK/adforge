# API guide

The versioned JSON API is served at `/api/v1`. The machine-readable OpenAPI 3.1 document is available at `/api/v1/openapi` and in `docs/openapi.json`. Success responses use `{ "data": ... }`; failures use `{ "error": { "code", "message", "details", "requestId" } }`.

## Authentication and tenant selection

Browser clients authenticate with a Clerk session and must have an active Clerk organization. Automation can use an AdForge key in `Authorization: Bearer af_live_…` on routes that accept API keys. Keys are shown once, stored only as SHA-256 hashes, constrained by the creating member's current role, and checked for expiration and scopes on every request.

Supported automation scopes are `products:read`, `products:write`, `creative:read`, `creative:write`, `campaigns:read`, `campaigns:write`, and `analytics:read`. Team, billing, connection, support, notification, and administration endpoints require an interactive Clerk session.

Every data query is organization-scoped. Resource IDs from another organization return `404` or an empty result rather than disclosing their existence. JSON writes require `Content-Type: application/json`; browser writes with a foreign `Origin` are rejected.

## Main workflows

1. Create a project with `POST /projects`.
2. Import a public product page with `POST /products/import`, or register a direct-to-S3 upload with `POST /uploads/presign` followed by `POST /assets`.
3. Generate copy synchronously with `POST /copy/generate`. Media requests use `POST /media/generate`, return a queued generation, and can be polled through `GET /generations`.
4. Create a campaign with one or more asset IDs through `POST /campaigns`. `creativeFormat: CAROUSEL` creates a native Meta carousel and requires at least two images.
5. Queue provider publication with `POST /campaigns/publish`. Campaigns are always created paused at the provider. Activate or pause a published campaign using `PATCH /campaigns/{id}`.
6. Read hourly provider-attributed metrics and grounded recommendations through `GET /analytics?days=30`.

Talking-avatar media requires `options.avatarId` and `options.voiceId`; the deployment must configure `HEYGEN_API_KEY`. Carousel generation requires two to ten `options.carouselSlides` and produces separate image assets whose IDs appear in the generation output.

## Pagination, rate limits, and retries

Campaign listing uses cursor pagination and returns `{ items, nextCursor }`. Product imports and AI endpoints use Redis-backed fixed-window limits. A `429` error includes retry information under `error.details`; clients should use bounded exponential backoff with jitter. Do not retry validation, authorization, insufficient-credit, or invalid-state failures.

Media and publishing requests create durable BullMQ jobs. Generation jobs are idempotent by generation ID and refund credits after their final failed attempt. Provider publication intentionally uses one attempt because most advertising networks do not provide a cross-resource idempotency key; a failed campaign must be reviewed and explicitly retried.

## Advertising connections

Start OAuth at `GET /connections/{platform}/start`, where platform is `meta`, `google`, `tiktok`, `pinterest`, or `linkedin`. The signed callback state is bound to the initiating user and organization. Access and refresh tokens are encrypted with AES-256-GCM before storage.

Some providers require account-specific configuration after OAuth:

| Platform  | Required before applicable publishing                                 |
| --------- | --------------------------------------------------------------------- |
| Meta      | `pageId`; `pixelId` for sales; `appId` for app promotion              |
| TikTok    | `identityId`; optional pixel or app fields from the connected account |
| Pinterest | `boardId`                                                             |
| Google    | `GOOGLE_ADS_DEVELOPER_TOKEN` in the deployment                        |
| LinkedIn  | No additional local field for standard text ads                       |

Set these values through `PATCH /connections`. Provider secrets and access tokens are never returned by the API.

## Errors

Common status codes are `401` for missing or expired authentication, `402` for insufficient credits, `403` for role/scope/CSRF rejection, `404` for inaccessible resources, `409` for invalid state transitions, `413` for oversized imports, `422` for validation, `429` for rate limits, `502` for provider rejection, and `503` for unconfigured or unavailable dependencies. Supply the returned `requestId` when contacting support.

## Webhooks

Clerk delivers provisioning events to `/api/webhooks/clerk`; Stripe delivers subscription and invoice events to `/api/webhooks/stripe`. These endpoints sit outside `/api/v1`, require their provider signatures, and must receive the raw request body. Configure retries in both provider dashboards. Event handling is idempotent through database upserts and provider event identifiers.
