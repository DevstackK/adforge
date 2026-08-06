import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[#f0eeff] px-2.5 py-1 text-xs font-semibold text-[#6247c7]",
        className,
      )}
      {...props}
    />
  );
}
