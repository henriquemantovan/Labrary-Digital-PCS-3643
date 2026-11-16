import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileGroupStorage } from "./fileGroupStorage.js";
import { createMemoryGroupRepository } from "./groupRepository.js";
import { createAuthRepository } from "./authRepository.js";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { createFileProjectStorage } from "./fileProjectStorage.js";
import { context } from "../test/context.js";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
function temporary() {
  const root = mkdtempSync(join(tmpdir(), "labrary-groups-"));
  roots.push(root);
  return join(root, "private", "groups.json");
}
describe("persistência local de grupos", () => {
  it("restaura grupos, atribuições, projetos e histórico com novas instâncias", async () => {
    const path = temporary();
    const original = context();
    const directory = structuredClone(original.auth.directory);
    const projectsPath = `${path}.projects`;
    const projects = createMemoryProjectRepository(
      true,
      createFileProjectStorage(projectsPath),
    );
    const first = context({
      auth: createAuthRepository(structuredClone(directory)),
      repository: projects,
    });
    const groups = createMemoryGroupRepository(
      first.auth.directory,
      createFileGroupStorage(path),
    );
    const app = context({ auth: first.auth, repository: projects, groups });
    const teacher = app.client(3);
    const created = await teacher
      .post("/api/classes/1/groups")
      .send({ name: "Grupo persistente" });
    const groupId = created.body.data.id;
    expect(created.status).toBe(201);
    const project = await teacher
      .post("/api/projects")
      .send({
        classId: 1,
        groupId,
        title: "Projeto persistente",
        category: "Digital",
        description: "Descrição",
      });
    expect(project.status).toBe(201);
    expect(
      (
        await teacher
          .put(`/api/classes/1/groups/${groupId}/members`)
          .send({ memberIds: [1] })
      ).status,
    ).toBe(200);
    expect(
      (
        await teacher
          .put(`/api/projects/${project.body.data.id}/evaluators`)
          .send({ evaluatorIds: [2] })
      ).status,
    ).toBe(200);
    const auth = createAuthRepository(structuredClone(directory));
    const restarted = context({
      auth,
      repository: createMemoryProjectRepository(
        false,
        createFileProjectStorage(projectsPath),
      ),
      groups: createMemoryGroupRepository(
        auth.directory,
        createFileGroupStorage(path),
      ),
    });
    expect(
      (await restarted.client(1).get(`/api/projects/${project.body.data.id}`))
        .body.data.title,
    ).toBe("Projeto persistente");
    expect(
      (await restarted.client(2).get(`/api/projects/${project.body.data.id}`))
        .status,
    ).toBe(200);
    const overview = (
      await restarted.client(3).get("/api/classes/1/administration")
    ).body.data;
    expect(
      overview.groups.find((g: { id: number }) => g.id === groupId).history,
    ).toEqual([
      expect.objectContaining({ before: [], after: [1], changedBy: 3 }),
    ]);
    expect(
      (
        await restarted
          .client(3)
          .get(`/api/projects/${project.body.data.id}/evaluators`)
      ).body.data.history,
    ).toHaveLength(1);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8")).not.toMatch(
      /passwordHash|googleLinked|email/,
    );
  });
  it("recusa corrupção sem substituir o arquivo", () => {
    const path = temporary();
    const storage = createFileGroupStorage(path);
    expect(storage.load()).toBeUndefined();
    storage.save({ groups: [], assignments: [], changes: [] });
    for (const text of [
      "{",
      '{"groups":[]}',
      '{"groups":[{"id":-1}],"assignments":[],"changes":[]}',
    ]) {
      writeFileSync(path, text);
      expect(() => storage.load()).toThrow();
      expect(readFileSync(path, "utf8")).toBe(text);
    }
  });
  it("falha de gravação não altera vínculos, histórico ou próximo identificador", async () => {
    const { auth } = context();
    const save = vi.fn().mockImplementation(() => {
      throw new Error("Disco cheio");
    });
    const repo = createMemoryGroupRepository(auth.directory, {
      load: () => undefined,
      save,
    });
    expect(() => repo.createGroup(1, "Novo", 3)).toThrow("Disco cheio");
    expect(() =>
      repo.setLinks(1, {
        target: "GROUP",
        targetId: 2,
        after: [],
        changedBy: 3,
        changedAt: "2026-11-07T12:00:00Z",
      }),
    ).toThrow("Disco cheio");
    expect(auth.directory.groups.find((g) => g.id === 2)?.memberIds).toEqual([
      1,
    ]);
    expect(repo.history("GROUP", 2)).toEqual([]);
    save.mockImplementation(() => undefined);
    expect(await repo.createGroup(1, "Novo", 3)).toMatchObject({ id: 4 });
    await repo.setLinks(1, {
      target: "GROUP",
      targetId: 2,
      after: [1],
      changedBy: 3,
      changedAt: "2026-11-07T12:00:00Z",
    });
    expect(repo.history("GROUP", 2)).toEqual([]);
    expect(() =>
      repo.setLinks(1, {
        target: "GROUP",
        targetId: 999,
        after: [],
        changedBy: 3,
        changedAt: "2026-11-07T12:00:00Z",
      }),
    ).toThrow("Grupo não encontrado");
  });
});
