"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Link2, Save } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
type Connection = {
  id: string;
  platform: string;
  name: string;
  externalAccountId: string;
  status: string;
  metadata?: {
    pages?: Array<{ id: string; name: string }>;
    pageId?: string;
    pixelId?: string;
    appId?: string;
    identityId?: string;
    boardId?: string;
  };
};
const platforms = ["META", "GOOGLE", "TIKTOK", "PINTEREST", "LINKEDIN"];
export function ConnectionList() {
  const { data = [] } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/api/v1/connections"),
  });
  return (
    <Card className="mt-8">
      <CardContent className="pt-5">
        <div className="mb-5">
          <h2 className="font-black">Advertising connections</h2>
          <p className="mt-1 text-sm text-[#777c86]">
            OAuth credentials are encrypted and campaigns are created paused for
            review.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {platforms.map((platform) => {
            const connection = data.find((item) => item.platform === platform);
            return (
              <div
                key={platform}
                className="rounded-xl border border-[#e3e4e8] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black">{platform}</p>
                  {connection && (
                    <CheckCircle2 size={16} className="text-emerald-600" />
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-[#858a94]">
                  {connection ? connection.name : "Not connected"}
                </p>
                <Button
                  asChild
                  size="sm"
                  variant={connection ? "ghost" : "secondary"}
                  className="mt-4 w-full"
                >
                  <a
                    href={`/api/v1/connections/${platform.toLowerCase()}/start`}
                  >
                    <Link2 size={14} />
                    {connection ? "Reconnect" : "Connect"}
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
      {data.find((connection) => connection.platform === "META") && (
        <MetaConfiguration
          connection={data.find(
            (connection) => connection.platform === "META",
          )!}
        />
      )}
      {data.find((connection) => connection.platform === "TIKTOK") && (
        <ProviderConfiguration
          connection={data.find(
            (connection) => connection.platform === "TIKTOK",
          )!}
          field="identityId"
          label="TikTok identity ID"
          hint="The authorized Business or Spark identity used as the ad identity."
        />
      )}
      {data.find((connection) => connection.platform === "PINTEREST") && (
        <ProviderConfiguration
          connection={data.find(
            (connection) => connection.platform === "PINTEREST",
          )!}
          field="boardId"
          label="Pinterest board ID"
          hint="Generated Pins are created on this board before being promoted."
        />
      )}
    </Card>
  );
}

function ProviderConfiguration({
  connection,
  field,
  label,
  hint,
}: {
  connection: Connection;
  field: "identityId" | "boardId";
  label: string;
  hint: string;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(connection.metadata?.[field] ?? "");
  const save = useMutation({
    mutationFn: () =>
      api("/api/v1/connections", {
        method: "PATCH",
        body: JSON.stringify({ connectionId: connection.id, [field]: value }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
  return (
    <div className="border-t border-[#ececef] p-5">
      <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <h3 className="text-sm font-black">{label}</h3>
          <p className="mt-1 text-xs text-[#777c86]">{hint}</p>
        </div>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          onClick={() => save.mutate()}
          disabled={!value || save.isPending}
        >
          <Save size={15} /> Save
        </Button>
      </div>
      {save.error && (
        <p className="mt-2 text-xs text-red-600">{save.error.message}</p>
      )}
    </div>
  );
}

function MetaConfiguration({ connection }: { connection: Connection }) {
  const qc = useQueryClient();
  const [pageId, setPageId] = useState(connection.metadata?.pageId ?? "");
  const [pixelId, setPixelId] = useState(connection.metadata?.pixelId ?? "");
  const [appId, setAppId] = useState(connection.metadata?.appId ?? "");
  const save = useMutation({
    mutationFn: () =>
      api("/api/v1/connections", {
        method: "PATCH",
        body: JSON.stringify({
          connectionId: connection.id,
          pageId: pageId || undefined,
          pixelId: pixelId || undefined,
          appId: appId || undefined,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
  return (
    <div className="border-t border-[#ececef] p-5">
      <h3 className="text-sm font-black">Meta publishing identity</h3>
      <p className="mt-1 text-xs text-[#777c86]">
        Choose the Page shown on ads. Pixel and app IDs are required only for
        sales and app-promotion optimization.
      </p>
      <div className="mt-4 grid items-end gap-3 md:grid-cols-4">
        <div>
          <Label>Facebook Page</Label>
          <select
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
          >
            <option value="">Select Page</option>
            {(connection.metadata?.pages ?? []).map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Pixel ID</Label>
          <Input
            value={pixelId}
            onChange={(event) => setPixelId(event.target.value)}
          />
        </div>
        <div>
          <Label>App ID</Label>
          <Input
            value={appId}
            onChange={(event) => setAppId(event.target.value)}
          />
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !pageId}
        >
          <Save size={15} /> Save Meta settings
        </Button>
      </div>
      {save.error && (
        <p className="mt-2 text-xs text-red-600">{save.error.message}</p>
      )}
      {save.isSuccess && (
        <p className="mt-2 text-xs text-emerald-700">Meta settings saved.</p>
      )}
    </div>
  );
}
