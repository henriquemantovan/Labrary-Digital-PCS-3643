import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { publicationContext, publicationInput } from "../test/publication.js";
import { context, storedMaterial } from "../test/context.js";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { createFileProjectStorage } from "./fileProjectStorage.js";
import { publicationHistorySchema } from "../models/publicationDecision.js";
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});
const file = () => {
  const dir = mkdtempSync(join(tmpdir(), "labrary-publication-"));
  dirs.push(dir);
  return join(dir, "projects.json");
};
const finalize = async (c: Awaited<ReturnType<typeof publicationContext>>) =>
  c.client(3).post("/api/projects/1/finalization").send({ submissionId: 11 });
const publish = async (c: Awaited<ReturnType<typeof publicationContext>>) =>
  c.client(3).post("/api/projects/1/publication").send(publicationInput);
it("restaura decisões, projeção e bytes sem adapters e conserva auditoria em outras gravações", async () => {
  const path = file();
  const c = await publicationContext({
    repository: createMemoryProjectRepository(
      true,
      createFileProjectStorage(path),
    ),
  });
  await finalize(c);
  await publish(c);
  const original = (await request(c.app).get("/api/catalog/1")).body.data;
  // Outras operações do repositório não podem perder decisões da HU11.
  storedMaterial(c.repository, 2);
  await c
    .client(3)
    .post("/api/projects/1/messages")
    .send({
      clientMessageId: crypto.randomUUID(),
      body: "Mensagem privada depois da publicação",
    });
  const reload = () =>
    createMemoryProjectRepository(false, createFileProjectStorage(path));
  const repository = reload();
  expect(repository.get(1)?.status).toBe("FINALIZADO");
  const restarted = context({ repository, auth: c.auth, storage: c.storage });
  expect(
    (await request(restarted.app).get("/api/catalog/1")).body.data,
  ).toEqual(original);
  expect(
    (await request(restarted.app).get(original.materials[0].contentUrl)).status,
  ).toBe(200);
  expect(
    (await restarted.client(3).get("/api/projects/1/publication")).body.data
      .canPublish,
  ).toBe(false);
  expect(
    (await restarted.client(3).delete("/api/projects/1/publication")).status,
  ).toBe(204);
  const after = context({
    repository: reload(),
    auth: c.auth,
    storage: c.storage,
  });
  expect((await request(after.app).get("/api/catalog/1")).status).toBe(404);
  expect(after.repository.publicationHistory(1).map((e) => e.action)).toEqual([
    "FINALIZADO",
    "PUBLICADO",
    "RETIRADO",
  ]);
  expect(after.repository.listMessages(1)).toHaveLength(1);
});
it("falha de disco não finaliza nem publica e permite repetição", async () => {
  const save = vi.fn(),
    repository = createMemoryProjectRepository(true, {
      load: () => undefined,
      save,
    });
  const c = await publicationContext({ repository });
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  save.mockImplementationOnce(() => {
    throw new Error("Disco cheio");
  });
  expect((await finalize(c)).status).toBe(500);
  expect(repository.get(1)?.status).toBe("EM_AVALIACAO");
  expect(repository.publicationHistory(1)).toEqual([]);
  expect((await finalize(c)).status).toBe(200);
  save.mockImplementationOnce(() => {
    throw new Error("Disco cheio");
  });
  expect((await publish(c)).status).toBe(500);
  expect((await request(c.app).get("/api/catalog")).body.data).toEqual([]);
  expect(repository.publicationHistory(1)).toHaveLength(1);
  expect((await publish(c)).status).toBe(200);
  expect(repository.publicationHistory(1)).toHaveLength(2);
  expect(log).toHaveBeenCalledTimes(2);
});
it("rejeita histórico corrompido sem substituir o arquivo e valida referências do evento", async () => {
  const path = file();
  const c = await publicationContext({
    repository: createMemoryProjectRepository(
      true,
      createFileProjectStorage(path),
    ),
  });
  await finalize(c);
  await publish(c);
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  const final = snapshot.publicationDecisions[0],
    publication = snapshot.publicationDecisions[1];
  const invalids = [
    [publication],
    [final, { ...publication, id: final.id }],
    [final, { ...publication, submissionId: 99 }],
    [
      final,
      {
        ...publication,
        publicProject: { ...publication.publicProject, id: 99 },
      },
    ],
    [
      final,
      {
        ...publication,
        publicProject: {
          ...publication.publicProject,
          publishedAt: "2026-01-01T00:00:00Z",
        },
      },
    ],
    [{ ...final, submissionId: 99 }],
    [final, { ...final, id: 3 }],
    [
      final,
      {
        id: 2,
        projectId: 1,
        submissionId: 11,
        actorId: 3,
        createdAt: final.createdAt,
        action: "RETIRADO",
      },
    ],
  ];
  for (const publicationDecisions of invalids) {
    expect(
      publicationHistorySchema.safeParse(publicationDecisions).success,
    ).toBe(false);
    const text = JSON.stringify({ ...snapshot, publicationDecisions });
    writeFileSync(path, text);
    expect(() => createFileProjectStorage(path).load()).toThrow();
    expect(readFileSync(path, "utf8")).toBe(text);
  }
  expect(() =>
    c.repository.recordPublicationDecision({
      action: "RETIRADO",
      projectId: 99,
      submissionId: 11,
      actorId: 3,
      createdAt: final.createdAt,
    }),
  ).toThrow("Projeto não encontrado");
});
