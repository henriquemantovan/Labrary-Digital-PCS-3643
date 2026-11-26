import { describe, expect, it } from "vitest";
import { createPostgresDomainRepositories } from "./postgresDomainRepositories.js";
import { domainPool } from "../test/domainPool.js";
import { evaluationContractExamples } from "../test/evaluationContractExamples.js";

const input = { classId: 1, groupId: 1, title: "Projeto persistido", description: "", category: "Digital" };
describe("persistência acadêmica PostgreSQL", () => {
  it("recupera projetos em outra instância e devolve cópias independentes", async () => {
    const c = domainPool();
    const first = createPostgresDomainRepositories(c.pool);
    const project = await first.repository.create(input);
    project.title = "Alteração fora do repositório";
    const second = createPostgresDomainRepositories(c.pool);
    expect(await second.repository.get(project.id)).toMatchObject(input);
    expect(await second.repository.list({})).toHaveLength(1);
    expect(c.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(c.release).toHaveBeenCalledTimes(3);
  });
  it("preserva versões de critérios e recusa uma edição baseada em versão antiga", async () => {
    const c = domainPool();
    const { rubrics } = createPostgresDomainRepositories(c.pool);
    const { id: _id, versionNumber: _version, ...input } = evaluationContractExamples().pending.rubric;
    const version = await rubrics.create(input, 0);
    expect(await createPostgresDomainRepositories(c.pool).rubrics.latest(1)).toEqual(version);
    await expect(rubrics.create(input, 0)).rejects.toMatchObject({ code: "RUBRIC_VERSION_CONFLICT" });
    expect(await rubrics.list(1)).toHaveLength(1);
  });
  it("preserva versões de materiais e bloqueia envio após a submissão", async () => {
    const c = domainPool();
    const { repository } = createPostgresDomainRepositories(c.pool);
    const project = await repository.create(input);
    const material = { kind: "RELATORIO" as const, title: "Relatório", createdBy: 1 };
    const version = { originalFilename: "relatorio.pdf", mimeType: "application/pdf", sizeBytes: 6, storageKey: "arquivo", checksumSha256: null, uploadedBy: 1 };
    await expect(repository.createMaterial(999, material, version)).rejects.toMatchObject({ status: 404 });
    const first = await repository.createMaterial(project.id, material, version);
    await repository.addVersion(project.id, first.id, { ...version, storageKey: "arquivo2" });
    expect((await repository.getMaterial(project.id, first.id))?.versions.map((item) => item.versionNumber)).toEqual([2, 1]);
    const snapshot = structuredClone(c.states.get("projects")) as { projects: { status: string }[] };
    snapshot.projects[0].status = "EM_AVALIACAO";
    c.set("projects", snapshot);
    await expect(repository.addVersion(project.id, first.id, version)).rejects.toMatchObject({ code: "PROJECT_LOCKED" });
    expect((await repository.listMaterials(project.id))[0].versions).toHaveLength(2);
  });
  it("persiste avaliações e rejeita revisão concorrente ou repetida", async () => {
    const c = domainPool();
    const repository = createPostgresDomainRepositories(c.pool).evaluationRepository;
    const round = { projectId: 1, id: 11, rubricVersionId: 1 };
    const examples = evaluationContractExamples();
    await repository.save(round, examples.draft.evaluations[0]);
    await expect(repository.save(round, examples.draft.evaluations[0])).rejects.toMatchObject({ code: "EVALUATION_VERSION_CONFLICT" });
    await repository.save(round, examples.finalized.evaluations[0]);
    expect(await createPostgresDomainRepositories(c.pool).evaluationRepository.list(round)).toEqual(examples.finalized.evaluations);
    await expect(repository.list({ ...round, rubricVersionId: 2 })).rejects.toThrow("não correspondem");
  });
  it("mantém a liberação idempotente depois de recriar os repositórios", async () => {
    const c = domainPool();
    const first = createPostgresDomainRepositories(c.pool).resultReleases;
    const value = { projectId: 1, submissionId: 11, round: 1, fingerprint: "a".repeat(64), releasedBy: 3, releasedAt: "2026-11-26T12:00:00.000Z" };
    await first.release(value);
    const second = createPostgresDomainRepositories(c.pool).resultReleases;
    expect(await second.release({ ...value, releasedBy: 4 })).toEqual(value);
    expect(await second.find(1, value.fingerprint)).toEqual(value);
    expect(await second.find(2, value.fingerprint)).toBeUndefined();
  });
  it("recusa estado ausente ou inválido e sempre devolve a conexão", async () => {
    const c = domainPool();
    c.states.delete("projects");
    await expect(createPostgresDomainRepositories(c.pool).repository.list({})).rejects.toThrow("db:deploy");
    c.set("projects", { projects: "inválido" });
    await expect(createPostgresDomainRepositories(c.pool).repository.list({})).rejects.toThrow();
    expect(c.release).toHaveBeenCalledTimes(2);
    expect(c.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
  it("não informa sucesso quando o COMMIT falha", async () => {
    const c = domainPool();
    c.failCommit();
    await expect(createPostgresDomainRepositories(c.pool).repository.create(input)).rejects.toThrow("Falha ao confirmar");
    expect(c.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(c.release).toHaveBeenCalledOnce();
  });
});
