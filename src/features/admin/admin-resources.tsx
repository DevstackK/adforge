"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const tabs = ["users", "subscriptions", "flags", "tickets", "logs"] as const;
type Tab = (typeof tabs)[number];
type Row = Record<string, unknown> & { id: string };
export function AdminResources() {
  const [tab, setTab] = useState<Tab>("users");
  const [flagKey, setFlagKey] = useState("");
  const [flagDescription, setFlagDescription] = useState("");
  const qc = useQueryClient();
  const { data = [], error } = useQuery({
    queryKey: ["admin", tab],
    queryFn: () => api<Row[]>(`/api/v1/admin/resources?resource=${tab}`),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (body: object) =>
      api("/api/v1/admin/resources", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", tab] }),
  });
  const createFlag = useMutation({
    mutationFn: () =>
      api("/api/v1/admin/resources", {
        method: "POST",
        body: JSON.stringify({
          resource: "flags",
          key: flagKey,
          description: flagDescription,
          enabled: false,
        }),
      }),
    onSuccess: () => {
      setFlagKey("");
      setFlagDescription("");
      void qc.invalidateQueries({ queryKey: ["admin", "flags"] });
    },
  });
  return (
    <Card className="mt-5">
      <CardContent className="pt-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={tab === value ? "dark" : "ghost"}
              onClick={() => setTab(value)}
              className="capitalize"
            >
              {value}
            </Button>
          ))}
        </div>
        {tab === "flags" && (
          <form
            className="mb-5 grid gap-2 rounded-xl bg-[#f5f5f7] p-3 md:grid-cols-[180px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createFlag.mutate();
            }}
          >
            <Input
              value={flagKey}
              onChange={(event) => setFlagKey(event.target.value.toLowerCase())}
              placeholder="feature-key"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <Input
              value={flagDescription}
              onChange={(event) => setFlagDescription(event.target.value)}
              placeholder="What this rollout controls"
              required
              minLength={3}
            />
            <Button size="sm" disabled={createFlag.isPending}>
              Create disabled flag
            </Button>
          </form>
        )}
        {error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e6e7ea] text-xs uppercase tracking-wider text-[#858994]">
                  <th className="py-3">Resource</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-[#eff0f2]">
                    <td className="py-4 font-bold">
                      {String(
                        row.name ??
                          row.key ??
                          row.subject ??
                          row.action ??
                          row.email ??
                          row.id,
                      )}
                    </td>
                    <td className="max-w-md truncate text-[#747984]">
                      {String(
                        row.email ??
                          row.description ??
                          row.plan ??
                          row.entityType ??
                          row.organizationId ??
                          "",
                      )}
                    </td>
                    <td>
                      {String(
                        row.status ??
                          (row.enabled
                            ? "ENABLED"
                            : row.enabled === false
                              ? "DISABLED"
                              : row.isPlatformAdmin
                                ? "ADMIN"
                                : "ACTIVE"),
                      )}
                    </td>
                    <td className="text-right">
                      {tab === "flags" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            update.mutate({
                              resource: "flags",
                              id: row.id,
                              enabled: !row.enabled,
                            })
                          }
                        >
                          {row.enabled ? "Disable" : "Enable"}
                        </Button>
                      )}
                      {tab === "tickets" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            update.mutate({
                              resource: "tickets",
                              id: row.id,
                              status: "RESOLVED",
                            })
                          }
                        >
                          Resolve
                        </Button>
                      )}
                      {tab === "users" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              resource: "users",
                              id: row.id,
                              isPlatformAdmin: !row.isPlatformAdmin,
                            })
                          }
                        >
                          {row.isPlatformAdmin ? "Remove admin" : "Make admin"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.length && (
              <p className="py-16 text-center text-sm text-[#858994]">
                No records in this resource.
              </p>
            )}
            {(update.error || createFlag.error) && (
              <p role="alert" className="py-3 text-sm text-red-600">
                {(update.error ?? createFlag.error)?.message}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
