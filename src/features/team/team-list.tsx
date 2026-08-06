/* eslint-disable @next/next/no-img-element -- Clerk avatar origins differ by tenant */
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
type Member = {
  id: string;
  role: string;
  joinedAt: string;
  user: { id: string; name?: string; email: string; avatarUrl?: string };
};
type TeamResponse = {
  members: Member[];
  currentUserId: string;
  canManage: boolean;
};
export function TeamList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: () => api<TeamResponse>("/api/v1/team"),
  });
  const update = useMutation({
    mutationFn: (input: { membershipId: string; role: string }) =>
      api("/api/v1/team", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
  const remove = useMutation({
    mutationFn: (membershipId: string) =>
      api("/api/v1/team", {
        method: "DELETE",
        body: JSON.stringify({ membershipId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
  const members = data?.members ?? [];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="divide-y divide-[#ececef]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 py-4">
              <div className="grid size-10 place-items-center overflow-hidden rounded-full bg-[#efedff] font-black text-[#664bd0]">
                {m.user.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" />
                ) : (
                  (m.user.name ?? m.user.email)[0]?.toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">
                  {m.user.name || m.user.email}
                </p>
                <p className="truncate text-xs text-[#81858f]">
                  {m.user.email}
                </p>
              </div>
              {data?.canManage && m.role !== "OWNER" ? (
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Role for ${m.user.email}`}
                    value={m.role}
                    disabled={update.isPending || remove.isPending}
                    onChange={(event) =>
                      update.mutate({
                        membershipId: m.id,
                        role: event.target.value,
                      })
                    }
                    className="h-9 rounded-xl border border-[#dfe1e6] bg-white px-2 text-xs font-bold"
                  >
                    {["ADMIN", "EDITOR", "ANALYST", "VIEWER"].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  {m.user.id !== data.currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.user.email}`}
                      onClick={() => remove.mutate(m.id)}
                      disabled={remove.isPending}
                    >
                      {remove.isPending ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <span className="rounded-full bg-[#f1f2f4] px-3 py-1 text-xs font-bold">
                  {m.role}
                </span>
              )}
            </div>
          ))}
          {!members.length && (
            <div className="grid min-h-60 place-items-center text-center">
              <div>
                <Users className="mx-auto text-[#aaaeb6]" />
                <p className="mt-2 text-sm">No team members found.</p>
              </div>
            </div>
          )}
        </div>
        {(update.error || remove.error) && (
          <p className="mt-3 text-sm text-red-600">
            {(update.error ?? remove.error)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
