import { ApiError } from "../errors.js";
import { Project, ProjectMaterial } from "../models/project.js";
import { Requirement, RubricVersion } from "../models/rubric.js";
import { NewSubmission, Submission } from "../models/submission.js";
import { uploadLock } from "./materialPolicy.js";

export interface ChecklistItem {
  kind: Requirement["kind"];
  label: string;
  materialId: number | null;
  versionId: number | null;
  /** Versão mais recente presente e compatível com formato e tamanho exigidos. */
  ok: boolean;
}

export function submissionChecklist(requirements: Requirement[], materials: ProjectMaterial[]): ChecklistItem[] {
  return requirements.map((requirement) => {
    const material = materials.find((item) => item.kind === requirement.kind);
    const version = material?.versions[0];
    return {
      kind: requirement.kind,
      label: requirement.label,
      materialId: material?.id ?? null,
      versionId: version?.id ?? null,
      ok: !!version && requirement.allowedMimeTypes.includes(version.mimeType) &&
        version.sizeBytes <= requirement.maxSizeBytes,
    };
  });
}

export interface SubmissionInput {
  project: Project;
  rubric: RubricVersion | null;
  materials: ProjectMaterial[];
  previous: Submission[];
  clientSubmissionId: string;
  submittedBy: number;
  now: number;
}

export type PreparedSubmission =
  | { repeated: true; submission: Submission }
  | { repeated: false; submission: NewSubmission };

/** Valida a submissão e monta o snapshot C1; repetir o mesmo `clientSubmissionId` devolve a rodada existente. */
export function prepareSubmission(input: SubmissionInput): PreparedSubmission {
  const { project, rubric, materials, previous, now } = input;
  const existing = previous.find((item) => item.clientSubmissionId === input.clientSubmissionId);
  if (existing) return { repeated: true, submission: existing };

  if (!rubric)
    throw new ApiError(409, "RUBRIC_NOT_CONFIGURED", "O professor ainda não configurou os requisitos do projeto.");
  const lock = uploadLock(project, now);
  if (lock === "PROJECT_LOCKED")
    throw new ApiError(409, "SUBMISSION_LOCKED", "O projeto não está aberto para submissão.");
  // Em Ajustes, a reabertura pelo professor dispensa os prazos originais.
  if (lock === "DEADLINE_PASSED" || (project.status === "PREPARACAO" &&
    rubric.requirements.some((requirement) => now >= Date.parse(requirement.dueAt))))
    throw new ApiError(409, "DEADLINE_PASSED", "O prazo de entrega terminou.");
  const missing = submissionChecklist(rubric.requirements, materials).filter((item) => !item.ok);
  if (missing.length)
    throw new ApiError(409, "INCOMPLETE_SUBMISSION",
      `Materiais obrigatórios pendentes: ${missing.map((item) => item.label).join(", ")}.`);

  return {
    repeated: false,
    submission: {
      projectId: project.id,
      round: Math.max(0, ...previous.map((item) => item.round)) + 1,
      clientSubmissionId: input.clientSubmissionId,
      status: "SUBMETIDA",
      submittedBy: input.submittedBy,
      submittedAt: new Date(now).toISOString(),
      returnedAt: null,
      rubricVersionId: rubric.id,
      rubric: structuredClone(rubric),
      materials: materials.map(({ id, kind, title, versions: [version] }) => ({
        materialId: id,
        kind,
        title,
        versionId: version.id,
        versionNumber: version.versionNumber,
        originalFilename: version.originalFilename,
        mimeType: version.mimeType,
        sizeBytes: version.sizeBytes,
        checksumSha256: version.checksumSha256,
      })),
    },
  };
}
