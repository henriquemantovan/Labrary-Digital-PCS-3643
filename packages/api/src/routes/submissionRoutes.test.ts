import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { defaultRequirements } from "../models/rubric.js";
import { submissionSchema } from "../models/submission.js";
import { createMemoryRubricRepository } from "../repositories/rubricRepository.js";
import { context, pdfFile, sampleFiles, upload } from "../test/context.js";

const dueAt = "2026-11-25T23:00:00.000Z";
const beforeDue = Date.parse("2026-11-08T12:00:00Z");
const afterDue = Date.parse("2026-11-26T12:00:00Z");
const base = "/api/projects/2";
const materials = `${base}/materials`;

function setup({ configured = true } = {}) {
  let clock = beforeDue;
  const rubrics = createMemoryRubricRepository();
  if (configured)
    rubrics.create({
      projectId: 2, classId: 1, title: "Entrega final", createdBy: 3, createdAt: new Date(clock).toISOString(),
      requirements: defaultRequirements(dueAt),
      criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
    }, 0);
  const ctx = context({ rubrics, now: () => clock, sessionTtlMs: 30 * 24 * 60 * 60_000 });
  return {
    ...ctx,
    rubrics,
    student: ctx.client(1),
    evaluator: ctx.client(2),
    professor: ctx.client(3),
    setClock: (value: number) => {
      clock = value;
    },
  };
}
type Setup = ReturnType<typeof setup>;

async function sendAll(student: Setup["student"]) {
  const sent = [
    await upload(student, materials, { kind: "VIDEO" }, { content: sampleFiles.mp4, filename: "video.mp4" }),
    await upload(student, materials, { kind: "RELATORIO" }, pdfFile()),
    await upload(student, materials, { kind: "MANUAL" }, pdfFile("manual.pdf")),
  ];
  for (const response of sent) expect(response.status).toBe(201);
  return sent.map((response) => response.body.data);
}
const submit = (actor: Setup["student"], clientSubmissionId: string = randomUUID()) =>
  actor.post(`${base}/submissions`).send({ clientSubmissionId });

describe("HU05: checklist e submissão (C1)", () => {
  it("exige sessão e CSRF, esconde projetos de outro grupo e restringe papéis", async () => {
    const { app, student, evaluator, professor, auth } = setup();
    for (const path of [`${base}/submission-checklist`, `${base}/submissions`, `${base}/submissions/1`])
      expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).post(`${base}/submissions`).set("X-CSRF-Protection", "1")
      .send({ clientSubmissionId: randomUUID() })).status).toBe(401);
    expect((await submit(student).unset("X-CSRF-Protection")).status).toBe(403);

    // Projeto 1 pertence a outro grupo: responde como inexistente.
    const other = await student.get("/api/projects/1/submission-checklist");
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect((await evaluator.get(`${base}/submissions`)).status).toBe(404);

    const byProfessor = await submit(professor);
    expect(byProfessor.status).toBe(403);
    expect(byProfessor.body.error.code).toBe("FORBIDDEN");
    auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
    expect((await submit(evaluator)).status).toBe(403);
    expect((await evaluator.get(`${base}/submission-checklist`)).body.data.canSubmit).toBe(false);
  });

  it("valida o corpo e os identificadores", async () => {
    const { student } = setup();
    for (const body of [{}, { clientSubmissionId: "abc" }, { clientSubmissionId: randomUUID(), status: "SUBMETIDA" }]) {
      const response = await student.post(`${base}/submissions`).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await student.get(`${base}/submissions/abc`)).status).toBe(400);
    const missing = await student.get(`${base}/submissions/99`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("SUBMISSION_NOT_FOUND");
  });

  it("checklist mostra presentes e ausentes e bloqueia submissão incompleta", async () => {
    const { student, professor } = setup();
    await upload(student, materials, { kind: "RELATORIO" }, pdfFile());
    const checklist = await student.get(`${base}/submission-checklist`);
    expect(checklist.status).toBe(200);
    expect(checklist.body.data).toMatchObject({
      projectStatus: "PREPARACAO", rubricVersionId: 1, blockedBy: "INCOMPLETE_SUBMISSION", canSubmit: false,
    });
    expect(checklist.body.data.items.map((item: { kind: string; ok: boolean }) => [item.kind, item.ok]))
      .toEqual([["VIDEO", false], ["RELATORIO", true], ["MANUAL", false]]);
    const refused = await submit(student);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "INCOMPLETE_SUBMISSION" });
    expect(refused.body.error.message).toContain("Vídeo de apresentação");
    expect((await student.get(`${base}/submissions`)).body.data).toEqual([]);
    // O professor também lê o checklist, mas não pode submeter.
    expect((await professor.get(`${base}/submission-checklist`)).body.data.items).toHaveLength(3);
  });

  it("recusa submissão sem requisitos configurados ou fora do prazo", async () => {
    const unconfigured = setup({ configured: false });
    const checklist = (await unconfigured.student.get(`${base}/submission-checklist`)).body.data;
    expect(checklist).toMatchObject({ rubricVersionId: null, items: [], blockedBy: "RUBRIC_NOT_CONFIGURED", canSubmit: false });
    expect((await submit(unconfigured.student)).body.error.code).toBe("RUBRIC_NOT_CONFIGURED");

    const late = setup();
    await sendAll(late.student);
    late.setClock(afterDue);
    expect((await late.student.get(`${base}/submission-checklist`)).body.data.blockedBy).toBe("DEADLINE_PASSED");
    const refused = await submit(late.student);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("DEADLINE_PASSED");
  });

  it("submete com snapshot C1, muda para Em avaliação e bloqueia os materiais", async () => {
    const { student, evaluator, professor, auth } = setup();
    const [video, report] = await sendAll(student);
    const ready = (await student.get(`${base}/submission-checklist`)).body.data;
    expect(ready).toMatchObject({ blockedBy: null, canSubmit: true });

    const clientSubmissionId = randomUUID();
    const created = await submit(student, clientSubmissionId);
    expect(created.status).toBe(201);
    const submission = submissionSchema.parse(created.body.data);
    expect(submission).toMatchObject({
      id: 1, projectId: 2, round: 1, clientSubmissionId, status: "SUBMETIDA", submittedBy: 1,
      submittedAt: new Date(beforeDue).toISOString(), returnedAt: null, rubricVersionId: 1,
    });
    expect(submission.materials.map((item) => [item.kind, item.versionId]))
      .toEqual([["VIDEO", video.versions[0].id], ["RELATORIO", report.versions[0].id], ["MANUAL", expect.any(Number)]]);
    expect(JSON.stringify(submission)).not.toContain("storageKey");

    expect((await student.get(base)).body.data.status).toBe("EM_AVALIACAO");
    const locked = await upload(student, `${materials}/${report.id}/versions`, {}, pdfFile());
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("PROJECT_LOCKED");
    const again = await submit(student);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("SUBMISSION_LOCKED");

    // Repetir a mesma tentativa devolve a rodada existente, sem duplicar.
    const repeated = await submit(student, clientSubmissionId);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data).toEqual(created.body.data);
    expect((await student.get(`${base}/submissions`)).body.data).toEqual([created.body.data]);
    expect((await student.get(`${base}/submissions/1`)).body.data).toEqual(created.body.data);

    // Leitura por professor da turma e avaliador atribuído.
    expect((await professor.get(`${base}/submissions/1`)).status).toBe(200);
    auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
    expect((await evaluator.get(`${base}/submissions`)).body.data).toHaveLength(1);
  });

  it("devolução para ajustes cria nova rodada, dispensa prazo e preserva a anterior", async () => {
    const { student, evaluator, professor, auth, setClock } = setup();
    const [, , manual] = await sendAll(student);
    const first = (await submit(student)).body.data;

    const byStudent = await student.post(`${base}/submissions/${first.id}/return`);
    expect(byStudent.status).toBe(403);
    auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
    expect((await evaluator.post(`${base}/submissions/${first.id}/return`)).status).toBe(403);
    const missing = await professor.post(`${base}/submissions/99/return`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("SUBMISSION_NOT_FOUND");

    setClock(afterDue);
    const returned = await professor.post(`${base}/submissions/${first.id}/return`);
    expect(returned.status).toBe(200);
    expect(returned.body.data).toMatchObject({ id: first.id, round: 1, status: "DEVOLVIDA", returnedAt: new Date(afterDue).toISOString() });
    expect((await student.get(base)).body.data.status).toBe("AJUSTES");
    const twice = await professor.post(`${base}/submissions/${first.id}/return`);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe("SUBMISSION_NOT_RETURNABLE");

    // Em Ajustes, prazos vencidos não impedem nova versão nem a nova rodada.
    const v2 = await upload(student, `${materials}/${manual.id}/versions`, {}, pdfFile("manual-v2.pdf"));
    expect(v2.status).toBe(201);
    expect((await student.get(`${base}/submission-checklist`)).body.data).toMatchObject({ projectStatus: "AJUSTES", canSubmit: true });
    const second = await submit(student);
    expect(second.status).toBe(201);
    expect(second.body.data).toMatchObject({ id: 2, round: 2, status: "SUBMETIDA" });
    const manualIn = (submission: { materials: { kind: string; versionNumber: number }[] }) =>
      submission.materials.find((item) => item.kind === "MANUAL")!.versionNumber;
    expect(manualIn(second.body.data)).toBe(2);

    const history = (await student.get(`${base}/submissions`)).body.data;
    expect(history.map((item: { round: number; status: string }) => [item.round, item.status]))
      .toEqual([[1, "DEVOLVIDA"], [2, "SUBMETIDA"]]);
    expect(manualIn(history[0])).toBe(1);
    expect(history[0].materials).toEqual(first.materials);

    // Rodada antiga não pode mais ser devolvida.
    expect((await professor.post(`${base}/submissions/${first.id}/return`)).status).toBe(409);
    expect((await professor.post(`${base}/submissions/${second.body.data.id}/return`)).status).toBe(200);
  });
});
