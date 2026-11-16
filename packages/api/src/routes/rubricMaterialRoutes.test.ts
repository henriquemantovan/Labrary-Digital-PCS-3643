import { describe, expect, it } from "vitest";
import { defaultRequirements } from "../models/rubric.js";
import { createMemoryRubricRepository } from "../repositories/rubricRepository.js";
import { context, pdfFile, sampleFiles, storedMaterial, upload } from "../test/context.js";

const now = () => Date.parse("2026-11-08T12:00:00Z");
const materials = "/api/projects/2/materials";
const configuration = () => ({
  projectId: 2, classId: 1, title: "Rubrica", createdBy: 3, createdAt: new Date(now()).toISOString(),
  requirements: defaultRequirements("2026-11-25T23:00:00Z"),
  criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0 as const, maxScore: 10 as const }],
});

describe("Upload consome C0 real", () => {
  it("usa título, formatos, tamanho e prazo configurados e acompanha novas versões", async () => {
    const rubrics = createMemoryRubricRepository();
    const value = configuration();
    value.requirements[0].allowedMimeTypes = ["video/mp4"];
    value.requirements[1].label = "Relatório da bancada";
    value.requirements[1].maxSizeBytes = 30;
    rubrics.create(value, 0);
    const { client } = context({ rubrics, now });
    const student = client(1);
    const rules = (await student.get("/api/projects/2/material-rules")).body.data.rules;
    expect(rules[0]).toMatchObject({ formats: [{ mimeType: "video/mp4" }], dueAt: value.requirements[0].dueAt, canUpload: true, lock: null });
    expect((await upload(student, materials, { kind: "VIDEO" }, { content: sampleFiles.webm, filename: "video.webm" })).status).toBe(415);
    expect((await upload(student, materials, { kind: "RELATORIO" }, pdfFile())).status).toBe(413);
    value.requirements[1].maxSizeBytes = 200;
    rubrics.create(value, 1);
    const accepted = await upload(student, materials, { kind: "RELATORIO" }, pdfFile());
    expect(accepted.status).toBe(201);
    expect(accepted.body.data.title).toBe("Relatório da bancada");
    expect((await upload(student, materials, { kind: "OUTRO" }, { content: sampleFiles.zip, filename: "anexo.zip" })).status).toBe(201);
  });

  it("bloqueia criação e substituição no prazo de cada material e respeita reabertura", async () => {
    const rubrics = createMemoryRubricRepository();
    const value = configuration();
    value.requirements[1].dueAt = new Date(now()).toISOString();
    rubrics.create(value, 0);
    const { client, repository } = context({ rubrics, now });
    const student = client(1);
    const existing = storedMaterial(repository, 2);
    const rules = (await student.get("/api/projects/2/material-rules")).body.data;
    expect(rules.canUpload).toBe(true);
    expect(rules.rules.find((rule: { kind: string }) => rule.kind === "RELATORIO")).toMatchObject({ canUpload: false, lock: "DEADLINE_PASSED" });
    const first = await upload(student, materials, { kind: "RELATORIO" }, pdfFile());
    expect(first.status).toBe(409);
    expect(first.body.error.code).toBe("DEADLINE_PASSED");
    expect((await upload(student, `${materials}/${existing.id}/versions`, {}, pdfFile())).status).toBe(409);
    expect((await upload(student, materials, { kind: "MANUAL" }, pdfFile("manual.pdf"))).status).toBe(201);
    repository.get(2)!.status = "AJUSTES";
    expect((await upload(student, `${materials}/${existing.id}/versions`, {}, pdfFile())).status).toBe(201);
    const reopened = (await student.get("/api/projects/2/material-rules")).body.data.rules;
    expect(reopened.find((rule: { kind: string }) => rule.kind === "RELATORIO")).toMatchObject({ canUpload: true, lock: null });
    repository.get(2)!.status = "EM_AVALIACAO";
    expect((await upload(student, materials, { kind: "MANUAL" }, pdfFile())).status).toBe(409);
    expect((await student.get("/api/projects/2/material-rules")).body.data.rules.every((rule: { canUpload: boolean }) => !rule.canUpload)).toBe(true);
  });
});
