import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createDemoDirectory } from "../src/fixtures/demo.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import { createPostgresDomainRepositories, domainDefaults } from "../src/repositories/postgresDomainRepositories.js";
import { importAcademicData } from "../src/repositories/importAcademicData.js";
import { createPostgresR2UsageLimiter } from "../src/services/postgresR2Usage.js";
import { createDiskStorage } from "../src/services/fileStorage.js";
import { evaluationContractExamples } from "../src/test/evaluationContractExamples.js";

/** Somente no banco descartável criado por database.ts. */
export async function verifyAcademicPersistence(pool: Pool) {
  const folder = await mkdtemp(join(tmpdir(), "labrary-pg-integration-"));
  try {
    const auth = createAuthRepository(await createDemoDirectory());
    auth.directory.users.push({ ...auth.directory.users[0], id: 4, email: "outro@labrary.local", fullName: "Aluno de outro grupo" });
    auth.directory.groups.find((group) => group.id === 3)!.memberIds.push(4);
    const domains = createPostgresDomainRepositories(pool);
    const app = createApp({ ...domains, auth, storage: createDiskStorage(folder) });
    const sessions = new Map<number, string>();
    for (const user of [1, 2, 3, 4]) sessions.set(user, String(await auth.createSession(user, Date.now(), 600_000)));
    const call = (user: number, method: "get" | "post" | "put" | "delete", path: string) => request(app)[method](path)
      .set("Cookie", `labrary_session=${sessions.get(user)}`)
      .set("X-CSRF-Protection", "1");
    const project = await call(3, "post", "/api/projects").send({ classId: 1, groupId: 2, title: "Fluxo PostgreSQL", category: "Integração" });
    assert.equal(project.status, 201);
    const id = project.body.data.id;
    const path = `/api/projects/${id}`;
    auth.directory.assignments.push({ projectId: id, evaluatorId: 2 });
    const rubric = evaluationContractExamples().pending.rubric;
    const configuration = await call(3, "post", `${path}/configuration/versions`).send({
      baseVersionId: 0, title: rubric.title, criteria: rubric.criteria,
      requirements: rubric.requirements.map((item) => ({ ...item, dueAt: new Date(Date.now() + 86_400_000).toISOString() })),
    });
    assert.equal(configuration.status, 201);
    const video = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(30)]);
    const pdf = Buffer.from("%PDF-1.7\nconteudo ficticio\n%%EOF");
    for (const [kind, filename, bytes] of [["VIDEO", "video.webm", video], ["RELATORIO", "relatorio.pdf", pdf], ["MANUAL", "manual.pdf", pdf]] as const) {
      assert.equal((await call(1, "post", `${path}/materials`).field("kind", kind).attach("file", bytes, filename)).status, 201);
    }
    assert.equal((await call(1, "post", `${path}/messages`).send({ clientMessageId: randomUUID(), body: "Persistência real conferida." })).status, 201);
    assert.equal((await call(4, "get", path)).status, 404);
    const submission = await call(1, "post", `${path}/submissions`).send({ clientSubmissionId: randomUUID() });
    assert.equal(submission.status, 201);
    assert.equal((await call(2, "post", `${path}/submissions/${submission.body.data.id}/evaluations/me/finalize`).send({
      expectedRevision: 0, scores: rubric.criteria.map((item) => ({ criterionId: item.id, score: 9, comment: "Conferido" })),
    })).status, 200);
    const consolidation = await call(3, "get", `${path}/results/consolidation`);
    assert.equal((await call(3, "post", `${path}/results/release`).send({ submissionId: submission.body.data.id, fingerprint: consolidation.body.data.fingerprint })).status, 200);
    assert.equal((await call(3, "post", `${path}/finalization`).send({ submissionId: submission.body.data.id })).status, 200);
    const versionId = submission.body.data.materials[0].versionId;
    assert.equal((await call(3, "post", `${path}/publication`).send({ submissionId: submission.body.data.id, materialVersionIds: [versionId], groupAuthorization: { confirmed: true, reference: "Autorização fictícia de integração" } })).status, 200);

    // Outra instância recupera todo o fluxo sem qualquer JSON local.
    const restarted = createApp({ ...createPostgresDomainRepositories(pool), auth, storage: createDiskStorage(folder) });
    const student = (url: string) => request(restarted).get(url).set("Cookie", `labrary_session=${sessions.get(1)}`);
    assert.equal((await student(`${path}/result`)).body.data.resultReleased, true);
    assert.equal((await student(`${path}/messages`)).body.data[0].body, "Persistência real conferida.");
    assert.equal((await request(restarted).get(`/api/catalog/${id}`)).body.data.materials.length, 1);
    assert.equal((await request(restarted).get(`/api/catalog/${id}/materials/${versionId}/file`).set("Range", "bytes=0-3")).status, 206);
    assert.equal((await call(3, "delete", `${path}/publication`)).status, 204);
    assert.equal((await request(restarted).get(`/api/catalog/${id}`)).status, 404);

    // Escritas concorrentes de adapters independentes não perdem projetos/IDs.
    const parallel = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      createPostgresDomainRepositories(pool).repository.create({ classId: 1, groupId: 100 + index, title: `Concorrente ${index}`, description: "", category: "Teste" })));
    assert.equal(new Set(parallel.map((item) => item.id)).size, 8);
    assert.equal((await domains.repository.list({})).length, 9);
    const snapshot = Object.fromEntries((await pool.query("SELECT domain,payload FROM academic_state")).rows.map((row) => [row.domain, row.payload]));
    for (const [domain, payload] of Object.entries(domainDefaults)) await pool.query("UPDATE academic_state SET payload=$2::jsonb WHERE domain=$1", [domain, JSON.stringify(payload)]);
    const scope = "integracao/bucket";
    const usage = { version: 1, scope, month: "2026-11", A: 99_999, B: 12 };
    assert.equal((await importAcademicData(pool, snapshot as Parameters<typeof importAcademicData>[1], usage)).imported, true);
    assert.equal((await importAcademicData(pool, snapshot as Parameters<typeof importAcademicData>[1], usage)).imported, false);
    const imported = await pool.query("SELECT domain,payload FROM academic_state");
    assert.deepEqual(Object.fromEntries(imported.rows.map((row) => [row.domain, row.payload])), snapshot);
    await domains.repository.create({ classId: 1, groupId: 999, title: "Depois da importação", description: "", category: "Teste" });
    await importAcademicData(pool, snapshot as Parameters<typeof importAcademicData>[1], usage);
    assert.equal((await domains.repository.list({})).length, 10);
    await assert.rejects(importAcademicData(pool, structuredClone(domainDefaults)), /não sobrescreve/);

    const limiter = createPostgresR2UsageLimiter(pool, scope, () => Date.UTC(2026, 10, 26));
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => limiter.reserve("A")));
    assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
    await importAcademicData(pool, snapshot as Parameters<typeof importAcademicData>[1], usage);
    assert.equal((await pool.query("SELECT used_a FROM r2_usage WHERE scope=$1", [scope])).rows[0].used_a, 100_000);
    await createPostgresR2UsageLimiter(pool, scope, () => Date.UTC(2026, 11, 1)).reserve("B");
    assert.deepEqual((await pool.query("SELECT month,used_a,used_b FROM r2_usage WHERE scope=$1", [scope])).rows[0], { month: "2026-12", used_a: 0, used_b: 1 });
    await assert.rejects(limiter.reserve("B"), /Relógio anterior/);
    console.log("Persistência PostgreSQL: fluxo completo, reinício, isolamento, concorrência, importação e cotas R2 conferidos.");
  } finally {
    await rm(folder, { recursive: true, force: true });
    for (const [domain, payload] of Object.entries(domainDefaults)) await pool.query("UPDATE academic_state SET payload=$2::jsonb WHERE domain=$1", [domain, JSON.stringify(payload)]);
    await pool.query("TRUNCATE academic_data_import,r2_usage");
  }
}
