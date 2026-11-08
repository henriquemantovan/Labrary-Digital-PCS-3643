import { ApiError } from "../errors.js";
import { RubricSnapshot, RubricVersion, rubricSnapshotSchema, rubricVersionSchema } from "../models/rubric.js";

export interface RubricStorage {
  load(): RubricSnapshot | undefined;
  save(snapshot: RubricSnapshot): void;
}

export interface RubricRepository {
  get(id: number): RubricVersion | undefined;
  latest(projectId: number): RubricVersion | undefined;
  list(projectId: number): RubricVersion[];
  create(input: Omit<RubricVersion, "id" | "versionNumber">, baseVersionId: number): RubricVersion;
}

/** Um processo escritor. Salva antes de publicar o novo estado em memória. */
export function createMemoryRubricRepository(storage?: RubricStorage): RubricRepository {
  let { versions } = rubricSnapshotSchema.parse(storage?.load() ?? { versions: [] });
  const latest = (projectId: number) => versions.filter((item) => item.projectId === projectId).at(-1);
  return {
    get: (id) => structuredClone(versions.find((item) => item.id === id)),
    latest: (projectId) => structuredClone(latest(projectId)),
    list: (projectId) => structuredClone(versions.filter((item) => item.projectId === projectId)),
    create(input, baseVersionId) {
      const previous = latest(input.projectId);
      if ((previous?.id ?? 0) !== baseVersionId) {
        throw new ApiError(409, "RUBRIC_VERSION_CONFLICT", "A configuração mudou. Recarregue antes de criar uma versão.");
      }
      if (previous && previous.classId !== input.classId) {
        throw new ApiError(409, "RUBRIC_CLASS_CONFLICT", "A turma da configuração não pode ser alterada.");
      }
      const version = rubricVersionSchema.parse({
        ...input,
        id: Math.max(0, ...versions.map((item) => item.id)) + 1,
        versionNumber: (previous?.versionNumber ?? 0) + 1,
      });
      const next = { versions: [...versions, version] };
      storage?.save(structuredClone(next));
      versions = next.versions;
      return structuredClone(version);
    },
  };
}
