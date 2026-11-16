// Servidor exclusivo do Playwright: C1/C3 de teste, API e bytes reais. Nunca importado pelo entrypoint de produção.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createApp } from "../src/app.js";
import { createDemoDirectory } from "../src/fixtures/demo.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import { createMemoryProjectRepository } from "../src/repositories/projectRepository.js";
import { createFileProjectStorage } from "../src/repositories/fileProjectStorage.js";
import { createDiskStorage } from "../src/services/fileStorage.js";
import { evaluationContractExamples } from "../src/test/evaluationContractExamples.js";
import { prepareSubmission } from "../src/services/submissionRules.js";
import { Submission } from "../src/models/submission.js";
const root = mkdtempSync(join(tmpdir(), "labrary-publication-e2e-"));
const port = Number(process.env.PUBLICATION_FIXTURE_PORT),
  origin = process.env.APP_ORIGIN!;
const repository = createMemoryProjectRepository(
  true,
  createFileProjectStorage(join(root, "projects.json")),
);
const storage = createDiskStorage(join(root, "uploads")),
  auth = createAuthRepository(await createDemoDirectory());
const video = readFileSync(
  new URL("../../../e2e/fixtures/demonstracao.webm", import.meta.url),
);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n");
for (const [kind, title, filename, mimeType, bytes] of [
  ["VIDEO", "Vídeo de apresentação", "demonstracao.webm", "video/webm", video],
  [
    "RELATORIO",
    "Relatório do projeto",
    "relatorio.pdf",
    "application/pdf",
    pdf,
  ],
  ["MANUAL", "Manual de uso", "manual.pdf", "application/pdf", pdf],
] as const) {
  const saved = await storage.save(Readable.from(bytes), { maxBytes: 100000 });
  repository.createMaterial(
    1,
    { kind, title, createdBy: 1 },
    {
      originalFilename: filename,
      mimeType,
      sizeBytes: saved.sizeBytes,
      storageKey: saved.storageKey,
      checksumSha256: saved.checksumSha256,
      uploadedBy: 1,
    },
  );
}
const rubric = evaluationContractExamples().pending.rubric;
const submission: Submission = {
  id: 11,
  ...prepareSubmission({
    project: { ...repository.get(1)!, status: "PREPARACAO" },
    rubric,
    materials: repository.listMaterials(1),
    previous: [],
    clientSubmissionId: "7f1c2b8e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
    submittedBy: 1,
    now: Date.parse("2026-11-20T12:00:00Z"),
  }).submission,
};
const server = createApp({
  auth,
  repository,
  storage,
  origin,
  publicationProviders: {
    submissions: {
      latest: async (id) =>
        id === 1 ? structuredClone(submission) : undefined,
    },
    evaluations: {
      completeness: async () => ({
        projectId: 1,
        submissionId: 11,
        round: 1,
        rubricVersionId: rubric.id,
        expectedEvaluatorIds: [2],
        completedEvaluatorIds: [2],
        allEvaluationsCompleted: true,
        resultReleased: false,
      }),
    },
  },
}).listen(port, () => console.log(`Fixture de publicação em ${port}`));
process.once("SIGTERM", () => {
  server.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(0);
});
