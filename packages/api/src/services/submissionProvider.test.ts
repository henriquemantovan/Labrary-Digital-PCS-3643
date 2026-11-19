import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultRequirements } from "../models/rubric.js";
import { submissionSchema } from "../models/submission.js";
import { createMemoryRubricRepository } from "../repositories/rubricRepository.js";
import { context, pdfFile, sampleFiles, upload } from "../test/context.js";
import { PublicationCompleteness } from "./publicationProviders.js";
import { createSubmissionProvider } from "./submissionProvider.js";

const dueAt = "2026-11-25T23:00:00.000Z";
const beforeDue = Date.parse("2026-11-20T12:00:00Z");
const base = "/api/projects/2";

function setup() {
  const rubrics = createMemoryRubricRepository();
  rubrics.create({
    projectId: 2, classId: 1, title: "Entrega final", createdBy: 3, createdAt: new Date(beforeDue).toISOString(),
    requirements: defaultRequirements(dueAt),
    criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
  }, 0);
  // A completude C3 ainda não tem adapter real (#41); aqui só ela é dublê.
  const completeness: { value?: PublicationCompleteness } = {};
  const ctx = context({
    rubrics,
    now: () => beforeDue,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    publicationProviders: {
      submissions: { latest: (projectId) => provider.latest(projectId) },
      evaluations: { completeness: async () => structuredClone(completeness.value) },
    },
  });
  const provider = createSubmissionProvider(ctx.repository);
  ctx.auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
  return { ...ctx, provider, completeness, student: ctx.client(1), professor: ctx.client(3) };
}
type Setup = ReturnType<typeof setup>;

async function sendAll(student: Setup["student"]) {
  for (const response of [
    await upload(student, `${base}/materials`, { kind: "VIDEO" }, { content: sampleFiles.mp4, filename: "video.mp4" }),
    await upload(student, `${base}/materials`, { kind: "RELATORIO" }, pdfFile()),
    await upload(student, `${base}/materials`, { kind: "MANUAL" }, pdfFile("manual.pdf")),
  ])
    expect(response.status).toBe(201);
}
const submit = (student: Setup["student"]) =>
  student.post(`${base}/submissions`).send({ clientSubmissionId: randomUUID() });

describe("adapter C1 para a HU11 (submissions.latest)", () => {
  it("sem rodadas, ou para projeto inexistente, não devolve submissão", async () => {
    const { provider } = setup();
    expect(await provider.latest(2)).toBeUndefined();
    expect(await provider.latest(999)).toBeUndefined();
  });

  it("devolve a rodada mais recente, válida pelo schema C1, inclusive se devolvida", async () => {
    const { provider, student, professor, repository } = setup();
    await sendAll(student);
    const first = (await submit(student)).body.data;
    expect(await provider.latest(2)).toEqual(first);
    expect(submissionSchema.safeParse(await provider.latest(2)).success).toBe(true);
    // Outro projeto não interfere na resposta.
    expect(await provider.latest(1)).toBeUndefined();

    expect((await professor.post(`${base}/submissions/${first.id}/return`)).status).toBe(200);
    expect(await provider.latest(2)).toMatchObject({ id: first.id, round: 1, status: "DEVOLVIDA" });

    const second = (await submit(student)).body.data;
    expect(second.round).toBe(2);
    expect(await provider.latest(2)).toEqual(second);
    expect(repository.listSubmissions(2)).toHaveLength(2);
  });

  it("devolve cópia: alterar o retorno não muda a rodada persistida", async () => {
    const { provider, student, repository } = setup();
    await sendAll(student);
    const submitted = (await submit(student)).body.data;
    const copy = (await provider.latest(2))!;
    copy.status = "DEVOLVIDA";
    copy.materials.pop();
    expect(repository.getSubmission(2, submitted.id)).toEqual(submitted);
    expect(await provider.latest(2)).toEqual(submitted);
  });

  it("a HU11 finaliza a partir da rodada real e recusa a rodada devolvida", async () => {
    const { student, professor, completeness } = setup();
    await sendAll(student);
    const submitted = (await submit(student)).body.data;
    completeness.value = {
      projectId: 2, submissionId: submitted.id, round: submitted.round, rubricVersionId: submitted.rubricVersionId,
      expectedEvaluatorIds: [2], completedEvaluatorIds: [2], allEvaluationsCompleted: true, resultReleased: false,
    };
    const management = await professor.get(`${base}/publication`);
    expect(management.status).toBe(200);
    expect(management.body.data).toMatchObject({ submissionId: submitted.id, canFinalize: true });

    // Rodada devolvida: o consumidor recebe a mais recente e não autoriza finalizar.
    expect((await professor.post(`${base}/submissions/${submitted.id}/return`)).status).toBe(200);
    const refused = await professor.post(`${base}/finalization`).send({ submissionId: submitted.id });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("PUBLICATION_NOT_READY");

    const next = (await submit(student)).body.data;
    completeness.value = { ...completeness.value, submissionId: next.id, round: next.round };
    const finalized = await professor.post(`${base}/finalization`).send({ submissionId: next.id });
    expect(finalized.status).toBe(200);
    expect(finalized.body.data).toMatchObject({ status: "FINALIZADO", submissionId: next.id });
  });
});
