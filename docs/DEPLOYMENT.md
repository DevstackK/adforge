# Deployment guide

## Vercel web

Create managed PostgreSQL, Redis and S3-compatible services first. Import `.env.production.example` into Vercel and replace every value. The checked-in `vercel.json` selects Next.js and pins the install/build commands. The GitHub production environment must define `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `PRODUCTION_DATABASE_URL`.

Configure Clerk webhook delivery to `/api/webhooks/clerk` and Stripe to `/api/webhooks/stripe`. Subscribe Stripe to `customer.subscription.*`, `invoice.paid`, and `invoice.payment_failed`. Set `APP_URL` to the canonical HTTPS origin; OAuth callbacks are derived from it and signed to the initiating user and organization. Never deploy without the matching signing secrets.

Register `/api/v1/connections/{platform}/callback` for Meta, Google, TikTok, Pinterest and LinkedIn, using the lowercase platform name. Supply every provider client ID and secret, `GOOGLE_ADS_DEVELOPER_TOKEN`, and a 32-byte base64 `ENCRYPTION_KEY`. Configure `HEYGEN_API_KEY` if talking avatars are enabled. Restrict the S3 CORS policy to `APP_URL` and permit only the upload content types listed in the presign endpoint.

## Railway worker

Create a Railway service from the same repository. The checked-in `railway.json` selects the Dockerfile; its final `worker` stage starts the BullMQ process and applies migrations in the pre-deploy phase. Give it the same database, Redis, S3, AI, advertising-provider and encryption variables as web. The worker schedules provider metric synchronization every 15 minutes internally, so run exactly one scheduler-capable worker replica until that scheduler is moved to a dedicated repeatable BullMQ job. Generation and campaign consumers can then be scaled independently. Grant each rendering container at least 2 vCPU, 4 GB RAM and enough ephemeral disk for concurrent FFmpeg outputs.

## Migration sequence

CI runs `prisma migrate deploy` before application deployment. Migrations must be backward compatible for one release: add nullable columns first, deploy readers/writers, backfill, then tighten constraints in a later release. Back up PostgreSQL and verify recovery before every destructive migration. If web deployment fails after migration, roll web and worker code back to the preceding image; never roll the database backward until restore and compatibility have been reviewed.

## Local Docker

Copy `.env.example` to `.env`, configure Clerk/OpenAI/Stripe credentials, generate `ENCRYPTION_KEY` with `openssl rand -base64 32`, then run `docker compose up --build`. To select another env file, set `ADFORGE_ENV_FILE` to its path. MinIO console is exposed on port 9001; the web app is on port 3000. Run `npm run db:seed` only in a local environment—the seed identity is deliberately not a deployable Clerk user.

## Verification after deployment

Confirm `/api/v1/health`, sign-in, organization selection, a presigned upload, credit debit/refund, one image render, one MP4 render, Stripe test checkout, and each connected provider with a minimal paused campaign. Verify the provider dashboard IDs match the stored campaign and creative IDs. Run the authenticated Playwright project by supplying `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `E2E_CLERK_USER_EMAIL`, and `E2E_CLERK_ORGANIZATION_ID` for a prepared non-production tenant.
