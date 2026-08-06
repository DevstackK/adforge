import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { CreditType } from "@/generated/prisma/client";

export async function creditBalance(organizationId: string) {
  const latest = await db.creditTransaction.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return latest?.balanceAfter ?? 0;
}

export async function recordCredits(input: {
  organizationId: string;
  amount: number;
  type: CreditType;
  description: string;
  referenceId?: string;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}))`;
    if (input.referenceId) {
      const existing = await tx.creditTransaction.findFirst({
        where: {
          organizationId: input.organizationId,
          type: input.type,
          referenceId: input.referenceId,
        },
      });
      if (existing) return existing;
    }
    const latest = await tx.creditTransaction.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    });
    const balanceAfter = (latest?.balanceAfter ?? 0) + input.amount;
    if (balanceAfter < 0)
      throw new AppError("Insufficient credits", "INSUFFICIENT_CREDITS", 402, {
        balance: latest?.balanceAfter ?? 0,
        required: Math.abs(input.amount),
      });
    return tx.creditTransaction.create({ data: { ...input, balanceAfter } });
  });
}
