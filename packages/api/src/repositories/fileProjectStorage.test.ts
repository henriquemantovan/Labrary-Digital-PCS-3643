import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createFileProjectStorage } from "./fileProjectStorage.js";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { context, materialInput, projectInput } from "../test/context.js";

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
  const version = repository.createMaterial(2, materialInput);
  const payload = {
    clientMessageId: randomUUID(),
    body: "Revisar relatório",
    materialVersionId: version.id,
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
  expect(
    restoredRepository.createMaterial(2, materialInput).versionNumber,
  ).toBe(2);
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
