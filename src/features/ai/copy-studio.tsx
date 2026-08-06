"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Check, Clipboard, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
type Project = { id: string; name: string };
type Result = {
  generationId: string;
  variants: Array<{ id: string; content: string; score?: number }>;
};
const kinds = [
  "HEADLINE",
  "PRIMARY_TEXT",
  "CTA",
  "DESCRIPTION",
  "EMAIL",
  "LANDING_PAGE",
  "BLOG",
  "SEO",
  "CREATIVE_IDEA",
  "AUDIENCE",
  "HOOK",
  "OFFER",
  "IMAGE_PROMPT",
  "VIDEO_SCRIPT",
  "VOICEOVER",
  "CAPTION",
];
export function CopyStudio() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/projects"),
  });
  const [form, setForm] = useState({
    projectId: "",
    kind: "HEADLINE",
    brief: "",
    audience: "",
    tone: "Confident and clear",
    language: "en",
    variants: 3,
  });
  const [copied, setCopied] = useState<string>();
  const mutation = useMutation({
    mutationFn: () =>
      api<Result>("/api/v1/copy/generate", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          projectId: form.projectId || projects[0]?.id,
        }),
      }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  function update(key: string, value: string | number) {
    setForm((v) => ({ ...v, [key]: value }));
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <Card className="h-fit">
        <CardContent className="pt-5">
          <h2 className="font-black">Creative brief</h2>
          <p className="mt-1 text-sm text-[#767b85]">
            Ground the model in a real audience and product claim.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <Label>Project</Label>
              <select
                required
                value={form.projectId}
                onChange={(e) => update("projectId", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
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
              <Label>Asset type</Label>
              <select
                value={form.kind}
                onChange={(e) => update("kind", e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                {kinds.map((k) => (
                  <option key={k}>{k.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Brief</Label>
              <Textarea
                value={form.brief}
                onChange={(e) => update("brief", e.target.value)}
                placeholder="Describe the product, proof points, offer and desired action…"
                required
                minLength={10}
              />
            </div>
            <div>
              <Label>Audience</Label>
              <Input
                value={form.audience}
                onChange={(e) => update("audience", e.target.value)}
                placeholder="Independent ecommerce founders"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tone</Label>
                <Input
                  value={form.tone}
                  onChange={(e) => update("tone", e.target.value)}
                />
              </div>
              <div>
                <Label>Variants</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.variants}
                  onChange={(e) => update("variants", Number(e.target.value))}
                />
              </div>
            </div>
            {mutation.error && (
              <p className="text-sm text-red-600" role="alert">
                {mutation.error.message}
              </p>
            )}
            <Button
              className="w-full"
              disabled={mutation.isPending || !projects.length}
            >
              {mutation.isPending ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Sparkles size={17} />
              )}
              Forge variants
            </Button>
          </form>
        </CardContent>
      </Card>
      <div>
        {mutation.data ? (
          <div className="space-y-4">
            {mutation.data.variants.map((variant, index) => (
              <Card key={variant.id}>
                <CardContent className="pt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-[.12em] text-[#8b8f98]">
                      Variant {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {variant.score && (
                        <span className="rounded-full bg-[#eaf8f2] px-2 py-1 text-xs font-bold text-[#168160]">
                          Score {Math.round(variant.score)}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(variant.content);
                          setCopied(variant.id);
                        }}
                      >
                        {copied === variant.id ? (
                          <Check size={15} />
                        ) : (
                          <Clipboard size={15} />
                        )}{" "}
                        {copied === variant.id ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#30343d]">
                    {variant.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="dot-grid grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-[#d4d6dc] bg-white/40 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0edff] text-[#6c4dd0]">
                <Sparkles />
              </span>
              <h3 className="mt-4 font-black">Variants appear here</h3>
              <p className="mt-2 text-sm leading-6 text-[#7a7e88]">
                Choose a format and give the forge enough truth to make
                something sharp.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
