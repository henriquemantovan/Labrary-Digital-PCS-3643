import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultRequirements } from "../models/rubric.js";
import { createFileRubricStorage } from "./fileRubricStorage.js";
import { createMemoryRubricRepository } from "./rubricRepository.js";

const directories: string[] = [];
const file = () => {
  const directory = mkdtempSync(join(tmpdir(), "labrary-rubrics-"));
  directories.push(directory);
  return join(directory, "rubrics.json");
};
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));
const input = (projectId = 1) => ({
  projectId, classId: 1, title: "Entrega", createdBy: 3, createdAt: "2026-11-08T12:00:00.000Z",
  requirements: defaultRequirements("2026-11-25T23:00:00Z"),
  criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0 as const, maxScore: 10 as const }],
});

describe("Persistência e isolamento de versões C0", () => {
  it("sobrevive ao reinício, não vaza referências e numera versões por projeto", () => {
    const path = file();
    const repo = createMemoryRubricRepository(createFileRubricStorage(path));
    expect(repo.get(1)).toBeUndefined();
    expect(repo.latest(1)).toBeUndefined();
    const value = input();
    const first = repo.create(value, 0);
    value.criteria[0].weight = 50;
    first.title = "Modificação externa";
    const another = repo.create(input(2), 0);
    expect(another).toMatchObject({ id: 2, versionNumber: 1 });
    const second = repo.create({ ...input(), title: "Nova rubrica" }, 1);
    expect(second).toMatchObject({ id: 3, versionNumber: 2 });
    repo.list(1)[0].criteria[0].title = "Tentativa de alterar histórico";
    repo.get(1)!.requirements[0].maxSizeBytes = 1;
    repo.latest(1)!.title = "Outra tentativa";
    const restored = createMemoryRubricRepository(createFileRubricStorage(path));
    expect(restored.list(1)).toEqual(repo.list(1));
    expect(restored.get(1)).toMatchObject({ title: "Entrega", criteria: [{ title: "Funcionamento", weight: 100 }] });
    expect(restored.latest(1)).toEqual(second);
    expect(restored.create(input(2), 2)).toMatchObject({ id: 4, versionNumber: 2 });
  });

  it("preserva o estado se gravação falhar e permite tentar novamente sem pular IDs", () => {
    const save = vi.fn().mockImplementationOnce(() => { throw new Error("disk full"); });
    const repo = createMemoryRubricRepository({ load: () => undefined, save });
    expect(() => repo.create(input(), 0)).toThrow("disk full");
    expect(repo.list(1)).toEqual([]);
    expect(repo.create(input(), 0)).toMatchObject({ id: 1, versionNumber: 1 });
    expect(() => repo.create(input(), 0)).toThrow("configuração mudou");
    expect(() => repo.create({ ...input(), classId: 2 }, 1)).toThrow("turma");
  });

  it("não substitui arquivo corrompido ou histórico com IDs/versões incoerentes", () => {
    const path = file();
    writeFileSync(path, "broken json");
    expect(() => createMemoryRubricRepository(createFileRubricStorage(path))).toThrow();
    expect(readFileSync(path, "utf8")).toBe("broken json");
    const version = { ...input(), id: 1, versionNumber: 1 };
    for (const versions of [[version, version], [{ ...version, versionNumber: 2 }], [{ ...version, criteria: [] }], [version, { ...version, id: 2, versionNumber: 2, classId: 2 }]]) {
      writeFileSync(path, JSON.stringify({ versions }));
      expect(() => createFileRubricStorage(path).load()).toThrow();
    }
    expect(() => createFileRubricStorage(path).save({ versions: [{ ...version, versionNumber: 3 }] })).toThrow();
  });
});
