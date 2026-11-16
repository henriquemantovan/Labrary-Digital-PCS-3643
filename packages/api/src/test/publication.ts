import { Readable } from "node:stream";
import { context, sampleFiles } from "./context.js";
import { AppOptions } from "../app.js";
import { evaluationContractExamples } from "./evaluationContractExamples.js";
import { prepareSubmission } from "../services/submissionRules.js";
import { Submission } from "../models/submission.js";
import {
  PublicationCompleteness,
  PublicationProviders,
} from "../services/publicationProviders.js";
/** Provedores apenas para testes; bytes e metadados passam pelo armazenamento real. */
export async function publicationContext(options: AppOptions = {}) {
  const base = context(options),
    project = base.repository.get(1)!;
  for (const [kind, filename, mime, bytes] of [
    ["VIDEO", "video.mp4", "video/mp4", sampleFiles.mp4],
    ["RELATORIO", "relatorio.pdf", "application/pdf", sampleFiles.pdf],
    ["MANUAL", "manual.pdf", "application/pdf", sampleFiles.pdf],
  ] as const) {
    const stored = await base.storage.save(Readable.from(bytes), {
      maxBytes: 10000,
    });
    base.repository.createMaterial(
      1,
      { kind, title: kind, createdBy: 1 },
      {
        originalFilename: filename,
        mimeType: mime,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        uploadedBy: 1,
      },
    );
  }
  const rubric = evaluationContractExamples().pending.rubric;
  const submission: Submission = {
    id: 11,
    ...prepareSubmission({
      project: { ...project, status: "PREPARACAO" },
      rubric,
      materials: base.repository.listMaterials(1),
      previous: [],
      clientSubmissionId: "7f1c2b8e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
      submittedBy: 1,
      now: Date.parse("2026-11-20T12:00:00Z"),
    }).submission,
  };
  const data: {
    submission: Submission | undefined;
    evaluations: PublicationCompleteness | undefined;
  } = {
    submission,
    evaluations: {
      projectId: 1,
      submissionId: 11,
      round: 1,
      rubricVersionId: rubric.id,
      expectedEvaluatorIds: [2],
      completedEvaluatorIds: [2],
      allEvaluationsCompleted: true,
      resultReleased: false,
    },
  };
  const providers: PublicationProviders = {
    submissions: { latest: async () => structuredClone(data.submission) },
    evaluations: {
      completeness: async () => structuredClone(data.evaluations),
    },
  };
  return {
    ...context({
      ...options,
      auth: base.auth,
      repository: base.repository,
      storage: base.storage,
      publicationProviders: providers,
    }),
    providers,
    data,
    submission,
  };
}
export const publicationInput = {
  submissionId: 11,
  materialVersionIds: [1, 2],
  groupAuthorization: {
    confirmed: true,
    reference: "Autorização do grupo registrada em ata.",
  },
};
