import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRequirements } from "../models/rubric.js";
import { PublicationCompleteness } from "../services/publicationProviders.js";
import { createDiskStorage } from "../services/fileStorage.js";
import { createSubmissionProvider } from "../services/submissionProvider.js";
import { context, pdfFile, sampleFiles, upload } from "../test/context.js";
import { createFileProjectStorage } from "./fileProjectStorage.js";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { createFileRubricStorage } from "./fileRubricStorage.js";
import { createMemoryRubricRepository } from "./rubricRepository.js";

// Procedimento de docs/instalacao-e-aceitacao.md: copiar juntos metadados, critérios de avaliação e bytes,
// restaurar em outro diretório e conferir o estado após o reinício.
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const newDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "labrary-backup-"));
  dirs.push(dir);
  return dir;
};

const dueAt = "2026-11-25T23:00:00.000Z";
const beforeDue = Date.parse("2026-11-20T12:00:00Z");
const base = "/api/projects/2";
const manualV2 = Buffer.concat([sampleFiles.pdf, Buffer.from("manual v2")]);

/** Monta a aplicação como o server.ts, sobre um diretório de dados. */
function appFrom(dir: string, completeness?: { value?: PublicationCompleteness }) {
  const repository = createMemoryProjectRepository(true, createFileProjectStorage(join(dir, "projects.json")));
  const rubrics = createMemoryRubricRepository(createFileRubricStorage(join(dir, "rubrics.json")));
  const ctx = context({
    repository,
    rubrics,
    storage: createDiskStorage(join(dir, "uploads")),
    now: () => beforeDue,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    ...(completeness && {
      publicationProviders: {
        submissions: createSubmissionProvider(repository),
        evaluations: { completeness: async () => structuredClone(completeness.value) },
      },
    }),
  });
  ctx.auth.directory.assignments.push({ projectId: 2, evaluatorId: 2 });
  return { ...ctx, rubrics, student: ctx.client(1), professor: ctx.client(3) };
}
type App = ReturnType<typeof appFrom>;

const binary = (req: request.Test) =>
  req.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
  });
const submit = (app: App) => app.student.post(`${base}/submissions`).send({ clientSubmissionId: randomUUID() });

/** Rodada 1 devolvida e rodada 2 submetida com o manual v2. */
async function deliverTwoRounds(app: App) {
  app.rubrics.create({
    projectId: 2, classId: 1, title: "Entrega final", createdBy: 3, createdAt: new Date(beforeDue).toISOString(),
    requirements: defaultRequirements(dueAt),
    criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
  }, 0);
  const sent = [
    await upload(app.student, `${base}/materials`, { kind: "VIDEO" }, { content: sampleFiles.mp4, filename: "video.mp4" }),
    await upload(app.student, `${base}/materials`, { kind: "RELATORIO" }, pdfFile()),
    await upload(app.student, `${base}/materials`, { kind: "MANUAL" }, pdfFile("manual.pdf")),
  ];
  for (const response of sent) expect(response.status).toBe(201);
  const first = (await submit(app)).body.data;
  expect((await app.professor.post(`${base}/submissions/${first.id}/return`)).status).toBe(200);
  const manual = sent[2].body.data;
  const v2 = await upload(app.student, `${base}/materials/${manual.id}/versions`, {}, { content: manualV2, filename: "manual-v2.pdf" });
  expect(v2.status).toBe(201);
  const second = await submit(app);
  expect(second.status).toBe(201);
  return { first, second: second.body.data, manualId: manual.id };
}

/** Respostas observáveis pelo aluno, mais os bytes de cada versão. */
async function observe(app: App) {
  const read = async (path: string) => {
    const response = await app.student.get(path);
    expect(response.status).toBe(200);
    return response.body.data;
  };
  const materials = await read(`${base}/materials`);
  const bytes: Record<string, Buffer> = {};
  for (const material of materials)
    for (const version of material.versions) {
      const file = await binary(app.student.get(version.downloadUrl));
      expect(file.status).toBe(200);
      bytes[version.downloadUrl] = file.body;
    }
  return {
    project: await read(base),
    submissions: await read(`${base}/submissions`),
    checklist: await read(`${base}/submission-checklist`),
    materials,
    bytes,
  };
}

describe("backup e restauração conjunta (HU04/HU05)", () => {
  it("restaura rodadas, snapshots, versões e bytes de outro diretório, sem depender do original", async () => {
    const originalDir = newDir();
    const original = appFrom(originalDir);
    const { first, second, manualId } = await deliverTwoRounds(original);
    const before = await observe(original);
    expect(Object.keys(before.bytes)).toHaveLength(4);
    expect(Object.values(before.bytes)).toContainEqual(manualV2);

    const backupDir = newDir();
    cpSync(originalDir, backupDir, { recursive: true });
    rmSync(originalDir, { recursive: true, force: true });

    const restored = appFrom(backupDir);
    const after = await observe(restored);
    expect(after).toEqual(before);
    expect(after.project.status).toBe("EM_AVALIACAO");
    const manualIn = (submission: { materials: { kind: string; versionNumber: number }[] }) =>
      submission.materials.find((item) => item.kind === "MANUAL")!.versionNumber;
    expect(after.submissions.map((item: { id: number; round: number; status: string }) => [item.id, item.round, item.status]))
      .toEqual([[first.id, 1, "DEVOLVIDA"], [second.id, 2, "SUBMETIDA"]]);
    expect(manualIn(after.submissions[0])).toBe(1);
    expect(manualIn(after.submissions[1])).toBe(2);

    // A rodada restaurada continua bloqueada.
    const locked = await submit(restored);
    expect(locked.status).toBe(409);
    const blockedVersion = await upload(restored.student, `${base}/materials/${manualId}/versions`, {}, pdfFile("manual-v3.pdf"));
    expect(blockedVersion.status).toBe(409);

    // IDs e rodadas continuam a sequência depois da restauração.
    expect((await restored.professor.post(`${base}/submissions/${second.id}/return`)).status).toBe(200);
    const third = await submit(restored);
    expect(third.status).toBe(201);
    expect(third.body.data).toMatchObject({ id: second.id + 1, round: 3, status: "SUBMETIDA" });
  });

  it("restaura a decisão de finalização da HU11 gravada no mesmo arquivo das rodadas", async () => {
    const originalDir = newDir();
    const completeness: { value?: PublicationCompleteness } = {};
    const original = appFrom(originalDir, completeness);
    const { second } = await deliverTwoRounds(original);
    completeness.value = {
      projectId: 2, submissionId: second.id, round: second.round, rubricVersionId: second.rubricVersionId,
      expectedEvaluatorIds: [2], completedEvaluatorIds: [2], allEvaluationsCompleted: true, resultReleased: false,
    };
    const finalized = await original.professor.post(`${base}/finalization`).send({ submissionId: second.id });
    expect(finalized.status).toBe(200);
    const history = original.repository.publicationHistory(2);
    expect(history.map((event) => event.action)).toEqual(["FINALIZADO"]);
    const before = await observe(original);

    const backupDir = newDir();
    cpSync(originalDir, backupDir, { recursive: true });
    rmSync(originalDir, { recursive: true, force: true });

    // Sem adapters: restaurar não depende das integrações C1/C3.
    const restored = appFrom(backupDir);
    expect(restored.repository.publicationHistory(2)).toEqual(history);
    expect(await observe(restored)).toEqual(before);
    expect(before.project.status).toBe("FINALIZADO");
    expect((await submit(restored)).status).toBe(409);
  });

  it("cópia sem a pasta de uploads mantém os metadados e responde 404 nos downloads", async () => {
    const originalDir = newDir();
    const original = appFrom(originalDir);
    await deliverTwoRounds(original);
    const before = await observe(original);

    const backupDir = newDir();
    for (const file of ["projects.json", "rubrics.json"])
      cpSync(join(originalDir, file), join(backupDir, file));

    const restored = appFrom(backupDir);
    expect((await restored.student.get(`${base}/submissions`)).body.data).toEqual(before.submissions);
    expect((await restored.student.get(`${base}/materials`)).body.data).toEqual(before.materials);
    for (const url of Object.keys(before.bytes)) {
      const download = await restored.student.get(url);
      expect(download.status).toBe(404);
      expect(download.body.error.code).toBe("FILE_NOT_FOUND");
    }
    // A aplicação segue atendendo depois das falhas de download.
    expect((await restored.student.get(base)).status).toBe(200);
  });

  it("arquivo de projetos corrompido na cópia impede a carga sem apagar o backup", async () => {
    const originalDir = newDir();
    await deliverTwoRounds(appFrom(originalDir));
    const backupDir = newDir();
    cpSync(originalDir, backupDir, { recursive: true });
    const path = join(backupDir, "projects.json");
    writeFileSync(path, "{ corrompido");

    expect(() => appFrom(backupDir)).toThrow();
    // O arquivo não é substituído por um seed vazio; o original continua íntegro.
    expect(() => createFileProjectStorage(path).load()).toThrow();
    const intact = appFrom(originalDir);
    expect((await intact.student.get(`${base}/submissions`)).body.data).toHaveLength(2);
  });
});
