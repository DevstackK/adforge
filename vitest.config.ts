import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { environment: "node", include: ["tests/**/*.test.ts"], coverage: { provider: "v8", reporter: ["text", "json", "html"], thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 } } }, resolve: { alias: { "@": path.resolve(__dirname, "src") } } });
