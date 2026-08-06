"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
type Notice = {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
  readAt?: string;
  createdAt: string;
};
export function NotificationList() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notice[]>("/api/v1/notifications"),
  });
  const unread = data.filter((n) => !n.readAt);
  const mark = useMutation({
    mutationFn: () =>
      api("/api/v1/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids: unread.map((n) => n.id) }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={!unread.length || mark.isPending}
            onClick={() => mark.mutate()}
          >
            <CheckCheck size={15} />
            Mark all read
          </Button>
        </div>
        <div className="divide-y divide-[#ececef]">
          {data.map((notice) => (
            <div
              key={notice.id}
              className={`flex gap-4 py-4 ${notice.readAt ? "opacity-60" : ""}`}
            >
              <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff0eb] text-[#e84b2a]">
                <Bell size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{notice.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#737883]">
                  {notice.message}
                </p>
                <p className="mt-1 text-xs text-[#9a9ea7]">
                  {new Date(notice.createdAt).toLocaleString()}
                </p>
              </div>
              {notice.actionUrl && (
                <Button asChild size="sm" variant="ghost">
                  <Link href={notice.actionUrl}>Open</Link>
                </Button>
              )}
            </div>
          ))}
          {!data.length && (
            <div className="grid min-h-64 place-items-center text-center text-sm text-[#858a94]">
              You are all caught up.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
