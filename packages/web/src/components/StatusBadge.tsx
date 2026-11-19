import { Badge } from "./ui/badge";
import { statusLabels } from "../labels";
import { cn } from "../lib/utils";

const dots: Record<string, string> = {
  PREPARACAO: "bg-info",
  EM_AVALIACAO: "bg-warning",
  AJUSTES: "bg-destructive",
  FINALIZADO: "bg-success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    // "status-pill" é gancho dos testes (unitários e E2E), sem estilo próprio.
    <Badge className="status-pill">
      <span className={cn("size-1.5 rounded-full", dots[status] ?? "bg-subtle-foreground")} />
      {statusLabels[status]}
    </Badge>
  );
}
