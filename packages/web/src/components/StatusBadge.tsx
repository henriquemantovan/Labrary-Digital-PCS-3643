import { Badge, type BadgeProps } from "./ui/badge";
import { statusLabels } from "../labels";

const variants: Record<string, BadgeProps["variant"]> = {
  PREPARACAO: "info",
  EM_AVALIACAO: "warning",
  AJUSTES: "error",
  FINALIZADO: "success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    // "status-pill" é gancho dos testes (unitários e E2E), sem estilo próprio.
    <Badge variant={variants[status] ?? "secondary"} className="status-pill">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </Badge>
  );
}
