import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Folder } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Empty as EmptyState,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { Spinner } from "./ui/spinner";

/** Classes do Alert de erro do coss, para avisos montados direto no markup. */
export const noticeClass =
  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-destructive/32 bg-destructive/4 px-3.5 py-3 text-sm text-destructive-foreground";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert variant="error">
      <CircleAlert />
      <AlertDescription className="flex-row flex-wrap items-center gap-x-3 gap-y-2 text-destructive-foreground">
        {children}
      </AlertDescription>
    </Alert>
  );
}

/** Confirmação de uma ação: Alert de sucesso do coss, anunciado como status. */
export function Success({ children }: { children: ReactNode }) {
  return (
    <Alert variant="success" role="status">
      <CircleCheck />
      <AlertDescription className="text-success-foreground">{children}</AlertDescription>
    </Alert>
  );
}

export function Loading({ label = "Carregando seu espaço…" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2.5 py-10 text-sm text-muted-foreground"
      role="status"
    >
      {/* O texto já anuncia o carregamento; o ícone é decorativo. */}
      <Spinner aria-hidden="true" aria-label={undefined} role="presentation" className="size-4" />
      {label}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <EmptyState className="rounded-2xl border border-dashed md:py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Folder />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2} className="text-base font-semibold">
          {title}
        </EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </EmptyState>
  );
}
