import { useState } from "react";
import type { User } from "./api";
import { Rubrics } from "./Rubrics";

export function ProjectAssessment({ projectId, user, expired, onConfigurationSaved }: {
  projectId: number;
  user: User;
  expired: () => void;
  onConfigurationSaved?: () => Promise<void>;
}) {
  const [rubrics, setRubrics] = useState(false);
  return <div className="project-assessment">
    <div className="button-row">
      <button type="button" className="secondary" aria-expanded={rubrics} onClick={() => setRubrics(!rubrics)}>Requisitos e rubrica</button>
    </div>
    {rubrics && <Rubrics projectId={projectId} canEdit={["PROFESSOR", "ADMIN"].includes(user.role)} expired={expired} onConfigurationSaved={onConfigurationSaved} />}
  </div>;
}
