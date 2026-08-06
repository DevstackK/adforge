import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, sha256 } from "@/lib/crypto";
import { parseJson } from "@/lib/http";
import { z } from "zod";

describe("security boundaries", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  it("encrypts secrets with authenticated non-deterministic ciphertext", () => {
    const first = encryptSecret("provider-token");
    const second = encryptSecret("provider-token");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("provider-token");
  });
  it("hashes API keys without retaining plaintext", () =>
    expect(sha256("af_live_secret")).toMatch(/^[a-f0-9]{64}$/));
  it("rejects cross-origin JSON writes", async () => {
    const request = new Request("https://app.adforge.test/api/v1/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.test",
      },
      body: JSON.stringify({ name: "Campaign" }),
    });
    await expect(
      parseJson(request, z.object({ name: z.string() })),
    ).rejects.toMatchObject({ code: "CSRF_REJECTED", status: 403 });
  });
});
