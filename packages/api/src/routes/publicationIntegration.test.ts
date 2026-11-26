import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDirectory } from "../fixtures/demo.js";
import { publicProjectSchema } from "../models/publication.js";
import { defaultRequirements } from "../models/rubric.js";
import { Submission } from "../models/submission.js";
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

const demo = await createDemoDirectory();
const now = Date.parse("2026-11-22T12:00:00Z");
const base = "/api/projects/2";
const evaluationPath = (id: number) => `${base}/submissions/${id}/evaluations`;
const scores = [
  {
    criterionId: "funcionamento",
    score: 9,
    comment: "Parecer privado da banca.",
  },
];
const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  directories
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});
function dataDirectory() {
  const dir = mkdtempSync(join(tmpdir(), "labrary-publication-real-"));
  directories.push(dir);
  return dir;
}

// Somente contas e arquivos de entrada são demonstrativos. C1, C2, C3, C4,
// vínculos, decisões e bytes usam os mesmos serviços/arquivos do entrypoint.
function appFrom(dir: string) {
  const directory = structuredClone(demo);
  directory.users.push({
    ...directory.users[2],
    id: 4,
    email: "outro@labrary.local",
  });
  const auth = createAuthRepository(directory);
  const app = context({
    auth,
    repository: createMemoryProjectRepository(
      true,
      createFileProjectStorage(join(dir, "projects.json")),
    ),
    groups: createMemoryGroupRepository(
      directory,
      createFileGroupStorage(join(dir, "groups.json")),
    ),
    rubrics: createMemoryRubricRepository(
      createFileRubricStorage(join(dir, "rubrics.json")),
    ),
    evaluationRepository: createEvaluationRepository(
      join(dir, "evaluations.json"),
    ),
    resultReleases: createResultReleaseRepository(join(dir, "results.json")),
    storage: createDiskStorage(join(dir, "uploads")),
    now: () => now,
  });
  return {
    ...app,
    student: app.client(1),
    evaluator: app.client(2),
    teacher: app.client(3),
    outsider: app.client(4),
  };
}
type App = ReturnType<typeof appFrom>;
async function submitted(app: App): Promise<Submission> {
  expect(
    (await app.teacher.put(`${base}/evaluators`).send({ evaluatorIds: [2] }))
      .status,
  ).toBe(200);
  expect(
    (
      await app.teacher.post(`${base}/configuration/versions`).send({
        baseVersionId: 0,
        title: "Critérios de avaliação da aceitação",
        requirements: defaultRequirements("2026-11-25T23:00:00.000Z"),
        criteria: [
          {
            id: "funcionamento",
            title: "Funcionamento",
            description: "",
            weight: 100,
            minScore: 0,
            maxScore: 10,
          },
        ],
      })
    ).status,
  ).toBe(201);
  for (const response of [
    await upload(
      app.student,
      `${base}/materials`,
      { kind: "VIDEO" },
      { content: sampleFiles.webm, filename: "video.webm" },
    ),
    await upload(
      app.student,
      `${base}/materials`,
      { kind: "RELATORIO" },
      pdfFile(),
    ),
    await upload(
      app.student,
      `${base}/materials`,
      { kind: "MANUAL" },
      pdfFile("manual.pdf"),
    ),
  ])
    expect(response.status).toBe(201);
  const response = await app.student
    .post(`${base}/submissions`)
    .send({ clientSubmissionId: randomUUID() });
  expect(response.status).toBe(201);
  return response.body.data;
}
async function evaluated(
  app: App,
  submission: Submission,
  expectedRevision = 0,
) {
  expect(
    (
      await app.evaluator
        .post(`${evaluationPath(submission.id)}/me/finalize`)
        .send({ scores, expectedRevision })
    ).status,
  ).toBe(200);
}
const finalize = (app: App, submission: Submission) =>
  app.teacher
    .post(`${base}/finalization`)
    .send({ submissionId: submission.id });
const publication = (submission: Submission) => ({
  submissionId: submission.id,
  materialVersionIds: submission.materials
    .slice(0, 2)
    .map((material) => material.versionId),
  groupAuthorization: {
    confirmed: true,
    reference: "Autorização demonstrativa registrada pelo grupo.",
  },
});

describe("S7: publicação com submissão, avaliação e consolidação reais", () => {
  it("conecta C1/C2/C3 sem liberar resultado e mantém notas, feedback e manual privados", async () => {
    const app = appFrom(dataDirectory());
    const submission = await submitted(app);
    const blocked = await finalize(app, submission);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("PUBLICATION_NOT_READY");
    await evaluated(app, submission);
    const result = (await app.teacher.get(`${base}/results/consolidation`)).body
      .data.result;
    expect(result).toMatchObject({
      allEvaluationsCompleted: true,
      resultReleased: false,
      finalGrade: 9,
    });
    expect((await app.student.get(`${base}/result`)).body.data).toEqual({
      projectId: 2,
      resultReleased: false,
    });
    expect((await finalize(app, submission)).status).toBe(200);
    expect((await request(app.app).get("/api/catalog/2")).status).toBe(404);
    const input = publication(submission);
    expect(
      (
        await app.teacher
          .post(`${base}/publication`)
          .send({
            ...input,
            groupAuthorization: {
              confirmed: false,
              reference: input.groupAuthorization.reference,
            },
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.teacher
          .post(`${base}/messages`)
          .send({
            clientMessageId: randomUUID(),
            body: "Feedback confidencial do projeto.",
          })
      ).status,
    ).toBe(201);
    expect(
      (await app.teacher.post(`${base}/publication`).send(input)).status,
    ).toBe(200);
    const catalog = await request(app.app).get("/api/catalog/2");
    expect(catalog.status).toBe(200);
    const dto = publicProjectSchema.parse(catalog.body.data);
    expect(dto.materials.map((material) => material.versionId)).toEqual(
      input.materialVersionIds,
    );
    const json = JSON.stringify(dto);
    for (const secret of [
      "Parecer privado",
      "Feedback confidencial",
      "Autorização demonstrativa",
      "storageKey",
      "checksumSha256",
      "scores",
      "rubric",
      "grade",
      "memberIds",
    ])
      expect(json).not.toContain(secret);
    const video = dto.materials[0].contentUrl;
    const range = await request(app.app).get(video).set("Range", "bytes=0-3");
    expect(range.status).toBe(206);
    expect(range.headers["content-range"]).toBe(
      `bytes 0-3/${sampleFiles.webm.length}`,
    );
    expect((await request(app.app).head(video)).status).toBe(200);
    expect(
      (
        await request(app.app).get(
          `/api/catalog/2/materials/${submission.materials[2].versionId}/file`,
        )
      ).status,
    ).toBe(404);
    expect((await request(app.app).get(`${base}/messages`)).status).toBe(401);
  });

  it("conserva C1/C2/C3/C4 no reinício e revoga GET, HEAD e Range após retirada", async () => {
    const dir = dataDirectory();
    let app = appFrom(dir);
    const submission = await submitted(app);
    await evaluated(app, submission);
    const consolidation = (
      await app.teacher.get(`${base}/results/consolidation`)
    ).body.data;
    expect(
      (
        await app.teacher
          .post(`${base}/results/release`)
          .send({
            submissionId: submission.id,
            fingerprint: consolidation.fingerprint,
          })
      ).status,
    ).toBe(200);
    expect((await finalize(app, submission)).status).toBe(200);
    expect(
      (
        await app.teacher
          .post(`${base}/publication`)
          .send(publication(submission))
      ).status,
    ).toBe(200);
    app = appFrom(dir);
    expect(app.repository.getSubmission(2, submission.id)).toEqual(submission);
    expect((await app.student.get(`${base}/result`)).body.data).toMatchObject({
      resultReleased: true,
      finalGrade: 9,
    });
    const dto = (await request(app.app).get("/api/catalog/2")).body.data;
    expect(dto.materials).toHaveLength(2);
    expect((await app.teacher.delete(`${base}/publication`)).status).toBe(204);
    app = appFrom(dir);
    expect((await request(app.app).get("/api/catalog")).body.data).toEqual([]);
    expect((await request(app.app).get("/api/catalog/2")).status).toBe(404);
    for (const material of dto.materials) {
      expect((await request(app.app).get(material.contentUrl)).status).toBe(
        404,
      );
      expect((await request(app.app).head(material.contentUrl)).status).toBe(
        404,
      );
      expect(
        (
          await request(app.app)
            .get(material.contentUrl)
            .set("Range", "bytes=0-3")
        ).status,
      ).toBe(404);
    }
    expect(
      app.repository.publicationHistory(2).map((event) => event.action),
    ).toEqual(["FINALIZADO", "PUBLICADO", "RETIRADO"]);
    expect(
      (await app.evaluator.get(evaluationPath(submission.id))).body.data
        .evaluations[0].scores,
    ).toEqual(scores);
    const manual = submission.materials[2];
    expect(
      (
        await app.student.get(
          `${base}/materials/${manual.materialId}/versions/${manual.versionId}/file`,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.teacher
          .post(`${base}/publication`)
          .send(publication(submission))
      ).status,
    ).toBe(200);
  });

  it("reabertura bloqueia finalização, refinalização não libera resultado e nova rodada não herda avaliações", async () => {
    const app = appFrom(dataDirectory());
    const first = await submitted(app);
    await evaluated(app, first);
    const consolidation = (
      await app.teacher.get(`${base}/results/consolidation`)
    ).body.data;
    expect(
      (
        await app.teacher
          .post(`${base}/results/release`)
          .send({
            submissionId: first.id,
            fingerprint: consolidation.fingerprint,
          })
      ).status,
    ).toBe(200);
    const reopen = await app.teacher
      .post(`${evaluationPath(first.id)}/2/reopen`)
      .send({ reason: "Revisar a demonstração.", expectedRevision: 1 });
    expect(reopen.status).toBe(200);
    expect((await finalize(app, first)).status).toBe(409);
    await evaluated(app, first, 2);
    expect(
      (await app.teacher.get(`${base}/publication`)).body.data.canFinalize,
    ).toBe(true);
    expect(
      (await app.student.get(`${base}/result`)).body.data.resultReleased,
    ).toBe(false);
    expect(
      (await app.teacher.post(`${base}/submissions/${first.id}/return`)).status,
    ).toBe(200);
    const next = (
      await app.student
        .post(`${base}/submissions`)
        .send({ clientSubmissionId: randomUUID() })
    ).body.data;
    expect(next.round).toBe(2);
    expect((await finalize(app, next)).status).toBe(409);
    await evaluated(app, next);
    expect((await finalize(app, first)).body.error.code).toBe(
      "PUBLICATION_VERSION_CONFLICT",
    );
    expect((await finalize(app, next)).status).toBe(200);
    expect(
      (
        await app.teacher
          .post(`${evaluationPath(next.id)}/2/reopen`)
          .send({
            reason: "Tentar alterar após finalização.",
            expectedRevision: 1,
          })
      ).status,
    ).toBe(409);
    expect(
      (await app.teacher.post(`${base}/submissions/${next.id}/return`)).status,
    ).toBe(409);
    expect(
      (
        await upload(
          app.student,
          `${base}/materials`,
          { kind: "MANUAL" },
          pdfFile(),
        )
      ).status,
    ).toBe(409);
  });

  it("nega ações de publicação a aluno, avaliador, outra turma e requisição sem CSRF", async () => {
    const app = appFrom(dataDirectory());
    const submission = await submitted(app);
    await evaluated(app, submission);
    for (const actor of [app.student, app.evaluator]) {
      expect(
        (
          await actor
            .post(`${base}/finalization`)
            .send({ submissionId: submission.id })
        ).status,
      ).toBe(403);
      expect(
        (await actor.post(`${base}/publication`).send(publication(submission)))
          .status,
      ).toBe(403);
      expect((await actor.delete(`${base}/publication`)).status).toBe(403);
    }
    expect((await app.outsider.get(`${base}/publication`)).status).toBe(404);
    expect(
      (
        await app.outsider
          .post(`${base}/finalization`)
          .send({ submissionId: submission.id })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.teacher
          .post(`${base}/finalization`)
          .unset("X-CSRF-Protection")
          .send({ submissionId: submission.id })
      ).status,
    ).toBe(403);
    expect((await request(app.app).get(`${base}/publication`)).status).toBe(
      401,
    );
    expect(app.repository.publicationHistory(2)).toEqual([]);
  });

  it("revalida a avaliação real se houver reabertura durante a leitura dos arquivos", async () => {
    const app = appFrom(dataDirectory());
    const submission = await submitted(app);
    await evaluated(app, submission);
    const open = app.storage.open.bind(app.storage);
    vi.spyOn(app.storage, "open").mockImplementationOnce(async (key) => {
      expect(
        (
          await app.teacher
            .post(`${evaluationPath(submission.id)}/2/reopen`)
            .send({ reason: "Revisão concorrente.", expectedRevision: 1 })
        ).status,
      ).toBe(200);
      return open(key);
    });
    expect((await finalize(app, submission)).status).toBe(409);
    expect(app.repository.get(2)?.status).toBe("EM_AVALIACAO");
    expect(app.repository.publicationHistory(2)).toEqual([]);
  });

  it("revalida a rodada real se houver devolução e nova submissão durante a leitura dos arquivos", async () => {
    const app = appFrom(dataDirectory());
    const submission = await submitted(app);
    await evaluated(app, submission);
    const open = app.storage.open.bind(app.storage);
    vi.spyOn(app.storage, "open").mockImplementationOnce(async (key) => {
      expect(
        (await app.teacher.post(`${base}/submissions/${submission.id}/return`))
          .status,
      ).toBe(200);
      expect(
        (
          await app.student
            .post(`${base}/submissions`)
            .send({ clientSubmissionId: randomUUID() })
        ).status,
      ).toBe(201);
      return open(key);
    });
    expect((await finalize(app, submission)).body.error.code).toBe(
      "PUBLICATION_VERSION_CONFLICT",
    );
    expect(app.repository.publicationHistory(2)).toEqual([]);
    expect(app.repository.listSubmissions(2)).toHaveLength(2);
  });

  it("não finaliza sem avaliadores e desconsidera a nota de um vínculo removido", async () => {
    const app = appFrom(dataDirectory());
    const submission = await submitted(app);
    await evaluated(app, submission);
    expect(
      (await app.teacher.put(`${base}/evaluators`).send({ evaluatorIds: [] }))
        .status,
    ).toBe(200);
    expect((await finalize(app, submission)).status).toBe(409);
    expect(
      (await app.teacher.get(`${base}/results/consolidation`)).body.data.result,
    ).toMatchObject({ allEvaluationsCompleted: false, evaluatorGrades: [] });
    expect(
      (await app.evaluator.get(evaluationPath(submission.id))).status,
    ).toBe(404);
    expect(app.repository.publicationHistory(2)).toEqual([]);
  });
});
