"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
export function InviteForm() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const invite = useMutation({
    mutationFn: () =>
      api("/api/v1/team", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["team"] });
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    invite.mutate();
  }
  return (
    <Card className="mb-5">
      <CardContent className="pt-5">
        <form
          onSubmit={submit}
          className="grid items-end gap-3 md:grid-cols-[1fr_180px_auto]"
        >
          <div>
            <Label>Email address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creative@company.com"
              required
            />
          </div>
          <div>
            <Label>Workspace role</Label>
            <select
              className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {["ADMIN", "EDITOR", "ANALYST", "VIEWER"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <Button disabled={invite.isPending}>
            <Send size={16} />
            Send invitation
          </Button>
        </form>
        {invite.error && (
          <p className="mt-3 text-sm text-red-600">{invite.error.message}</p>
        )}
        {invite.isSuccess && (
          <p className="mt-3 text-sm text-emerald-700">
            Invitation sent securely through Clerk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
