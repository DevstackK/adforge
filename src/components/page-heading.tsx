import type { ReactNode } from "react";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-[#ff5a36]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-black tracking-[-.035em] text-[#171a21]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6a6f7a]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
