import { describe, expect, it } from "vitest";
import { formatCurrency, slugify } from "@/lib/utils";

describe("utilities", () => {
  it("creates stable URL slugs", () =>
    expect(slugify("  Summer Launch — EU! ")).toBe("summer-launch-eu"));
  it("formats ISO currencies", () =>
    expect(formatCurrency(129.5, "USD")).toBe("$129.50"));
});
