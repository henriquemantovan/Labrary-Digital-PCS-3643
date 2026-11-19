import type { RubricVersion } from "./assessmentTypes";

/** Item do checklist da HU05 (GET /projects/:id/submission-checklist). */
export interface ChecklistItem {
  kind: "VIDEO" | "RELATORIO" | "MANUAL";
  label: string;
  materialId: number | null;
  versionId: number | null;
  ok: boolean;
}

export type SubmissionBlock =
  | "RUBRIC_NOT_CONFIGURED"
  | "SUBMISSION_LOCKED"
  | "DEADLINE_PASSED"
  | "INCOMPLETE_SUBMISSION";

export interface SubmissionChecklist {
  projectStatus: string;
  rubricVersionId: number | null;
  items: ChecklistItem[];
  blockedBy: SubmissionBlock | null;
  canSubmit: boolean;
  /** Professor da turma, em Preparação com prazo vencido (regra do servidor). */
  canReopen: boolean;
  lastReopening: Reopening | null;
}

/** Reabertura explícita pelo professor (POST /projects/:id/reopen). */
export interface Reopening {
  id: number;
  projectId: number;
  reopenedBy: number;
  reopenedAt: string;
  reason: string;
}

export interface SubmittedMaterial {
  materialId: number;
  kind: string;
  title: string;
  versionId: number;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
}

/** Rodada C1 (docs/contratos/c1-submissao.md). */
export interface Submission {
  id: number;
  projectId: number;
  round: number;
  clientSubmissionId: string;
  status: "SUBMETIDA" | "DEVOLVIDA";
  submittedBy: number;
  submittedAt: string;
  returnedAt: string | null;
  rubricVersionId: number;
  rubric: RubricVersion;
  materials: SubmittedMaterial[];
}
