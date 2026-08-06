"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Library, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Asset = {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  bytes: string;
  createdAt: string;
};

export function AssetLibrary({ types }: { types: string[] }) {
  const queryClient = useQueryClient();
  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Asset[]>("/api/v1/assets"),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/assets/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
  const visible = assets.filter((asset) => types.includes(asset.type));
  return (
    <Card className="mt-5">
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <Library size={17} className="text-[#7457e8]" />
          <h2 className="font-black">Asset library</h2>
          <span className="text-xs text-[#858994]">{visible.length} files</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.slice(0, 18).map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 rounded-xl border border-[#ececef] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{asset.name}</p>
                <p className="text-[11px] text-[#858994]">
                  {asset.type} · {(Number(asset.bytes) / 1_000_000).toFixed(1)}{" "}
                  MB
                </p>
              </div>
              <Button asChild size="sm" variant="ghost">
                <a
                  href={`/api/v1/assets/${asset.id}`}
                  target="_blank"
                  aria-label={`Download ${asset.name}`}
                >
                  <Download size={14} />
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                aria-label={`Delete ${asset.name}`}
                onClick={() => {
                  if (window.confirm(`Delete ${asset.name}?`))
                    remove.mutate(asset.id);
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {!visible.length && (
            <p className="text-sm text-[#858994]">No matching assets yet.</p>
          )}
        </div>
        {remove.error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {remove.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
