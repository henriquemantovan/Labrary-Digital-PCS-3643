import { Submission } from "../models/submission.js";
import { createMemoryProjectRepository } from "../repositories/projectRepository.js";
import { prepareSubmission } from "../services/submissionRules.js";
import { evaluationContractExamples } from "./evaluationContractExamples.js";

/** Exemplos C1 de teste: materiais com IDs do repositório e a rubrica dos exemplos C2. */
export function submissionContractExamples(): Record<"submitted" | "returned" | "resubmitted", Submission> {
  const repository = createMemoryProjectRepository();
  const project = { ...repository.get(1)!, status: "PREPARACAO" as const };
  const rubric = evaluationContractExamples().pending.rubric;
  const file = (originalFilename: string, mimeType: string) =>
    ({ originalFilename, mimeType, sizeBytes: 1024, storageKey: `${originalFilename}.bin`, checksumSha256: null, uploadedBy: 4 });
  repository.createMaterial(project.id, { kind: "VIDEO", title: "Vídeo", createdBy: 4 }, file("video.mp4", "video/mp4"));
  repository.createMaterial(project.id, { kind: "RELATORIO", title: "Relatório", createdBy: 4 }, file("relatorio.pdf", "application/pdf"));
  const manual = repository.createMaterial(project.id, { kind: "MANUAL", title: "Manual", createdBy: 4 }, file("manual.pdf", "application/pdf"));

  const base = { project, rubric, previous: [] as Submission[], submittedBy: 4, now: Date.parse("2026-11-20T12:00:00.000Z") };
  const submitted: Submission = {
    id: 11,
    ...prepareSubmission({ ...base, materials: repository.listMaterials(project.id),
      clientSubmissionId: "7f1c2b8e-4a5d-4e6f-8a9b-0c1d2e3f4a5b" }).submission,
  };
  const returned: Submission = { ...structuredClone(submitted), status: "DEVOLVIDA", returnedAt: "2026-11-21T12:00:00.000Z" };
  repository.addVersion(project.id, manual.id, file("manual-v2.pdf", "application/pdf"));
  const resubmitted: Submission = {
    id: 12,
    ...prepareSubmission({ ...base, project: { ...project, status: "AJUSTES" }, previous: [returned],
      materials: repository.listMaterials(project.id), now: Date.parse("2026-11-27T12:00:00.000Z"),
      clientSubmissionId: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d" }).submission,
  };
  return { submitted, returned, resubmitted };
}
