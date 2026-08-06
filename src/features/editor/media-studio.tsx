"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  Film,
  ImageIcon,
  Layers3,
  LoaderCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useEditorStore } from "./store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
type Project = { id: string; name: string };
type Generation = {
  id: string;
  kind: string;
  status: string;
  prompt: string;
  output?: { assetId?: string; assetIds?: string[] } | null;
  outputAsset?: { id: string; type: string } | null;
};
const imageKinds = [
  "IMAGE",
  "BACKGROUND_REMOVE",
  "BACKGROUND_REPLACE",
  "PRODUCT_ENHANCE",
  "LIFESTYLE",
  "CAROUSEL",
] as const;
const videoKinds = [
  "VIDEO",
  "UGC_VIDEO",
  "SLIDESHOW",
  "TALKING_AVATAR",
  "PRODUCT_SHOWCASE",
] as const;
export function MediaStudio({ mode }: { mode: "image" | "video" }) {
  const qc = useQueryClient();
  const { format, setFormat, scenes, musicUrl, selectedAssetId, template } =
    useEditorStore();
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState<string>(
    mode === "image" ? "IMAGE" : "UGC_VIDEO",
  );
  const [prompt, setPrompt] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [carouselSlides, setCarouselSlides] = useState(
    "Problem awareness\nProduct benefit\nProof and call to action",
  );
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/projects"),
  });
  const { data: features } = useQuery({
    queryKey: ["features"],
    queryFn: () => api<Record<string, boolean>>("/api/v1/features"),
  });
  const { data: generations = [] } = useQuery({
    queryKey: ["generations"],
    queryFn: () => api<Generation[]>("/api/v1/generations"),
    refetchInterval: (q) =>
      q.state.data?.some((g) => ["QUEUED", "PROCESSING"].includes(g.status))
        ? 3000
        : false,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Generation>("/api/v1/media/generate", {
        method: "POST",
        body: JSON.stringify({
          projectId: projectId || projects[0]?.id,
          kind,
          prompt,
          options: {
            format,
            ...(mode === "video"
              ? {
                  scenes,
                  musicUrl,
                  ...(kind === "TALKING_AVATAR" ? { avatarId, voiceId } : {}),
                }
              : {
                  sourceAssetId: selectedAssetId,
                  template,
                  ...(kind === "CAROUSEL"
                    ? {
                        carouselSlides: carouselSlides
                          .split("\n")
                          .map((headline) => headline.trim())
                          .filter(Boolean)
                          .map((headline, index) => ({
                            headline,
                            prompt: `${prompt}. Carousel slide ${index + 1}: ${headline}`,
                          })),
                      }
                    : {}),
                }),
          },
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["generations"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  const relevant = generations.filter((g) =>
    mode === "video"
      ? g.kind.includes("VIDEO") ||
        ["SLIDESHOW", "TALKING_AVATAR", "PRODUCT_SHOWCASE"].includes(g.kind)
      : !(
          g.kind.includes("VIDEO") ||
          ["SLIDESHOW", "TALKING_AVATAR", "PRODUCT_SHOWCASE"].includes(g.kind)
        ),
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardContent className="pt-5">
          <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-[#f0edff] text-[#684cc8]">
            {mode === "image" ? <ImageIcon /> : <Film />}
          </div>
          <h2 className="font-black">Generation setup</h2>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <Label>Project</Label>
              <select
                required
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Workflow</Label>
              <select
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {(mode === "image"
                  ? imageKinds
                  : videoKinds.filter(
                      (item) =>
                        item !== "TALKING_AVATAR" ||
                        features?.["talking-avatar"] !== false,
                    )
                ).map((item) => (
                  <option key={item}>{item.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Creative direction</Label>
              <Textarea
                required
                minLength={10}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "image"
                    ? "A tactile studio photograph with warm directional light…"
                    : "A brisk 15-second product story opening with the customer problem…"
                }
              />
            </div>
            {mode === "video" && kind === "TALKING_AVATAR" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>HeyGen avatar ID</Label>
                  <input
                    className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                    value={avatarId}
                    onChange={(event) => setAvatarId(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>HeyGen voice ID</Label>
                  <input
                    className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                    value={voiceId}
                    onChange={(event) => setVoiceId(event.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            {mode === "image" && kind === "CAROUSEL" && (
              <div>
                <Label>Slide headlines (one per line)</Label>
                <Textarea
                  value={carouselSlides}
                  onChange={(event) => setCarouselSlides(event.target.value)}
                  minLength={5}
                  required
                />
                <p className="mt-1 text-xs text-[#858994]">
                  Two to ten coordinated square cards are generated as separate
                  campaign-ready assets.
                </p>
              </div>
            )}
            <div>
              <Label>Placement</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["square", "portrait", "landscape", "story"] as const).map(
                  (item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setFormat(item)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize ${format === item ? "border-[#ff5a36] bg-[#fff2ee] text-[#dc4424]" : "border-[#e1e2e6] bg-white text-[#686c75]"}`}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            </div>
            {mutation.error && (
              <p className="text-sm text-red-600">{mutation.error.message}</p>
            )}
            <Button
              disabled={mutation.isPending || !projects.length}
              className="w-full"
            >
              {mutation.isPending ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              Queue generation
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {relevant.map((g) => (
          <Card key={g.id} className="overflow-hidden">
            <div className="dot-grid grid aspect-square place-items-center bg-[#eceef1]">
              {g.status === "SUCCEEDED" ? (
                g.kind === "CAROUSEL" ? (
                  <div className="flex flex-wrap justify-center gap-2 px-6">
                    {(g.output?.assetIds ?? []).map((assetId, index) => (
                      <a
                        key={assetId}
                        className="grid size-11 place-items-center rounded-xl bg-white text-sm font-black shadow"
                        href={`/api/v1/assets/${assetId}`}
                        target="_blank"
                      >
                        {index + 1}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    className="grid size-14 place-items-center rounded-full bg-white shadow"
                    href={`/api/v1/assets/${g.outputAsset?.id}`}
                    target="_blank"
                  >
                    {mode === "video" ? <Play /> : <ImageIcon />}
                  </a>
                )
              ) : (
                <div className="text-center">
                  <LoaderCircle
                    className={`mx-auto ${g.status !== "FAILED" ? "animate-spin" : ""}`}
                    size={24}
                  />
                  <p className="mt-2 text-xs font-bold">{g.status}</p>
                </div>
              )}
            </div>
            <CardContent>
              <div className="flex items-center gap-2">
                <Layers3 size={14} />
                <span className="text-xs font-black">
                  {g.kind.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[#727782]">
                {g.prompt}
              </p>
            </CardContent>
          </Card>
        ))}
        {!relevant.length && (
          <div className="dot-grid col-span-full grid min-h-[500px] place-items-center rounded-2xl border border-dashed border-[#d4d6dc] text-center">
            <div>
              <Sparkles className="mx-auto text-[#8b71df]" />
              <p className="mt-3 font-black">The canvas is ready</p>
              <p className="mt-1 text-sm text-[#7b808a]">
                Your generated {mode} assets will collect here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
