import { describe, expect, it } from "vitest";
import { Project, ProjectMaterial } from "../models/project.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";
import { submissionContractExamples } from "../test/submissionContractExamples.js";
import { prepareSubmission, submissionChecklist, SubmissionInput } from "./submissionRules.js";

const rubric = evaluationContractExamples().pending.rubric;
const project: Project = {
  id: 1, classId: 1, groupId: 1, title: "Projeto", description: "", category: "Sistemas",
  status: "PREPARACAO", dueAt: null, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
};
const material = (id: number, kind: ProjectMaterial["kind"], mimeType: string, sizeBytes = 1024): ProjectMaterial => ({
  id, projectId: 1, kind, title: kind, createdBy: 4, createdAt: "2026-11-02T00:00:00.000Z",
  versions: [{ id: id * 10, materialId: id, versionNumber: 1, originalFilename: "arquivo", mimeType, sizeBytes,
    storageKey: "chave", checksumSha256: null, uploadedBy: 4, uploadedAt: "2026-11-02T00:00:00.000Z" }],
});
const complete = [
  material(1, "VIDEO", "video/mp4"),
  material(2, "RELATORIO", "application/pdf"),
  material(3, "MANUAL", "application/pdf"),
  material(4, "OUTRO", "application/zip"),
];
const input = (change: Partial<SubmissionInput> = {}): SubmissionInput => ({
  project, rubric, materials: complete, previous: [], clientSubmissionId: "3b241101-e2bb-4255-8caf-4136c566a962",
  submittedBy: 4, now: Date.parse("2026-11-20T12:00:00.000Z"), ...change,
});
const error = (change: Partial<SubmissionInput>) => {
  try {
    prepareSubmission(input(change));
  } catch (caught) {
    return caught;
  }
};

describe("S5: checklist de submissão", () => {
  it("indica obrigatórios presentes, ausentes e incompatíveis com a rubrica", () => {
    const checklist = submissionChecklist(rubric.requirements, [
      material(1, "VIDEO", "video/mp4"),
      material(2, "RELATORIO", "video/mp4"),
      material(3, "MANUAL", "application/pdf", rubric.requirements[2].maxSizeBytes + 1),
    ]);
    expect(checklist.map(({ kind, ok, versionId }) => ({ kind, ok, versionId }))).toEqual([
      { kind: "VIDEO", ok: true, versionId: 10 },
      { kind: "RELATORIO", ok: false, versionId: 20 },
      { kind: "MANUAL", ok: false, versionId: 30 },
    ]);
    expect(submissionChecklist(rubric.requirements, [])[0]).toMatchObject({ materialId: null, versionId: null, ok: false });
  });
});

describe("S5: regras de submissão", () => {
  it("monta snapshot da primeira rodada com versões atuais e cópia da rubrica", () => {
    const result = prepareSubmission(input());
    expect(result.repeated).toBe(false);
    expect(result.submission).toMatchObject({
      projectId: 1, round: 1, status: "SUBMETIDA", submittedAt: "2026-11-20T12:00:00.000Z",
      returnedAt: null, rubricVersionId: rubric.id,
    });
    expect(result.submission.materials.map((item) => item.versionId)).toEqual([10, 20, 30, 40]);
    expect(result.submission.rubric).toEqual(rubric);
    expect(result.submission.rubric).not.toBe(rubric);
  });
  it("bloqueia sem rubrica, fora de Preparação/Ajustes, após prazo ou incompleta", () => {
    expect(error({ rubric: null })).toMatchObject({ status: 409, code: "RUBRIC_NOT_CONFIGURED" });
    for (const status of ["EM_AVALIACAO", "FINALIZADO"] as const)
      expect(error({ project: { ...project, status } })).toMatchObject({ code: "SUBMISSION_LOCKED" });
    expect(error({ project: { ...project, dueAt: "2026-11-19T00:00:00.000Z" } })).toMatchObject({ code: "DEADLINE_PASSED" });
    expect(error({ now: Date.parse(rubric.requirements[0].dueAt) })).toMatchObject({ code: "DEADLINE_PASSED" });
    expect(error({ materials: complete.slice(1) })).toMatchObject({
      code: "INCOMPLETE_SUBMISSION", message: "Materiais obrigatórios pendentes: Vídeo de apresentação.",
    });
  });
  it("em Ajustes dispensa os prazos e cria a rodada seguinte", () => {
    const { returned } = submissionContractExamples();
    const result = prepareSubmission(input({
      project: { ...project, status: "AJUSTES", dueAt: "2026-11-19T00:00:00.000Z" },
      previous: [returned], now: Date.parse("2026-12-01T00:00:00.000Z"),
    }));
    expect(result.submission.round).toBe(2);
  });
  it("repetir o mesmo envio devolve a rodada existente mesmo com o projeto bloqueado", () => {
    const { submitted } = submissionContractExamples();
    const result = prepareSubmission(input({
      project: { ...project, status: "EM_AVALIACAO" }, previous: [submitted],
      clientSubmissionId: submitted.clientSubmissionId,
    }));
    expect(result).toEqual({ repeated: true, submission: submitted });
    expect(error({ project: { ...project, status: "EM_AVALIACAO" }, previous: [submitted] }))
      .toMatchObject({ code: "SUBMISSION_LOCKED" });
  });
});
