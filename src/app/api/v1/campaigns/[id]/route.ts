import { z } from "zod";
import { setCampaignStatus } from "@/features/campaigns/service";
import { ok, parseJson, routeError } from "@/lib/http";
import { requirePrincipal } from "@/server/auth";
import { audit } from "@/server/audit";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";

const schema = z
  .object({
    status: z.enum(["ACTIVE", "PAUSED"]).optional(),
    name: z.string().min(3).max(160).optional(),
    objective: z.string().min(2).max(80).optional(),
    dailyBudget: z.number().positive().max(1_000_000).optional(),
    lifetimeBudget: z
      .number()
      .positive()
      .max(100_000_000)
      .nullable()
      .optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  )
  .refine(
    (value) => !value.status || Object.keys(value).length === 1,
    "Status changes cannot be combined with draft edits",
  );
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const input = await parseJson(request, schema);
    const principal = await requirePrincipal(
      request,
      input.status ? "ADMIN" : "EDITOR",
      "campaigns:write",
    );
    const { id } = await context.params;
    const before = await db.campaign.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!before) throw new NotFoundError("Campaign");
    const campaign = input.status
      ? await setCampaignStatus(id, principal.organizationId, input.status)
      : await (async () => {
          if (before.externalId || !["DRAFT", "FAILED"].includes(before.status))
            throw new AppError(
              "Only unpublished draft or failed campaigns can be edited",
              "INVALID_STATE",
              409,
            );
          return db.campaign.update({ where: { id }, data: input });
        })();
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: input.status ? "campaign.status.update" : "campaign.update",
      entityType: "campaign",
      entityId: id,
      before: {
        name: before.name,
        status: before.status,
        dailyBudget: String(before.dailyBudget),
      },
      after: {
        name: campaign.name,
        status: campaign.status,
        dailyBudget: String(campaign.dailyBudget),
      },
    });
    return ok(campaign);
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const principal = await requirePrincipal(
      request,
      "EDITOR",
      "campaigns:write",
    );
    const { id } = await context.params;
    const campaign = await db.campaign.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!campaign) throw new NotFoundError("Campaign");
    if (campaign.externalId || !["DRAFT", "FAILED"].includes(campaign.status))
      throw new AppError(
        "Published campaigns must be archived in the advertising network instead of deleted",
        "INVALID_STATE",
        409,
      );
    await db.campaign.delete({ where: { id } });
    await audit({
      organizationId: principal.organizationId,
      actorId: principal.user.id,
      action: "campaign.delete",
      entityType: "campaign",
      entityId: id,
      before: { name: campaign.name, platform: campaign.platform },
    });
    return ok({ id, deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
