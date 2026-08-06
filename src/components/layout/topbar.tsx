"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Bell, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import Link from "next/link";

type SearchResult = {
  id: string;
  name: string;
  kind: "project" | "product" | "campaign" | "asset";
  href: string;
  status?: string;
  platform?: string;
  type?: string;
};

export function Topbar() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const { data = [], isFetching } = useQuery({
    queryKey: ["global-search", deferredQuery],
    queryFn: () =>
      api<SearchResult[]>(
        `/api/v1/search?q=${encodeURIComponent(deferredQuery)}`,
      ),
    enabled: deferredQuery.length >= 2,
    staleTime: 15_000,
  });
  return (
    <header className="sticky top-0 z-20 flex h-17 items-center justify-between border-b border-[#e5e6ea] bg-[#f5f6f8]/90 px-5 backdrop-blur-xl md:px-8">
      <div className="relative hidden w-full max-w-sm md:block">
        <Search className="absolute left-3 top-3 text-[#92969f]" size={17} />
        <Input
          className="h-10 bg-white/80 pl-9"
          placeholder="Search campaigns and assets…"
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {query.trim().length >= 2 && (
          <div className="absolute inset-x-0 top-12 overflow-hidden rounded-xl border border-[#e1e2e6] bg-white shadow-xl">
            <div className="max-h-80 overflow-y-auto p-2">
              {data.map((result) => (
                <Link
                  key={`${result.kind}-${result.id}`}
                  href={result.href}
                  onClick={() => setQuery("")}
                  className="focus-ring flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#f5f5f7]"
                >
                  <span className="truncate text-sm font-semibold">
                    {result.name}
                  </span>
                  <span className="ml-3 text-[10px] font-black uppercase tracking-wider text-[#888d97]">
                    {result.platform ?? result.type ?? result.kind}
                  </span>
                </Link>
              ))}
              {!isFetching && !data.length && (
                <p className="px-3 py-5 text-center text-xs text-[#858994]">
                  No matching workspace records
                </p>
              )}
              {isFetching && (
                <p className="px-3 py-3 text-xs text-[#858994]">Searching…</p>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
        />
        <Link
          aria-label="Notifications"
          href="/notifications"
          className="focus-ring grid size-9 place-items-center rounded-full border border-[#e0e2e6] bg-white text-[#626670]"
        >
          <Bell size={17} />
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
