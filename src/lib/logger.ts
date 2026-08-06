import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "*.accessToken",
      "*.refreshToken",
      "*.password",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: process.env.OTEL_SERVICE_NAME ?? "adforge-web",
    environment: process.env.NODE_ENV ?? "development",
  },
});
