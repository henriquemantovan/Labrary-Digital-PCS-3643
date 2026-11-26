import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoDirectory } from "../fixtures/demo.js";
import { defaultRequirements } from "../models/rubric.js";
import { submissionSchema } from "../models/submission.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createEvaluationRepository } from "../repositories/evaluationRepository.js";
import { createFileGroupStorage } from "../repositories/fileGroupStorage.js";
import { createFileProjectStorage } from "../repositories/fileProjectStorage.js";
import { createFileRubricStorage } from "../repositories/fileRubricStorage.js";
import { createMemoryGroupRepository } from "../repositories/groupRepository.js";
import { createMemoryProjectRepository } from "../repositories/projectRepository.js";
import { createResultReleaseRepository } from "../repositories/resultReleaseRepository.js";
import { createMemoryRubricRepository } from "../repositories/rubricRepository.js";
import { createDiskStorage } from "../services/fileStorage.js";
import { context, pdfFile, sampleFiles, upload } from "../test/context.js";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function dataDirectory() {
  const dir = mkdtempSync(join(tmpdir(), "labrary-evaluations-"));
  directories.push(dir);
  return dir;
}

const project = "/api/projects/2";
const grades = "/api/classes/1/grades";
const now = Date.parse("2026-11-19T14:00:00Z");
const dueAt = "2026-11-25T23:00:00.000Z";
const instant = new Date(now).toISOString();
const criterion = (id: string, title: string, weight: number) => ({
  id, title, weight, description: "", minScore: 0, maxScore: 10,
});
const criteria = [
  criterion("funcionamento", "Funcionamento", 65),
  criterion("documentacao", "Documentação", 35),
];
const scores = [
  { criterionId: "funcionamento", score: 8.25, comment: "Boa demonstração." },
  { criterionId: "documentacao", score: 0, comment: "Faltam referências." },
];
const evaluationsAt = (submissionId: number) => `${project}/submissions/${submissionId}/evaluations`;
const demo = await createDemoDirectory();

function appFrom(dir: string) {
  const directory = structuredClone(demo);
  const evaluator = directory.users.find((user) => user.id === 2)!;
  const teacher = directory.users.find((user) => user.id === 3)!;
  directory.users.push(
    { ...evaluator, id: 4, fullName: "Outro avaliador", email: "segundo@labrary.local" },
    { ...teacher, id: 5, fullName: "Docente de outra turma", email: "outro-professor@labrary.local" },
  );
  const ctx = context({
    auth: createAuthRepository(directory),
    groups: createMemoryGroupRepository(directory, createFileGroupStorage(join(dir, "groups.json"))),
    repository: createMemoryProjectRepository(true, createFileProjectStorage(join(dir, "projects.json"))),
    rubrics: createMemoryRubricRepository(createFileRubricStorage(join(dir, "rubrics.json"))),
    evaluationRepository: createEvaluationRepository(join(dir, "evaluations.json")),
    resultReleases: createResultReleaseRepository(join(dir, "results.json")),
    storage: createDiskStorage(join(dir, "uploads")),
    now: () => now,
  });
  const professor = ctx.client(3);
  return {
    ...ctx,
    student: ctx.client(1),
    evaluator: ctx.client(2),
    teacher: professor,
    otherEvaluator: ctx.client(4),
    outsideTeacher: ctx.client(5),
    assign(...evaluatorIds: number[]) {
      return professor.put(`${project}/evaluators`).send({ evaluatorIds });
    },
  };
}

type App = ReturnType<typeof appFrom>;
const submit = (app: App) =>
  app.student.post(`${project}/submissions`).send({ clientSubmissionId: randomUUID() });
const configure = (app: App, baseVersionId = 0, rubricCriteria = criteria) =>
  app.teacher.post(`${project}/configuration/versions`).send({
    title: baseVersionId ? "Novos critérios de avaliação" : "Critérios de avaliação originais",
    requirements: defaultRequirements(dueAt),
    criteria: rubricCriteria,
    baseVersionId,
  });

async function firstSubmission(app: App) {
  expect((await configure(app)).status).toBe(201);
  const materials = `${project}/materials`;
  const uploads = [
    await upload(app.student, materials, { kind: "VIDEO" }, { content: sampleFiles.mp4, filename: "video.mp4" }),
    await upload(app.student, materials, { kind: "RELATORIO" }, pdfFile()),
    await upload(app.student, materials, { kind: "MANUAL" }, pdfFile("manual.pdf")),
  ];
  for (const response of uploads) expect(response.status).toBe(201);
  const response = await submit(app);
  expect(response.status).toBe(201);
  return submissionSchema.parse(response.body.data);
}

async function release(app: App) {
  const response = await app.teacher.get(`${project}/results/consolidation`);
  expect(response.status).toBe(200);
  const { result, fingerprint } = response.body.data;
  return app.teacher.post(`${project}/results/release`).send({ submissionId: result.submissionId, fingerprint });
}

describe("HU08: avaliação sobre submissão real", () => {
  it("isola os avaliadores e valida a escala, a completude e conflitos de revisão", async () => {
    const app = appFrom(dataDirectory());
    expect((await app.assign(2, 4)).status).toBe(200);
    const submission = await firstSubmission(app);
    const path = evaluationsAt(submission.id);
    const draft = { expectedRevision: 0, scores: [scores[0]] };

    expect((await request(app.app).get(path)).status).toBe(401);
    expect((await app.student.get(path)).status).toBe(403);
    expect((await app.outsideTeacher.get(path)).status).toBe(404);
    expect((await app.teacher.get(evaluationsAt(999))).status).toBe(404);
    expect((await app.evaluator.put(`${path}/me`).unset("X-CSRF-Protection").send(draft)).status).toBe(403);
    expect((await app.teacher.put(`${path}/me`).send(draft)).status).toBe(403);

    const saved = await app.evaluator.put(`${path}/me`).send(draft);
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({
      evaluatorId: 2, status: "RASCUNHO", revision: 1, scores: [scores[0]],
      history: [{ action: "RASCUNHO", actorId: 2, at: instant, revision: 1 }],
    });

    const other = (await app.otherEvaluator.get(path)).body.data;
    expect(other.evaluations).toEqual([
      { evaluatorId: 4, status: "PENDENTE", revision: 0, scores: [], finalizedAt: null, history: [] },
    ]);
    expect(other).not.toHaveProperty("evaluatorNames");
    expect(other.submission).toEqual(submission);
    expect((await app.teacher.get(path)).body.data.evaluations.map(({ evaluatorId }: { evaluatorId: number }) => evaluatorId))
      .toEqual([2, 4]);
    expect((await app.otherEvaluator.post(`${path}/2/reopen`).send({ expectedRevision: 1, reason: "Rever." })).status).toBe(403);

    const invalidScore = await app.evaluator.put(`${path}/me`).send({
      expectedRevision: 1, scores: [{ ...scores[0], score: 11 }],
    });
    expect(invalidScore.status).toBe(400);
    const incomplete = await app.evaluator.post(`${path}/me/finalize`).send({ ...draft, expectedRevision: 1 });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error.code).toBe("INCOMPLETE_EVALUATION");
    expect((await app.evaluator.put(`${path}/me`).send(draft)).status).toBe(409);

    const finalized = await app.evaluator.post(`${path}/me/finalize`).send({ expectedRevision: 1, scores });
    expect(finalized.status).toBe(200);
    expect(finalized.body.data).toMatchObject({ status: "FINALIZADA", revision: 2, finalizedAt: instant, scores });
    expect((await app.evaluator.put(`${path}/me`).send({ ...draft, expectedRevision: 2 })).status).toBe(409);
    const row = (await app.teacher.get(grades)).body.data.find(({ projectId }: { projectId: number }) => projectId === 2);
    expect(row).toMatchObject({ status: "PARTIAL", receivedEvaluatorIds: [2], pendingEvaluatorIds: [4] });
    expect(row.grade).toBeCloseTo(5.3625);
  });

  it("restaura notas e liberações, revoga a liberação após reabrir e preserva rodadas antigas", async () => {
    const dir = dataDirectory();
    let app = appFrom(dir);
    expect((await app.assign(2)).status).toBe(200);
    const first = await firstSubmission(app);
    const path = evaluationsAt(first.id);
    const finalPath = `${path}/me/finalize`;
    expect((await app.evaluator.post(finalPath).send({ expectedRevision: 0, scores })).status).toBe(200);
    expect((await app.student.get(`${project}/result`)).body.data).toEqual({ projectId: 2, resultReleased: false });
    expect((await release(app)).status).toBe(200);
    expect(statSync(join(dir, "evaluations.json")).mode & 0o777).toBe(0o600);

    const restoredDir = dataDirectory();
    cpSync(dir, restoredDir, { recursive: true });
    rmSync(dir, { recursive: true, force: true });
    app = appFrom(restoredDir);
    expect((await app.evaluator.get(path)).body.data).toMatchObject({
      submission: first, evaluations: [{ scores, status: "FINALIZADA", revision: 1 }],
    });
    expect((await app.student.get(`${project}/result`)).body.data).toMatchObject({
      resultReleased: true, evaluations: [{ evaluatorId: 2, scores }],
    });
    const csv = await app.teacher.get(`${grades}?format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain('"1","1","0","5.36","Final","Sim"');

    const reopen = `${path}/2/reopen`;
    expect((await app.teacher.post(reopen).send({ expectedRevision: 1, reason: "  " })).status).toBe(400);
    const reopened = await app.teacher.post(reopen).send({ expectedRevision: 1, reason: "Rever referências." });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data).toMatchObject({
      status: "REABERTA", revision: 2, finalizedAt: null, scores,
      history: [
        { action: "FINALIZADA", actorId: 2, revision: 1, scores },
        { action: "REABERTA", actorId: 3, at: instant, reason: "Rever referências.", revision: 2, scores },
      ],
    });
    expect((await app.student.get(`${project}/result`)).body.data).toEqual({ projectId: 2, resultReleased: false });
    expect((await release(app)).status).toBe(409);
    expect((await app.evaluator.post(finalPath).send({ expectedRevision: 2, scores })).status).toBe(200);
    expect((await app.student.get(`${project}/result`)).body.data.resultReleased).toBe(false);
    expect((await release(app)).status).toBe(200);

    expect((await configure(app, first.rubricVersionId, [criterion("novo", "Novo critério", 100)])).status).toBe(201);
    expect((await app.evaluator.get(path)).body.data.submission.rubric).toEqual(first.rubric);
    expect((await app.teacher.post(`${project}/submissions/${first.id}/return`)).status).toBe(200);
    expect((await app.student.get(`${project}/result`)).body.data.resultReleased).toBe(false);
    expect((await app.teacher.post(reopen).send({ expectedRevision: 3, reason: "Rever." })).status).toBe(409);

    const resubmitted = await submit(app);
    expect(resubmitted.status).toBe(201);
    const second = submissionSchema.parse(resubmitted.body.data);
    expect(second).toMatchObject({ round: 2, rubric: { versionNumber: 2, title: "Novos critérios de avaliação" } });
    expect((await app.evaluator.get(evaluationsAt(second.id))).body.data).toMatchObject({
      canEdit: true, evaluations: [{ status: "PENDENTE", revision: 0 }],
    });
    expect((await app.evaluator.get(path)).body.data).toMatchObject({
      canEdit: false, submission: { round: 1, rubric: first.rubric },
      evaluations: [{ status: "FINALIZADA", revision: 3, scores, history: reopened.body.data.history.concat(
        [{ action: "FINALIZADA", actorId: 2, at: instant, reason: null, revision: 3, scores }],
      ) }],
    });
  });

  it("mantém a rodada sem avaliadores previstos pendente e revoga acesso ao remover o vínculo", async () => {
    const app = appFrom(dataDirectory());
    const submission = await firstSubmission(app);
    const path = evaluationsAt(submission.id);
    expect((await app.teacher.get(path)).body.data.evaluations).toEqual([]);
    const consolidated = await app.teacher.get(`${project}/results/consolidation`);
    expect(consolidated.body.data.result).toMatchObject({
      status: "PENDING", submissionId: submission.id, expectedEvaluatorIds: [], allEvaluationsCompleted: false,
    });
    expect((await app.assign(2)).status).toBe(200);
    expect((await app.evaluator.post(`${path}/me/finalize`).send({ expectedRevision: 0, scores })).status).toBe(200);
    expect((await app.assign()).status).toBe(200);
    expect((await app.evaluator.get(path)).status).toBe(404);
    expect((await app.teacher.get(path)).body.data.evaluations).toMatchObject([{ evaluatorId: 2, status: "FINALIZADA" }]);
    expect((await app.teacher.get(`${project}/results/consolidation`)).body.data.result).toMatchObject({
      expectedEvaluatorIds: [], receivedEvaluatorIds: [], allEvaluationsCompleted: false,
    });
  });

  it("não anuncia uma avaliação persistida quando o armazenamento falha", async () => {
    const dir = dataDirectory();
    const app = appFrom(dir);
    expect((await app.assign(2)).status).toBe(200);
    const submission = await firstSubmission(app);
    const path = evaluationsAt(submission.id);
    mkdirSync(join(dir, "evaluations.json"));
    const failed = await app.evaluator.put(`${path}/me`).send({ expectedRevision: 0, scores });
    expect(failed.status).toBe(500);
    expect((await app.evaluator.get(path)).body.data.evaluations).toMatchObject([
      { status: "PENDENTE", revision: 0, scores: [] },
    ]);
    rmSync(join(dir, "evaluations.json"), { recursive: true });
    expect((await app.evaluator.put(`${path}/me`).send({ expectedRevision: 0, scores })).status).toBe(200);
  });
});
