"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LoaderCircle,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Rocket,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
type Campaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  dailyBudget: string;
  currency: string;
  objective: string;
  externalId?: string;
  _count: { creatives: number };
};
export function CampaignList() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign>();
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<{ items: Campaign[] }>("/api/v1/campaigns"),
  });
  const publish = useMutation({
    mutationFn: (campaignId: string) =>
      api("/api/v1/campaigns/publish", {
        method: "POST",
        body: JSON.stringify({ campaignId }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      api(`/api/v1/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const update = useMutation({
    mutationFn: (campaign: Campaign) =>
      api(`/api/v1/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: campaign.name,
          dailyBudget: Number(campaign.dailyBudget),
        }),
      }),
    onSuccess: () => {
      setEditing(undefined);
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  if (isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  const campaigns = data?.items ?? [];
  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <Card key={c.id}>
          <CardContent className="grid items-center gap-4 pt-5 sm:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black">{c.name}</h3>
                <Badge>{c.platform}</Badge>
              </div>
              <p className="mt-1 text-xs text-[#848892]">
                {c.objective} · {c._count.creatives} creative
                {c._count.creatives === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-sm font-black">
                {new Intl.NumberFormat("en", {
                  style: "currency",
                  currency: c.currency,
                }).format(Number(c.dailyBudget))}
              </p>
              <p className="text-[11px] text-[#8a8e97]">Daily budget</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`size-2 rounded-full ${c.status === "ACTIVE" ? "bg-emerald-500" : c.status === "FAILED" ? "bg-red-500" : "bg-amber-400"}`}
              />
              {c.status}
            </div>
            {!c.externalId && ["DRAFT", "FAILED"].includes(c.status) ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  disabled={publish.isPending}
                  onClick={() => publish.mutate(c.id)}
                >
                  <Rocket size={15} />
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => setEditing({ ...c })}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${c.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete ${c.name}?`))
                      remove.mutate(c.id);
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ) : c.externalId && ["ACTIVE", "PAUSED"].includes(c.status) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={changeStatus.isPending}
                onClick={() =>
                  changeStatus.mutate({
                    id: c.id,
                    status: c.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                  })
                }
              >
                {c.status === "ACTIVE" ? (
                  <Pause size={15} />
                ) : (
                  <Play size={15} />
                )}{" "}
                {c.status === "ACTIVE" ? "Pause" : "Activate"}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled>
                <LoaderCircle
                  size={15}
                  className={c.status === "PUBLISHING" ? "animate-spin" : ""}
                />
                {c.status}
              </Button>
            )}
            {editing?.id === c.id && (
              <form
                className="grid gap-3 border-t border-[#ececef] pt-4 sm:col-span-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  update.mutate(editing);
                }}
              >
                <div>
                  <Label>Campaign name</Label>
                  <Input
                    value={editing.name}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <Label>Daily budget</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editing.dailyBudget}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        dailyBudget: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={update.isPending}>
                    <Save size={14} /> Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(undefined)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
      {!campaigns.length && (
        <div className="dot-grid grid min-h-96 place-items-center rounded-2xl border border-dashed border-[#d4d6dc] text-center">
          <div>
            <Megaphone className="mx-auto text-[#999eaa]" size={31} />
            <h3 className="mt-3 font-black">No campaigns yet</h3>
            <p className="mt-1 max-w-xs text-sm leading-6 text-[#7c818b]">
              Campaigns created through the builder or API will appear here with
              live publishing state.
            </p>
          </div>
        </div>
      )}
      {publish.error && (
        <p className="text-sm text-red-600">{publish.error.message}</p>
      )}
      {changeStatus.error && (
        <p className="text-sm text-red-600">{changeStatus.error.message}</p>
      )}
      {(update.error || remove.error) && (
        <p className="text-sm text-red-600">
          {(update.error ?? remove.error)?.message}
        </p>
      )}
    </div>
  );
}
