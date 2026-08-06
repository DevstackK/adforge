# Architecture

AdForge AI is a modular monolith with independently deployable workers. The web process owns HTTP, Clerk session enforcement and server-rendered React. BullMQ workers own provider calls, media rendering, campaign publication and metric synchronization. PostgreSQL is authoritative; Redis contains only queues and rate-limit windows; S3-compatible storage holds immutable binaries.

Feature folders contain schemas, repository contracts, services, provider adapters and UI. Routes translate HTTP into validated service calls and never query another tenant without an organization predicate. `src/server/container.ts` is the composition root: it injects Prisma repository implementations into product ingestion and campaign creation services, while tests can supply in-memory contract implementations. Transaction-heavy state transitions remain in the service layer so their PostgreSQL transaction is explicit. External advertising systems implement `AdPlatformAdapter`, keeping provider payloads outside campaign orchestration.

Critical flows:

1. Clerk webhooks provision users, organizations and memberships.
2. A generation reserves credits transactionally and enqueues a deterministic job.
3. A worker produces one or more assets, stores immutable binaries, then atomically marks the generation complete. Failures refund credits. Remotion scenes resolve tenant-owned image/video backgrounds to short-lived signed URLs; FFmpeg mixes generated voice and licensed music.
4. Campaign publishing validates local state, queues delivery, decrypts the connection only inside the worker, and stores the external identifier.
5. Scheduled metric jobs upsert hourly campaign and creative snapshots; analytics derives CTR, CPA and ROAS from raw facts and caches evidence-grounded recommendations.

Trust boundaries are Clerk JWTs, webhook signatures, strict Zod schemas, SSRF-safe product imports, organization-scoped queries, AES-256-GCM secrets, signed object URLs, CSP headers and Redis-backed rate limiting.
