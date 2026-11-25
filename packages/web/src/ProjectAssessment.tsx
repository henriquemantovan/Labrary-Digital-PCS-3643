import { useState } from "react";
import type { User } from "./api";
import { Rubrics } from "./Rubrics";
import { Evaluations } from "./Evaluations";
import { ChevronDown } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { buttonRow, panelTitle } from "./components/Panel";
import { cn } from "./lib/utils";

export function ProjectAssessment({ projectId, projectStatus, user, expired, onConfigurationSaved }: {
  projectId: number;
  projectStatus?: string;
  user: User;
  expired: () => void;
  onConfigurationSaved?: () => Promise<void>;
}) {
  const [rubrics, setRubrics] = useState(false);
  const [evaluations, setEvaluations] = useState(false);
  const canSeeEvaluations = user.role !== "ALUNO";
  const toggle = (open: boolean) => cn("transition-transform", open && "rotate-180");
  return <div className="grid gap-6">
    <Card className="flex-row flex-wrap items-center justify-between gap-3 p-5 md:p-6">
      <div className="grid gap-1">
        <h2 className={panelTitle}>Avaliação</h2>
        <p className="text-sm text-muted-foreground">
          {canSeeEvaluations ? "Requisitos, rubrica e avaliações desta entrega." : "Requisitos e critérios usados na avaliação."}
        </p>
      </div>
      <div className={buttonRow}>
        <Button variant={rubrics ? "secondary" : "outline"} size="sm" aria-expanded={rubrics} onClick={() => setRubrics(!rubrics)}>
          Requisitos e rubrica
          <ChevronDown aria-hidden="true" className={toggle(rubrics)} />
        </Button>
        {canSeeEvaluations && <Button variant={evaluations ? "secondary" : "outline"} size="sm" aria-expanded={evaluations} onClick={() => setEvaluations(!evaluations)}>
          Avaliações por rubrica
          <ChevronDown aria-hidden="true" className={toggle(evaluations)} />
        </Button>}
      </div>
    </Card>
    {rubrics && <Rubrics projectId={projectId} canEdit={["PROFESSOR", "ADMIN"].includes(user.role)} expired={expired} onConfigurationSaved={onConfigurationSaved} />}
    {canSeeEvaluations && evaluations && <Evaluations projectId={projectId} projectStatus={projectStatus} user={user} expired={expired} />}
  </div>;
}
