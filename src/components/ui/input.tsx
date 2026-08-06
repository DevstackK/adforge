import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm placeholder:text-[#989ca6]",
        className,
      )}
      {...props}
    />
  );
}
export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-28 w-full resize-y rounded-xl border border-[#dfe1e6] bg-white p-3 text-sm placeholder:text-[#989ca6]",
        className,
      )}
      {...props}
    />
  );
}
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-semibold text-[#3c4049]",
        className,
      )}
      {...props}
    />
  );
}
