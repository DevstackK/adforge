"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, FolderPlus, RotateCcw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectCreate() {
  const [name, setName] = useState("");
  const client = useQueryClient();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "all"],
    queryFn: () =>
      api<
        Array<{
          id: string;
          name: string;
          status: "ACTIVE" | "ARCHIVED";
          _count: { products: number; assets: number; campaigns: number };
        }>
      >("/api/v1/projects?includeArchived=true"),
  });
  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      setName("");
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: "ACTIVE" | "ARCHIVED" }) =>
      api(`/api/v1/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["projects"] }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <div className="mb-5 max-w-4xl rounded-2xl border border-[#e1e2e6] bg-white p-3 shadow-sm">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New project name"
          minLength={2}
          required
          aria-label="New project name"
        />
        <Button disabled={create.isPending}>
          <FolderPlus size={16} />
          Create project
        </Button>
      </form>
      {!!projects.length && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#ececef] pt-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-3 py-2"
            >
              <div>
                <p className="text-xs font-bold">{project.name}</p>
                <p className="text-[10px] text-[#858994]">
                  {project._count.products} products · {project._count.assets}{" "}
                  assets · {project.status.toLowerCase()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={status.isPending}
                aria-label={`${project.status === "ACTIVE" ? "Archive" : "Restore"} ${project.name}`}
                onClick={() =>
                  status.mutate({
                    id: project.id,
                    value: project.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                  })
                }
              >
                {project.status === "ACTIVE" ? (
                  <Archive size={13} />
                ) : (
                  <RotateCcw size={13} />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
      {(create.error || status.error) && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {(create.error ?? status.error)?.message}
        </p>
      )}
    </div>
  );
}
