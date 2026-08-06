# AdForge AI

AdForge AI is a multi-tenant advertising operating system for importing products, generating copy and creative, rendering video, publishing paid campaigns, learning from performance, managing subscriptions and collaborating safely.

## Included

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4 and original shadcn-style primitives
- Clerk authentication and organization provisioning with owner/admin/editor/analyst/viewer RBAC
- PostgreSQL and Prisma 7 schema for all product, creative, campaign, billing, usage and administration domains
- OpenAI Responses, Images, speech and HeyGen talking-avatar integrations with credit reservation/refund semantics
- BullMQ workers for image/video generation, FFmpeg rendering, publication and metric sync
- Meta, Google, TikTok, Pinterest and LinkedIn publishing and metric adapters, including native Meta carousels
- S3-compatible uploads and short-lived downloads
- Stripe Checkout, subscriptions, invoices and monthly credit grants
- Structured errors, Pino JSON logging, security headers, AES-256-GCM token encryption, SSRF defenses and rate limiting
- Unit, PostgreSQL integration, public Playwright, and optional authenticated Clerk Playwright suites
- Multi-stage Docker images, local Compose stack, GitHub CI and Vercel/Railway production deployment
- OpenAPI 3.1 at `docs/openapi.json` and `/api/v1/openapi`

## Quick start

Requirements: Node.js 22.12+, PostgreSQL 17, Redis 7, an S3-compatible bucket, FFmpeg, Chromium, Clerk and OpenAI accounts. HeyGen is required only for talking-avatar rendering.

```bash
cp .env.example .env
openssl rand -base64 32
npm ci
npm run db:generate
npm run db:migrate:dev -- --name initial
npm run db:seed
npm run dev
```

Put the generated base64 value into `ENCRYPTION_KEY`. In another terminal, run `npm run worker`. For an entirely containerized local environment use `docker compose up --build` after configuring `.env`.

## Application map

```text
src/app                 Next.js pages, route handlers and webhooks
src/components          reusable visual primitives and workspace layout
src/features            domain schemas, services, provider adapters and UI
src/lib                 environment, database, logging, crypto and HTTP contracts
src/server              authentication, credits, queues, storage and billing
src/workers             BullMQ consumers and FFmpeg render pipeline
prisma                  schema, migrations and deterministic seed
tests                   unit, integration and browser suites
docs                    architecture, API, deployment and launch controls
```

## Development commands

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Web development server                 |
| `npm run worker`     | Generation and campaign workers        |
| `npm run lint`       | Next.js/TypeScript lint rules          |
| `npm run typecheck`  | Strict TypeScript validation           |
| `npm test`           | Vitest suite                           |
| `npm run test:e2e`   | Playwright browser tests               |
| `npm run build`      | Prisma generation and production build |
| `npm run db:migrate` | Apply checked-in migrations            |
| `npm run db:seed`    | Seed a local demonstration tenant      |

## API conventions

All authenticated endpoints use the selected Clerk organization. Successful JSON is `{ "data": ... }`; errors are `{ "error": { "code", "message", "details", "requestId" } }`. Writes require JSON content type. Client retries must preserve idempotency at the job or provider boundary. See the [API guide](docs/API.md) and [OpenAPI specification](docs/openapi.json).

## Operational model

The web tier is stateless and suitable for Vercel. Long-running generation, FFmpeg and ad-platform calls run on Railway workers. Provider credentials are encrypted before PostgreSQL persistence and decrypted only inside services that use them. Redis is disposable but must use `noeviction` because losing jobs is not acceptable. PostgreSQL and object storage require tested backups.

Read the [completion matrix](docs/COMPLETION_MATRIX.md), [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), [monitoring](docs/MONITORING.md) and [production checklist](docs/PRODUCTION_CHECKLIST.md) before launch. Provider publishing tests exercise official HTTP contracts without spending money; complete a paused-campaign sandbox smoke test with your own reviewed provider applications before production activation.

## Responsible generation

AdForge prompts forbid invented claims, but model output still requires human review. Platform policy, trademark, likeness, regulated-industry and political-advertising checks must be completed before enabling automatic activation. Publisher adapters create campaigns paused by default.

## License

Proprietary. Copyright 2026 AdForge AI.
