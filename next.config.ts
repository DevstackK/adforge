import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["bullmq", "ioredis"],
  allowedDevOrigins: ["creative-greg-works-steve.trycloudflare.com"],
  async headers() {
    const scriptPolicy = [
      "'self'",
      "'unsafe-inline'",
      ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
      "https://challenges.cloudflare.com",
    ].join(" ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; frame-src https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com; frame-ancestors 'none'; upgrade-insecure-requests`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
