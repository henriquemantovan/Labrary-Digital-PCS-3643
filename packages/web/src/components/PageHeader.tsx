import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-medium tracking-wide text-subtle-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-[28px]">
          {title}
        </h1>
        {intro && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {intro}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}
