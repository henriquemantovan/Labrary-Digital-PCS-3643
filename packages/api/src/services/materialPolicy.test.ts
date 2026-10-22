import { describe, expect, it } from "vitest";
import { Project } from "../models/project.js";
import {
  assertFileAccepted,
  createDefaultMaterialPolicy,
  defaultMaterialRules,
  ruleFor,
  uploadLock,
} from "./materialPolicy.js";

const project: Project = {
  id: 2,
  classId: 1,
  groupId: 2,
  title: "Projeto",
  description: "",
  category: "Teste",
  status: "PREPARACAO",
  dueAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const policy = createDefaultMaterialPolicy();
const pdf = {
  originalFilename: "relatorio.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10,
};

describe("política de materiais", () => {
  it("define regras padrão para os quatro tipos", () => {
    expect(policy.rulesFor(project).map((rule) => rule.kind)).toEqual([
      "VIDEO",
      "RELATORIO",
      "MANUAL",
      "OUTRO",
    ]);
    expect(
      defaultMaterialRules
        .filter((rule) => rule.required)
        .map((rule) => rule.kind),
    ).toEqual(["VIDEO", "RELATORIO", "MANUAL"]);
  });
  it("aceita formato, extensão e tamanho compatíveis com o tipo", () => {
    const report = ruleFor(policy, project, "RELATORIO");
    expect(assertFileAccepted(report, pdf).label).toBe("PDF");
    expect(
      assertFileAccepted(report, {
        ...pdf,
        originalFilename: "FINAL.PDF",
        mimeType: "APPLICATION/PDF",
      }).label,
    ).toBe("PDF");
    const video = ruleFor(policy, project, "VIDEO");
    expect(
      assertFileAccepted(video, {
        originalFilename: "demo.webm",
        mimeType: "video/webm",
        sizeBytes: video.maxSizeBytes,
      }).label,
    ).toBe("WebM");
    const other = ruleFor(policy, project, "OUTRO");
    expect(
      assertFileAccepted(other, {
        originalFilename: "foto.jpeg",
        mimeType: "image/jpeg",
        sizeBytes: 1,
      }).label,
    ).toBe("JPEG");
  });
  it.each([
    [{ ...pdf, sizeBytes: 0 }, 400, "EMPTY_FILE"],
    [{ ...pdf, sizeBytes: 20 * 1024 * 1024 + 1 }, 413, "FILE_TOO_LARGE"],
    [{ ...pdf, mimeType: "video/mp4" }, 415, "UNSUPPORTED_FORMAT"],
    [{ ...pdf, originalFilename: "relatorio.docx" }, 415, "UNSUPPORTED_FORMAT"],
    [{ ...pdf, originalFilename: "relatorio" }, 415, "UNSUPPORTED_FORMAT"],
    [
      { ...pdf, originalFilename: "relatorio.pdf.exe" },
      415,
      "UNSUPPORTED_FORMAT",
    ],
  ])("rejeita %o com %i", (file, status, code) => {
    expect(() =>
      assertFileAccepted(ruleFor(policy, project, "RELATORIO"), file),
    ).toThrow(expect.objectContaining({ status, code }));
  });
  it("informa os formatos aceitos na mensagem de erro", () => {
    expect(() =>
      assertFileAccepted(ruleFor(policy, project, "VIDEO"), pdf),
    ).toThrow("Formato não aceito. Envie MP4, WebM.");
  });
  it("recusa tipo sem regra no projeto", () => {
    const onlyReport = createDefaultMaterialPolicy(
      defaultMaterialRules.filter((rule) => rule.kind === "RELATORIO"),
    );
    expect(() => ruleFor(onlyReport, project, "VIDEO")).toThrow(
      expect.objectContaining({
        status: 422,
        code: "MATERIAL_KIND_NOT_ACCEPTED",
      }),
    );
  });
  it("abre a entrega em Preparação antes do prazo e em Ajustes", () => {
    const due = Date.parse("2026-10-28T23:59:00.000Z");
    const withDue = { ...project, dueAt: "2026-10-28T23:59:00.000Z" };
    expect(uploadLock(project, due)).toBeNull();
    expect(uploadLock(withDue, due - 1)).toBeNull();
    expect(uploadLock(withDue, due)).toBe("DEADLINE_PASSED");
    expect(uploadLock({ ...withDue, status: "AJUSTES" }, due + 1)).toBeNull();
    for (const status of ["EM_AVALIACAO", "FINALIZADO"] as const)
      expect(uploadLock({ ...project, status }, 0)).toBe("PROJECT_LOCKED");
  });
});
