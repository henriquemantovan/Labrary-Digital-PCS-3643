import type { ReactNode } from "react";
import { Folder } from "lucide-react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive [&_button]:rounded-full [&_button]:border [&_button]:border-destructive/30 [&_button]:bg-card [&_button]:px-3 [&_button]:py-1 [&_button]:text-[13px] [&_button]:font-medium"
      role="alert"
    >
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current/20 border-t-current"
    />
  );
}

export function Loading({ label = "Carregando seu espaço…" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 py-10 text-sm text-muted-foreground"
      role="status"
    >
      <Spinner />
      {label}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="mb-1 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Folder className="size-5" />
      </span>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
