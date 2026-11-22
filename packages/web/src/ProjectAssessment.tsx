import { useState } from "react";
import type { User } from "./api";
import { Rubrics } from "./Rubrics";
import { Evaluations } from "./Evaluations";

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
  return <div className="project-assessment">
    <div className="button-row">
      <button type="button" className="secondary" aria-expanded={rubrics} onClick={() => setRubrics(!rubrics)}>Requisitos e rubrica</button>
      {canSeeEvaluations && <button type="button" className="secondary" aria-expanded={evaluations} onClick={() => setEvaluations(!evaluations)}>Avaliações por rubrica</button>}
    </div>
    {rubrics && <Rubrics projectId={projectId} canEdit={["PROFESSOR", "ADMIN"].includes(user.role)} expired={expired} onConfigurationSaved={onConfigurationSaved} />}
    {canSeeEvaluations && evaluations && <Evaluations projectId={projectId} projectStatus={projectStatus} user={user} expired={expired} />}
  </div>;
}
