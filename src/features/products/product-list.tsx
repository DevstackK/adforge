/* eslint-disable @next/next/no-img-element -- product origins are user-imported and are not known at build time */
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import {
  ExternalLink,
  Globe2,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
type Project = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description: string;
  sourceUrl?: string;
  imageUrls: string[];
  price?: string | null;
  currency: string;
};
export function ProductList() {
  const client = useQueryClient();
  const [url, setUrl] = useState("");
  const [projectId, setProjectId] = useState("");
  const [editing, setEditing] = useState<Product>();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/api/v1/projects"),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api<Product[]>("/api/v1/products"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<Product>("/api/v1/products/import", {
        method: "POST",
        body: JSON.stringify({ url, projectId: projectId || projects[0]?.id }),
      }),
    onSuccess: () => {
      setUrl("");
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const update = useMutation({
    mutationFn: (product: Product) =>
      api<Product>(`/api/v1/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          sourceUrl: product.sourceUrl || null,
          price: product.price ? Number(product.price) : null,
          currency: product.currency,
          imageUrls: product.imageUrls,
        }),
      }),
    onSuccess: () => {
      setEditing(undefined);
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/products/${id}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["products"] }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardContent className="pt-5">
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-[#fff0eb] text-[#e84b2a]">
            <Globe2 size={21} />
          </div>
          <h2 className="font-black">Import from a product page</h2>
          <p className="mt-1 text-sm leading-6 text-[#747984]">
            We securely extract structured product data, imagery, price and
            positioning.
          </p>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="project">Project</Label>
              <select
                id="project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                required
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="url">Product URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://shop.example.com/product"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            {mutation.error && (
              <p role="alert" className="text-sm text-red-600">
                {mutation.error.message}
              </p>
            )}
            <Button
              className="w-full"
              disabled={mutation.isPending || !projects.length}
            >
              {mutation.isPending ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <PackageOpen size={16} />
              )}
              Import product
            </Button>
            {!projects.length && (
              <p className="text-xs text-amber-700">
                Create a project from the overview API before importing.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-[16/10] bg-[#eceef1]">
              {product.imageUrls[0] ? (
                <img
                  src={product.imageUrls[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-[#a1a5ae]">
                  <PackageOpen />
                </div>
              )}
            </div>
            <CardContent className="pt-4">
              <div className="flex justify-between gap-2">
                <h3 className="font-black">{product.name}</h3>
                {product.sourceUrl && (
                  <a
                    href={product.sourceUrl}
                    rel="noreferrer"
                    target="_blank"
                    aria-label="View source"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#737781]">
                {product.description}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-black">
                  {product.price
                    ? new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: product.currency,
                      }).format(Number(product.price))
                    : "Price unavailable"}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => setEditing({ ...product })}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${product.name}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${product.name}? This cannot be undone.`,
                        )
                      )
                        remove.mutate(product.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {editing?.id === product.id && (
                <form
                  className="mt-4 space-y-3 border-t border-[#ececef] pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    update.mutate(editing);
                  }}
                >
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editing.name}
                      onChange={(event) =>
                        setEditing({ ...editing, name: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={editing.description}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          description: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <div>
                      <Label>Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editing.price ?? ""}
                        onChange={(event) =>
                          setEditing({ ...editing, price: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Input
                        value={editing.currency}
                        maxLength={3}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            currency: event.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
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
                      <X size={14} /> Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
        {!products.length && (
          <div className="col-span-full grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#d4d6db] text-center">
            <div>
              <PackageOpen className="mx-auto text-[#aaaeb6]" size={32} />
              <p className="mt-3 font-bold">Your product library is empty</p>
              <p className="mt-1 text-sm text-[#7f838c]">
                Import a public product page to begin.
              </p>
            </div>
          </div>
        )}
      </div>
      {(update.error || remove.error) && (
        <p role="alert" className="xl:col-start-2 text-sm text-red-600">
          {(update.error ?? remove.error)?.message}
        </p>
      )}
    </div>
  );
}
