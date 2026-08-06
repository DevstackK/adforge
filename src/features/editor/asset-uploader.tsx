"use client";
import { ChangeEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Upload } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
]);
export function AssetUploader({
  accept = "image/jpeg,image/png,image/webp",
  assetType,
}: {
  accept?: string;
  assetType?: "IMAGE" | "LOGO" | "VIDEO" | "AUDIO";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const qc = useQueryClient();
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(undefined);
    if (!allowed.has(file.type) || file.size > 500_000_000) {
      setError("Choose a supported file under 500 MB.");
      return;
    }
    setLoading(true);
    try {
      const signed = await api<{ key: string; uploadUrl: string }>(
        "/api/v1/uploads/presign",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "-"),
            contentType: file.type,
            bytes: file.size,
          }),
        },
      );
      const response = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Object storage rejected the upload");
      const type =
        assetType ??
        (file.type.startsWith("image/")
          ? "IMAGE"
          : file.type.startsWith("video/")
            ? "VIDEO"
            : "AUDIO");
      await api("/api/v1/assets", {
        method: "POST",
        body: JSON.stringify({
          key: signed.key,
          name: file.name,
          type,
          mimeType: file.type,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["assets"] });
      event.target.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <Button asChild variant="secondary" size="sm">
        <label>
          {loading ? (
            <LoaderCircle className="animate-spin" size={15} />
          ) : (
            <Upload size={15} />
          )}
          Upload {assetType === "LOGO" ? "logo" : "asset"}
          <input
            className="sr-only"
            type="file"
            accept={accept}
            onChange={upload}
            disabled={loading}
          />
        </label>
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
