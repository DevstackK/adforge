# Monitoring and logging

The web process registers OpenTelemetry through `src/instrumentation.ts`; SDKs send traces and runtime metrics to `OTEL_EXPORTER_OTLP_ENDPOINT`. Workers emit structured Pino JSON with job IDs, queue names and redaction rules. Route errors include a request ID that support can correlate with logs.

Deploy the collector using `observability/otel-collector.yaml`, set its upstream endpoint and token, and keep it on a private network. The collector removes authorization headers and hashes user identifiers before export. Web and worker processes identify themselves as `adforge-web` and `adforge-worker`. Platform administrators can inspect database latency, Redis queue state, 24-hour generation/campaign failures and unhealthy advertising connections at `/api/v1/admin/monitoring`.

Required alerts:

- Web 5xx above 2% for five minutes or p95 latency above 1.5 seconds.
- Oldest BullMQ waiting job above five minutes; any stalled job; failure ratio above 5%.
- PostgreSQL connections above 80%, replication lag, storage growth or backup failure.
- Redis memory above 75%, rejected connections, evictions or persistence failure.
- Stripe/Clerk webhook oldest unprocessed event above five minutes.
- Provider 401/403 burst, token refresh failure, abnormal publishing volume or spend-cap breach.
- Credit ledger balance below zero (must be impossible) or refund anomalies.

Use `/api/v1/health` for readiness. Liveness should only check process response; readiness checks PostgreSQL. Do not make Redis/provider availability part of liveness or orchestration will amplify outages with restarts. Retain audit logs according to policy, but route high-volume traces to the telemetry backend rather than PostgreSQL.
