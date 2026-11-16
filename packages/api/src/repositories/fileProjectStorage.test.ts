import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createFileProjectStorage } from "./fileProjectStorage.js";
import request from "supertest";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { createDiskStorage } from "../services/fileStorage.js";
import { defaultRequirements } from "../models/rubric.js";
import { NewSubmission } from "../models/submission.js";
import { createMemoryRubricRepository } from "./rubricRepository.js";
import { prepareSubmission } from "../services/submissionRules.js";
import { ProjectRepository } from "./projectRepository.js";
import {
  context,
  materialInput,
  pdfFile,
  projectInput,
  sampleFiles,
  storedMaterial,
  upload,
  versionInput,
} from "../test/context.js";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function file() {
  const dir = mkdtempSync(join(tmpdir(), "labrary-feedback-"));
  directories.push(dir);
  return join(dir, "private", "projects.json");
}
it("persiste projetos, versões e conversa real em disco e restaura após recriar a aplicação", async () => {
  const path = file();
  const repository = createMemoryProjectRepository(
    true,
    createFileProjectStorage(path),
  );
  const initial = context({ repository });
  const material = storedMaterial(repository, 2);
  const payload = {
    clientMessageId: randomUUID(),
    body: "Revisar relatório",
    materialVersionId: material.versions[0].id,
  };
  const sent = await initial
    .client(1)
    .post("/api/projects/2/messages")
    .send(payload);
  expect(sent.status).toBe(201);
  repository.create({ ...projectInput, description: "" });
  const restoredRepository = createMemoryProjectRepository(
    false,
    createFileProjectStorage(path),
  );
  const restored = context({ repository: restoredRepository });
  expect(
    (await restored.client(1).get("/api/projects/2/messages")).body.data,
  ).toEqual([sent.body.data]);
  expect(
    (await restored.client(1).post("/api/projects/2/messages").send(payload))
      .status,
  ).toBe(200);
  expect(restoredRepository.get(3)?.title).toBe(projectInput.title);
  expect(restoredRepository.getMaterial(2, material.id)).toEqual(material);
  expect(
    restoredRepository.addVersion(2, material.id, versionInput).versions[0],
  ).toMatchObject({ id: 2, versionNumber: 2 });
  expect(
    restoredRepository.create({ ...projectInput, groupId: 4, description: "" })
      .id,
  ).toBe(4);
  expect(
    (
      await restored
        .client(3)
        .post("/api/projects/2/messages")
        .send({ clientMessageId: randomUUID(), body: "Resposta" })
    ).body.data.id,
  ).toBe(2);
  expect(JSON.parse(readFileSync(path, "utf8")).messages).toHaveLength(2);
});
it("falha fechada em arquivo ilegível/corrompido sem substituir a conversa", () => {
  const path = file();
  const storage = createFileProjectStorage(path);
  storage.save({ projects: [], materials: [], messages: [] });
  for (const content of ["{", "{}"]) {
    writeFileSync(path, content);
    expect(() => storage.load()).toThrow();
    expect(readFileSync(path, "utf8")).toBe(content);
  }
  expect(() => createFileProjectStorage(join(path, "child")).load()).toThrow();
});
it("falha de gravação mantém o estado anterior e permite repetir sem duplicação", () => {
  const save = vi.fn(() => {
    throw new Error("sem espaço");
  });
  const repository = createMemoryProjectRepository(true, {
    load: () => undefined,
    save,
  });
  const message = {
    projectId: 2,
    clientMessageId: randomUUID(),
    body: "Olá",
    author: { id: 1, fullName: "Aluno", role: "ALUNO" as const },
    createdAt: "2026-11-02T12:00:00.000Z",
    materialVersion: null,
  };
  expect(() => repository.createMessage(message)).toThrow("sem espaço");
  expect(repository.listMessages(2)).toEqual([]);
  save.mockImplementation(() => undefined);
  expect(repository.createMessage(message).message.id).toBe(1);
  expect(
    repository.createMessage({
      ...message,
      clientMessageId: randomUUID(),
      createdAt: "2026-11-01T12:00:00.000Z",
    }).message.id,
  ).toBe(2);
  expect(repository.listMessages(2).map((item) => item.id)).toEqual([2, 1]);
  expect(repository.listMessages(1)).toEqual([]);
});
it("falha de gravação não registra material nem versão e permite repetir", () => {
  const save = vi.fn();
  const repository = createMemoryProjectRepository(true, {
    load: () => undefined,
    save,
  });
  const failOnce = () =>
    save.mockImplementationOnce(() => {
      throw new Error("sem espaço");
    });
  failOnce();
  expect(() => storedMaterial(repository, 2)).toThrow("sem espaço");
  expect(repository.listMaterials(2)).toEqual([]);
  const material = storedMaterial(repository, 2);
  expect(material).toMatchObject({ id: 1, versions: [{ id: 1 }] });
  failOnce();
  expect(() => repository.addVersion(2, 1, versionInput)).toThrow("sem espaço");
  expect(repository.getMaterial(2, 1)).toEqual(material);
  expect(repository.addVersion(2, 1, versionInput).versions[0]).toMatchObject({
    id: 2,
    versionNumber: 2,
  });
});
it("bytes e metadados de materiais sobrevivem à recriação da aplicação", async () => {
  const path = file();
  const storage = createDiskStorage(join(path, "..", "uploads"));
  const binary = (req: request.Test) =>
    req.buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
  const first = context({
    repository: createMemoryProjectRepository(true, createFileProjectStorage(path)),
    storage,
  });
  const created = await upload(first.client(1), "/api/projects/2/materials", materialInput, pdfFile());
  expect(created.status).toBe(201);
  const restored = context({
    repository: createMemoryProjectRepository(true, createFileProjectStorage(path)),
    storage: createDiskStorage(join(path, "..", "uploads")),
  });
  const listed = await restored.client(1).get("/api/projects/2/materials");
  expect(listed.body.data).toEqual((await first.client(1).get("/api/projects/2/materials")).body.data);
  const download = await binary(restored.client(1).get(created.body.data.currentVersion.downloadUrl));
  expect(download.status).toBe(200);
  expect(download.body).toEqual(sampleFiles.pdf);
});

const legacySnapshot = {
  projects: [{
    id: 2, classId: 1, groupId: 2, title: "Projeto antigo", description: "", category: "Lógica",
    status: "PREPARACAO", dueAt: null, createdAt: "2026-10-15T12:00:00.000Z", updatedAt: "2026-10-15T12:00:00.000Z",
  }],
  materials: [
    { id: 6, projectId: 2, title: "Relatório", kind: "RELATORIO", versionNumber: 1, originalFilename: "r.pdf",
      mimeType: "application/pdf", sizeBytes: 10, storageKey: "mock/2/6", uploadedAt: "2026-10-16T12:00:00.000Z" },
    { id: 7, projectId: 2, title: "Relatório", kind: "RELATORIO", versionNumber: 2, originalFilename: "r2.pdf",
      mimeType: "application/pdf", sizeBytes: 10, storageKey: "mock/2/7", uploadedAt: "2026-10-17T12:00:00.000Z" },
  ],
  messages: [{
    id: 1, projectId: 2, clientMessageId: randomUUID(), body: "Ver v2", createdAt: "2026-10-18T12:00:00.000Z",
    author: { id: 1, fullName: "Aluno", role: "ALUNO" }, materialVersion: { id: 7, title: "Relatório", versionNumber: 2 },
  }],
};
it("converte snapshot anterior à HU04 com backup, sem materiais sem bytes e sem reutilizar IDs citados", () => {
  const path = file();
  createFileProjectStorage(path).save({ projects: [], materials: [], messages: [] });
  const original = JSON.stringify(legacySnapshot);
  writeFileSync(path, original);
  const repository = createMemoryProjectRepository(false, createFileProjectStorage(path));
  expect(readFileSync(`${path}.legacy-backup`, "utf8")).toBe(original);
  expect(repository.get(2)?.title).toBe("Projeto antigo");
  expect(repository.listMaterials(2)).toEqual([]);
  expect(repository.listMessages(2)).toEqual(legacySnapshot.messages);
  // Antes de gravar, o arquivo original continua intacto e pode ser recarregado.
  createMemoryProjectRepository(false, createFileProjectStorage(path));
  expect(readFileSync(path, "utf8")).toBe(original);
  expect(storedMaterial(repository, 2).versions[0].id).toBe(8);
  const reloaded = createMemoryProjectRepository(false, createFileProjectStorage(path));
  expect(reloaded.listMaterials(2)).toHaveLength(1);
  expect(readFileSync(`${path}.legacy-backup`, "utf8")).toBe(original);
});
it("não sobrescreve backup legado divergente nem aceita snapshot misto", () => {
  const path = file();
  createFileProjectStorage(path).save({ projects: [], materials: [], messages: [] });
  writeFileSync(`${path}.legacy-backup`, "outro conteúdo");
  writeFileSync(path, JSON.stringify(legacySnapshot));
  expect(() => createFileProjectStorage(path).load()).toThrow("Backup divergente");
  expect(readFileSync(`${path}.legacy-backup`, "utf8")).toBe("outro conteúdo");
  const mixed = { ...legacySnapshot, materials: [...legacySnapshot.materials, { versions: [] }] };
  writeFileSync(path, JSON.stringify(mixed));
  rmSync(`${path}.legacy-backup`);
  expect(() => createFileProjectStorage(path).load()).toThrow();
});

// HU05: rodadas C1 gravadas no mesmo snapshot dos projetos.
const submittedAt = Date.parse("2026-11-08T12:00:00Z");
const rubricForProject2 = () =>
  createMemoryRubricRepository().create({
    projectId: 2, classId: 1, title: "Entrega", createdBy: 3, createdAt: new Date(submittedAt).toISOString(),
    requirements: defaultRequirements("2026-11-25T23:00:00.000Z"),
    criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
  }, 0);
function storeRequiredMaterials(repository: ProjectRepository) {
  for (const [kind, mimeType] of [["VIDEO", "video/mp4"], ["RELATORIO", "application/pdf"], ["MANUAL", "application/pdf"]] as const)
    repository.createMaterial(2, { kind, title: kind, createdBy: 1 }, { ...versionInput, mimeType });
}
function nextRound(repository: ProjectRepository, rubric = rubricForProject2()): NewSubmission {
  const prepared = prepareSubmission({
    project: repository.get(2)!, rubric, materials: repository.listMaterials(2),
    previous: repository.listSubmissions(2), clientSubmissionId: randomUUID(), submittedBy: 1, now: submittedAt,
  });
  if (prepared.repeated) throw new Error("rodada repetida inesperada");
  return prepared.submission;
}

it("rodadas e estado do projeto sobrevivem ao reinício e os IDs continuam a sequência", () => {
  const path = file();
  const repository = createMemoryProjectRepository(true, createFileProjectStorage(path));
  storeRequiredMaterials(repository);
  const first = repository.createSubmission(nextRound(repository));
  expect(first).toMatchObject({ id: 1, round: 1, status: "SUBMETIDA" });
  expect(repository.get(2)).toMatchObject({ status: "EM_AVALIACAO", updatedAt: first.submittedAt });
  const returnedAt = "2026-11-09T12:00:00.000Z";
  repository.returnSubmission(2, first.id, returnedAt);

  const restored = createMemoryProjectRepository(false, createFileProjectStorage(path));
  expect(restored.get(2)).toMatchObject({ status: "AJUSTES", updatedAt: returnedAt });
  expect(restored.listSubmissions(2)).toEqual(repository.listSubmissions(2));
  expect(restored.getSubmission(2, 1)).toMatchObject({ status: "DEVOLVIDA", returnedAt });
  expect(restored.getSubmission(1, 1)).toBeUndefined();
  const second = restored.createSubmission(nextRound(restored));
  expect(second).toMatchObject({ id: 2, round: 2 });
  expect(createMemoryProjectRepository(false, createFileProjectStorage(path)).listSubmissions(2)).toHaveLength(2);
});

it("arquivo anterior à HU05, sem rodadas, carrega com histórico vazio", () => {
  const path = file();
  const storage = createFileProjectStorage(path);
  storage.save({ projects: [], materials: [], messages: [] });
  expect(JSON.parse(readFileSync(path, "utf8"))).not.toHaveProperty("submissions");
  expect(storage.load()).toEqual({ projects: [], materials: [], messages: [], submissions: [] });
});

it("rodada inválida no arquivo impede a carga sem apagar os dados", () => {
  const path = file();
  const content = JSON.stringify({ projects: [], materials: [], messages: [], submissions: [{ id: 1, projectId: 2 }] });
  createFileProjectStorage(path).save({ projects: [], materials: [], messages: [] });
  writeFileSync(path, content);
  expect(() => createMemoryProjectRepository(false, createFileProjectStorage(path))).toThrow();
  expect(readFileSync(path, "utf8")).toBe(content);
});

it("falha de gravação não registra a rodada nem muda o estado do projeto", () => {
  const save = vi.fn();
  const repository = createMemoryProjectRepository(true, { load: () => undefined, save });
  storeRequiredMaterials(repository);
  const failOnce = () => save.mockImplementationOnce(() => { throw new Error("sem espaço"); });
  const round = nextRound(repository);
  failOnce();
  expect(() => repository.createSubmission(round)).toThrow("sem espaço");
  expect(repository.listSubmissions(2)).toEqual([]);
  expect(repository.get(2)!.status).toBe("PREPARACAO");
  const created = repository.createSubmission(round);
  expect(created.id).toBe(1);
  failOnce();
  expect(() => repository.returnSubmission(2, 1, "2026-11-09T12:00:00.000Z")).toThrow("sem espaço");
  expect(repository.getSubmission(2, 1)!.status).toBe("SUBMETIDA");
  expect(repository.get(2)!.status).toBe("EM_AVALIACAO");
});

it("repositório recusa rodada em projeto fechado, inexistente ou inválida", () => {
  const repository = createMemoryProjectRepository();
  storeRequiredMaterials(repository);
  const round = nextRound(repository);
  expect(() => repository.createSubmission({ ...round, projectId: 99 })).toThrow("Projeto não encontrado");
  expect(() => repository.createSubmission({ ...round, rubricVersionId: 42 })).toThrow();
  expect(repository.listSubmissions(2)).toEqual([]);
  repository.createSubmission(round);
  expect(() => repository.createSubmission({ ...round, clientSubmissionId: randomUUID() }))
    .toThrow("não está aberto para submissão");
  expect(() => repository.returnSubmission(2, 99, "2026-11-09T12:00:00.000Z")).toThrow("Submissão não encontrada");
});
