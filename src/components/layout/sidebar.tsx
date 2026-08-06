"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  FileText,
  Film,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  Palette,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "./brand";
import { cn } from "@/lib/utils";

const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/products", "Products", Boxes],
  ["/copy-studio", "Copy studio", FileText],
  ["/image-studio", "Image studio", ImageIcon],
  ["/video-studio", "Video studio", Film],
  ["/campaigns", "Campaigns", Megaphone],
  ["/analytics", "Analytics", BarChart3],
  ["/brand-kit", "Brand kit", Palette],
  ["/team", "Team", Users],
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 border-r border-[#e5e6ea] bg-[#fafafa] p-4 lg:flex lg:flex-col">
      <div className="px-2 py-2">
        <Brand />
      </div>
      <div className="my-5 h-px bg-[#e5e6ea]" />
      <nav className="space-y-1">
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#626670] transition hover:bg-white hover:text-[#20232b]",
              path === href &&
                "bg-white text-[#171a21] shadow-sm ring-1 ring-[#e6e7eb]",
            )}
          >
            <Icon size={18} strokeWidth={1.9} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-1">
        <Link
          href="/admin"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#626670] hover:bg-white"
        >
          <ShieldCheck size={18} />
          Admin
        </Link>
        <Link
          href="/settings"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#626670] hover:bg-white"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
