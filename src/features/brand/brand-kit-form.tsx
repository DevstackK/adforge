"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Palette, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AssetUploader } from "@/features/editor/asset-uploader";
type Logo = { id: string; name: string; type: string };
type Kit = {
  id: string;
  name: string;
  isDefault: boolean;
  colors: { primary: string; secondary: string; accent: string };
  typography: { heading: string; body: string };
  voice: {
    tone?: string[];
    forbiddenTerms?: string[];
    productClaims?: string[];
  };
  logoAssetId?: string | null;
};
export function BrandKitForm() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#ff5a36");
  const [secondary, setSecondary] = useState("#171a21");
  const [accent, setAccent] = useState("#7457e8");
  const [heading, setHeading] = useState("Inter");
  const [body, setBody] = useState("Inter");
  const [tone, setTone] = useState("clear, confident");
  const [forbiddenTerms, setForbiddenTerms] = useState("");
  const [productClaims, setProductClaims] = useState("");
  const [logoAssetId, setLogoAssetId] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const { data = [] } = useQuery({
    queryKey: ["brand-kits"],
    queryFn: () => api<Kit[]>("/api/v1/brand-kits"),
  });
  const { data: logos = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Logo[]>("/api/v1/assets"),
    select: (assets) => assets.filter((asset) => asset.type === "LOGO"),
  });
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const mutation = useMutation({
    mutationFn: () =>
      api(
        editingId ? `/api/v1/brand-kits/${editingId}` : "/api/v1/brand-kits",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            colors: {
              primary,
              secondary,
              accent,
            },
            typography: { heading, body },
            voice: {
              tone: list(tone),
              forbiddenTerms: list(forbiddenTerms),
              productClaims: list(productClaims),
            },
            logoAssetId: logoAssetId || undefined,
            ...(!editingId ? { isDefault: !data.length } : {}),
          }),
        },
      ),
    onSuccess: () => {
      reset();
      void qc.invalidateQueries({ queryKey: ["brand-kits"] });
    },
  });
  const setDefault = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/brand-kits/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brand-kits"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/brand-kits/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["brand-kits"] }),
  });
  function reset() {
    setEditingId(undefined);
    setName("");
    setPrimary("#ff5a36");
    setSecondary("#171a21");
    setAccent("#7457e8");
    setHeading("Inter");
    setBody("Inter");
    setTone("clear, confident");
    setForbiddenTerms("");
    setProductClaims("");
    setLogoAssetId("");
  }
  function edit(kit: Kit) {
    setEditingId(kit.id);
    setName(kit.name);
    setPrimary(kit.colors.primary);
    setSecondary(kit.colors.secondary);
    setAccent(kit.colors.accent);
    setHeading(kit.typography.heading);
    setBody(kit.typography.body);
    setTone((kit.voice.tone ?? []).join(", "));
    setForbiddenTerms((kit.voice.forbiddenTerms ?? []).join(", "));
    setProductClaims((kit.voice.productClaims ?? []).join(", "));
    setLogoAssetId(kit.logoAssetId ?? "");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
      <Card className="h-fit">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <h2 className="font-black">
              {editingId ? "Edit brand kit" : "New brand kit"}
            </h2>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <X size={14} /> Cancel
              </Button>
            )}
          </div>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="North America master"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Primary", primary, setPrimary],
                ["Secondary", secondary, setSecondary],
                ["Accent", accent, setAccent],
              ].map(([label, value, setter]) => (
                <label key={String(label)} className="text-xs font-bold">
                  {String(label)}
                  <Input
                    type="color"
                    className="mt-1 p-1"
                    value={String(value)}
                    onChange={(event) =>
                      (setter as (value: string) => void)(event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Heading font</Label>
                <Input
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Body font</Label>
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label>Logo</Label>
                <AssetUploader assetType="LOGO" />
              </div>
              <select
                value={logoAssetId}
                onChange={(e) => setLogoAssetId(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              >
                <option value="">No logo</option>
                {logos.map((logo) => (
                  <option key={logo.id} value={logo.id}>
                    {logo.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Voice tones (comma separated)</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>
            <div>
              <Label>Forbidden terms</Label>
              <Input
                value={forbiddenTerms}
                onChange={(e) => setForbiddenTerms(e.target.value)}
              />
            </div>
            <div>
              <Label>Approved claims</Label>
              <Input
                value={productClaims}
                onChange={(e) => setProductClaims(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={mutation.isPending}>
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? "Save changes" : "Create kit"}
            </Button>
            {mutation.error && (
              <p role="alert" className="text-sm text-red-600">
                {mutation.error.message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.map((kit) => (
          <Card key={kit.id}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-black">{kit.name}</h3>
                {kit.isDefault && (
                  <span className="text-xs font-bold text-[#e84b2a]">
                    DEFAULT
                  </span>
                )}
              </div>
              <div className="my-5 flex gap-2">
                {Object.values(kit.colors).map((color) => (
                  <span
                    key={color}
                    className="size-10 rounded-xl border border-black/10"
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="rounded-xl bg-[#f5f5f7] p-4">
                <p
                  style={{ fontFamily: kit.typography.heading }}
                  className="text-lg font-black"
                >
                  Campaign headline
                </p>
                <p
                  style={{ fontFamily: kit.typography.body }}
                  className="mt-1 text-sm text-[#6e727c]"
                >
                  Typography stays consistent across every generated asset.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => edit(kit)}>
                  <Pencil size={14} /> Edit
                </Button>
                {!kit.isDefault && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(kit.id)}
                    >
                      <Check size={14} /> Set default
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete ${kit.name}?`))
                          remove.mutate(kit.id);
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!data.length && (
          <div className="col-span-full grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d4d6dc]">
            <Palette className="text-[#aaaeb6]" />
          </div>
        )}
        {(setDefault.error || remove.error) && (
          <p role="alert" className="col-span-full text-sm text-red-600">
            {(setDefault.error ?? remove.error)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
