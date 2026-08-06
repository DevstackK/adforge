"use client";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Type } from "lucide-react";
import { api } from "@/lib/api-client";
import { useEditorStore } from "./store";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { AssetUploader } from "./asset-uploader";

type Asset = { id: string; name: string; type: string };
export function ImageTemplateEditor() {
  const { selectedAssetId, setAsset, template, setTemplate, format } =
    useEditorStore();
  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Asset[]>("/api/v1/assets"),
  });
  const ratio =
    format === "landscape"
      ? "aspect-video"
      : format === "portrait" || format === "story"
        ? "aspect-[9/16]"
        : "aspect-square";
  return (
    <Card className="mb-5">
      <CardContent className="grid gap-6 pt-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black">Template & transformation controls</h2>
              <p className="text-xs leading-5 text-[#7d828c]">
                Select a source for removal, replacement or enhancement.
                Template settings travel with the generation job.
              </p>
            </div>
            <AssetUploader />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Source product image (optional)</Label>
              <select
                value={selectedAssetId ?? ""}
                onChange={(e) => setAsset(e.target.value || undefined)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="">Generate from prompt</option>
                {assets
                  .filter((asset) => asset.type === "IMAGE")
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>
                <Type size={14} className="mr-1 inline" />
                Headline overlay
              </Label>
              <Input
                value={template.headline}
                onChange={(e) => setTemplate({ headline: e.target.value })}
                maxLength={90}
                placeholder="Built for the miles between"
              />
            </div>
            <div>
              <Label>Brand color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="w-14 p-1"
                  value={template.brandColor}
                  onChange={(e) => setTemplate({ brandColor: e.target.value })}
                />
                <Input
                  value={template.brandColor}
                  onChange={(e) => setTemplate({ brandColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Typography</Label>
              <select
                value={template.fontFamily}
                onChange={(e) => setTemplate({ fontFamily: e.target.value })}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                {["Inter", "Arial", "Georgia", "Helvetica"].map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Logo position</Label>
              <select
                value={template.logoPosition}
                onChange={(e) =>
                  setTemplate({
                    logoPosition: e.target
                      .value as typeof template.logoPosition,
                  })
                }
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                {["top-left", "top-right", "bottom-left", "bottom-right"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label>Logo asset</Label>
                <AssetUploader assetType="LOGO" />
              </div>
              <select
                value={template.logoAssetId ?? ""}
                onChange={(e) =>
                  setTemplate({ logoAssetId: e.target.value || undefined })
                }
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="">No logo</option>
                {assets
                  .filter((asset) => asset.type === "LOGO")
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>Safe margin (px)</Label>
              <Input
                type="number"
                min={16}
                max={160}
                value={template.safeMargin}
                onChange={(e) =>
                  setTemplate({ safeMargin: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>
        <div
          className={`dot-grid relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl border border-[#d9dbe0] bg-[#252936] ${ratio}`}
        >
          <div
            className="absolute inset-x-5 bottom-5 rounded-lg p-3 text-white"
            style={{
              background: template.brandColor,
              fontFamily: template.fontFamily,
            }}
          >
            <p className="text-sm font-black leading-tight">
              {template.headline || "Your campaign headline"}
            </p>
          </div>
          <div className="absolute left-4 top-4 grid size-9 place-items-center rounded-lg bg-white/90 text-[#333]">
            <ImageIcon size={16} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
