import { createHash } from "node:crypto";
import { db } from "@/lib/db";

type Rules = {
  allowOrganizations?: string[];
  denyOrganizations?: string[];
  rolloutPercentage?: number;
};

export async function isFeatureEnabled(
  key: string,
  organizationId: string,
  defaultValue = true,
) {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) return defaultValue;
  if (!flag.enabled) return false;
  const rules = flag.rules as Rules;
  if (rules.denyOrganizations?.includes(organizationId)) return false;
  if (rules.allowOrganizations?.includes(organizationId)) return true;
  const percentage = Math.max(
    0,
    Math.min(100, Number(rules.rolloutPercentage ?? 100)),
  );
  const bucket = Number.parseInt(
    createHash("sha256")
      .update(`${key}:${organizationId}`)
      .digest("hex")
      .slice(0, 8),
    16,
  );
  return bucket % 100 < percentage;
}
