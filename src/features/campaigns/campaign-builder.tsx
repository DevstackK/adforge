"use client";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LoaderCircle, Plus, Rocket } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
type Project = { id: string; name: string };
type Asset = { id: string; name: string; type: string };
type Connection = {
  id: string;
  platform: string;
  name: string;
  status: string;
};
const platforms = ["META", "GOOGLE", "TIKTOK", "PINTEREST", "LINKEDIN"];
export function CampaignBuilder() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    adConnectionId: "",
    platform: "META",
    name: "",
    objective: "SALES",
    dailyBudget: 50,
    currency: "USD",
    locations: "US",
    ageMin: 18,
    ageMax: 65,
    creativeFormat: "SINGLE",
    headline: "",
    primaryText: "",
    description: "",
    cta: "SHOP_NOW",
    destinationUrl: "",
  });
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/projects"),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Asset[]>("/api/v1/assets"),
  });
  const { data: connections = [] } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/api/v1/connections"),
  });
  const { data: features } = useQuery({
    queryKey: ["features"],
    queryFn: () => api<Record<string, boolean>>("/api/v1/features"),
  });
  const available = useMemo(
    () =>
      connections.filter(
        (c) => c.platform === form.platform && c.status === "CONNECTED",
      ),
    [connections, form.platform],
  );
  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          projectId: form.projectId,
          adConnectionId: form.adConnectionId || undefined,
          platform: form.platform,
          name: form.name,
          objective: form.objective,
          dailyBudget: Number(form.dailyBudget),
          currency: form.currency,
          audience: {
            locations: form.locations
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
            ageMin: Number(form.ageMin),
            ageMax: Number(form.ageMax),
            genders: [],
            interests: [],
            languages: [],
          },
          schedule: { timezone: "UTC" },
          creativeFormat: form.creativeFormat,
          creativeAssetIds: assetIds,
          copy: {
            headline: form.headline,
            primaryText: form.primaryText,
            description: form.description || undefined,
            cta: form.cta,
            destinationUrl: form.destinationUrl,
          },
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
  function set(key: string, value: string | number) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "platform"
        ? { adConnectionId: "", creativeFormat: "SINGLE" }
        : {}),
    }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <Card className="mb-5">
      <button
        className="focus-ring flex w-full items-center justify-between rounded-2xl p-5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <span className="flex items-center gap-2 font-black">
            <Plus size={17} className="text-[#ff5a36]" />
            Build a campaign
          </span>
          <span className="mt-1 block text-xs text-[#7c818b]">
            Configure audience, economics, creative and destination.
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <CardContent className="border-t border-[#ececef] pt-5">
          <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
            <Field label="Project">
              <select
                required
                value={form.projectId}
                onChange={(e) => set("projectId", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                {platforms
                  .filter(
                    (platform) =>
                      platform !== "LINKEDIN" ||
                      features?.["linkedin-publishing"] !== false,
                  )
                  .map((p) => (
                    <option key={p}>{p}</option>
                  ))}
              </select>
            </Field>
            <Field label="Advertising account">
              <select
                value={form.adConnectionId}
                onChange={(e) => set("adConnectionId", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="">Create draft without account</option>
                {available.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campaign name">
              <Input
                required
                minLength={3}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="TrailPack · Prospecting · Hooks A-C"
              />
            </Field>
            <Field label="Objective">
              <select
                value={form.objective}
                onChange={(e) => set("objective", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                {[
                  "SALES",
                  "LEADS",
                  "TRAFFIC",
                  "AWARENESS",
                  "APP_PROMOTION",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily budget">
                <Input
                  required
                  type="number"
                  min={1}
                  value={form.dailyBudget}
                  onChange={(e) => set("dailyBudget", Number(e.target.value))}
                />
              </Field>
              <Field label="Currency">
                <Input
                  required
                  maxLength={3}
                  value={form.currency}
                  onChange={(e) =>
                    set("currency", e.target.value.toUpperCase())
                  }
                />
              </Field>
            </div>
            <Field label="Locations">
              <Input
                required
                value={form.locations}
                onChange={(e) => set("locations", e.target.value)}
                placeholder="US, CA, GB"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum age">
                <Input
                  required
                  type="number"
                  min={13}
                  max={65}
                  value={form.ageMin}
                  onChange={(e) => set("ageMin", Number(e.target.value))}
                />
              </Field>
              <Field label="Maximum age">
                <Input
                  required
                  type="number"
                  min={13}
                  max={65}
                  value={form.ageMax}
                  onChange={(e) => set("ageMax", Number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Creative assets">
              <select
                required
                multiple
                value={assetIds}
                onChange={(event) =>
                  setAssetIds(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className="min-h-28 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 py-2 text-sm"
              >
                {assets
                  .filter((a) => ["IMAGE", "VIDEO"].includes(a.type))
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} · {a.type}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-[#858994]">
                Hold Ctrl or Command to select multiple creative variants.
              </p>
            </Field>
            <Field label="Creative format">
              <select
                value={form.creativeFormat}
                onChange={(event) => set("creativeFormat", event.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="SINGLE">Individual ads</option>
                <option value="CAROUSEL" disabled={form.platform !== "META"}>
                  Meta carousel
                </option>
              </select>
            </Field>
            <Field label="Destination URL">
              <Input
                required
                type="url"
                value={form.destinationUrl}
                onChange={(e) => set("destinationUrl", e.target.value)}
                placeholder="https://brand.com/product"
              />
            </Field>
            <Field label="Headline">
              <Input
                required
                value={form.headline}
                onChange={(e) => set("headline", e.target.value)}
                maxLength={255}
              />
            </Field>
            <Field label="CTA">
              <Input
                required
                value={form.cta}
                onChange={(e) => set("cta", e.target.value)}
                maxLength={80}
              />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Primary text">
                <Textarea
                  required
                  value={form.primaryText}
                  onChange={(e) => set("primaryText", e.target.value)}
                  maxLength={5000}
                />
              </Field>
            </div>
            {create.error && (
              <p className="text-sm text-red-600 lg:col-span-2">
                {create.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 lg:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={create.isPending}>
                {create.isPending ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Rocket size={16} />
                )}
                Create campaign draft
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
