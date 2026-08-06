import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 font-black tracking-[-.03em] text-[#171a21]"
    >
      <span className="forge-gradient grid size-9 place-items-center rounded-[11px] text-lg text-white shadow-sm">
        A
      </span>
      {!compact && (
        <span className="text-lg">
          AdForge <i className="not-italic text-[#ff5a36]">AI</i>
        </span>
      )}
    </Link>
  );
}
