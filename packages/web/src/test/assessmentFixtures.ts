import type { RubricVersion } from "../assessmentTypes";

export const rubric: RubricVersion = {
  id: 1, projectId: 1, classId: 1, versionNumber: 1, title: "Projeto digital", createdBy: 3, createdAt: "2026-11-08T12:00:00Z",
  requirements: ["VIDEO", "RELATORIO", "MANUAL"].map((kind, index) => ({
    kind: kind as "VIDEO" | "RELATORIO" | "MANUAL", label: ["Vídeo", "Relatório", "Manual"][index], required: true,
    allowedMimeTypes: kind === "VIDEO" ? ["video/mp4"] : ["application/pdf"], maxSizeBytes: 20 * 1024 * 1024, dueAt: "2026-12-01T12:00:00Z",
  })),
  criteria: [
    { id: "funciona", title: "Funcionamento", description: "Atende aos requisitos", weight: 60, minScore: 0, maxScore: 10 },
    { id: "clareza", title: "Clareza", description: "Explica o circuito", weight: 40, minScore: 0, maxScore: 10 },
  ],
};
