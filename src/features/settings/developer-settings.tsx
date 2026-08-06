"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, LifeBuoy, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
type Key = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAt?: string;
};
type Created = { secret: string; warning: string };
export function DeveloperSettings() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<Created>();
  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<Key[]>("/api/v1/api-keys"),
  });
  const create = useMutation({
    mutationFn: () =>
      api<Created>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name,
          scopes: [
            "products:read",
            "products:write",
            "creative:read",
            "creative:write",
            "campaigns:read",
            "campaigns:write",
            "analytics:read",
          ],
        }),
      }),
    onSuccess: (data) => {
      setRevealed(data);
      setName("");
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api("/api/v1/api-keys", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  return (
    <Card className="mt-8">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-[#ff5a36]" />
          <h2 className="font-black">Developer API keys</h2>
        </div>
        <p className="mt-1 text-sm text-[#777c86]">
          Scoped keys use the same tenant boundaries and role checks as
          interactive sessions.
        </p>
        <form onSubmit={submit} className="mt-4 flex max-w-xl gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production automation"
            required
            minLength={2}
          />
          <Button disabled={create.isPending}>Create key</Button>
        </form>
        {revealed && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              {revealed.warning}
            </p>
            <div className="mt-2 flex gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white p-3 text-xs">
                {revealed.secret}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(revealed.secret)}
              >
                <Copy size={14} />
                Copy
              </Button>
            </div>
          </div>
        )}
        <div className="mt-4 divide-y divide-[#ececef]">
          {keys.map((key) => (
            <div className="flex items-center gap-4 py-3" key={key.id}>
              <div className="flex-1">
                <p className="text-sm font-bold">
                  {key.name}{" "}
                  <code className="ml-2 text-xs font-normal text-[#858994]">
                    {key.prefix}…
                  </code>
                </p>
                <p className="mt-1 text-xs text-[#858994]">
                  {key.scopes.length} scopes ·{" "}
                  {key.lastUsedAt
                    ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : "Never used"}
                </p>
              </div>
              <span className="text-xs font-bold">{key.status}</span>
              {key.status === "ACTIVE" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke.mutate(key.id)}
                >
                  <Trash2 size={14} />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api("/api/v1/support", {
        method: "POST",
        body: JSON.stringify({ subject, body, priority: "NORMAL" }),
      }),
    onSuccess: () => {
      setSubject("");
      setBody("");
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  return (
    <Card className="mt-8">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2">
          <LifeBuoy size={18} className="text-[#7457e8]" />
          <h2 className="font-black">Support</h2>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div>
            <Label>What happened?</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={20}
            />
          </div>
          <Button className="w-fit" disabled={create.isPending}>
            Open support ticket
          </Button>
          {create.isSuccess && (
            <p className="text-sm text-emerald-700">
              Ticket created. The support team can now track it in
              administration.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
