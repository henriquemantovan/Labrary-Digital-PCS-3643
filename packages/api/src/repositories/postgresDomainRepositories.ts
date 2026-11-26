import type { Pool } from "pg";
import { ApiError } from "../errors.js";
import { rubricSnapshotSchema } from "../models/rubric.js";
import { z } from "zod";
import type { AsyncRepository } from "./asyncRepository.js";
import { createMemoryProjectRepository } from "./projectRepository.js";
import { projectSnapshotSchema } from "./fileProjectStorage.js";
import { createMemoryRubricRepository } from "./rubricRepository.js";
import { createEvaluationRepository, evaluationRecordsSchema } from "./evaluationRepository.js";
import { createResultReleaseRepository, releaseSchema } from "./resultReleaseRepository.js";

export const domainDefaults = {
  projects: { projects: [], materials: [], messages: [], submissions: [] },
  rubrics: { versions: [] },
  evaluations: [],
  results: [],
} as const;
export type Domain = keyof typeof domainDefaults;

export function validateDomain(domain: Domain, value: unknown) {
  switch (domain) {
    case "projects": return projectSnapshotSchema.parse(value);
    case "rubrics": return rubricSnapshotSchema.parse(value);
    case "evaluations": return evaluationRecordsSchema.parse(value);
    case "results": return z.array(releaseSchema).parse(value);
  }
}

/**
 * Cada operação recarrega o estado do PostgreSQL. O bloqueio de linha protege
 * IDs, idempotência e versões entre processos; o retorno aguarda o COMMIT.
 * JSONB é um tipo nativo do banco: nenhum arquivo local é utilizado.
 */
function postgresRepository<T extends object>(
  pool: Pool,
  domain: Domain,
  factory: (load: () => unknown, save: (value: unknown) => void) => T,
): AsyncRepository<T> {
  const sample = factory(() => structuredClone(domainDefaults[domain]), () => undefined);
  return Object.fromEntries(Object.keys(sample).map((method) => [method, async (...args: unknown[]) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT payload FROM academic_state WHERE domain=$1 FOR UPDATE", [domain],
      );
      if (!result.rows.length)
        throw new Error("Persistência acadêmica ausente. Execute pnpm db:deploy.");
      let snapshot: unknown = validateDomain(domain, result.rows[0].payload);
      let dirty = false;
      const repository = factory(() => snapshot, (value) => {
        snapshot = validateDomain(domain, value);
        dirty = true;
      });
      const action = repository[method as keyof T] as (...values: unknown[]) => unknown;
      const output = await action(...args);
      if (dirty) await client.query(
        "UPDATE academic_state SET payload=$2::jsonb, updated_at=clock_timestamp() WHERE domain=$1",
        [domain, JSON.stringify(snapshot)],
      );
      await client.query("COMMIT");
      return output;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }])) as AsyncRepository<T>;
}

export function createPostgresDomainRepositories(pool: Pool) {
  return {
    repository: postgresRepository(pool, "projects", (load, save) => {
      const repository = createMemoryProjectRepository(false, { load: () => projectSnapshotSchema.parse(load()), save });
      const assertOpen = (projectId: number) => {
        const project = repository.get(projectId);
        if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
        if (project.status !== "PREPARACAO" && project.status !== "AJUSTES")
          throw new ApiError(409, "PROJECT_LOCKED", "O projeto não permite alterações de materiais nesta etapa.");
      };
      return {
        ...repository,
        createMaterial(projectId, material, version) {
          assertOpen(projectId);
          return repository.createMaterial(projectId, material, version);
        },
        addVersion(projectId, materialId, version) {
          assertOpen(projectId);
          return repository.addVersion(projectId, materialId, version);
        },
      } satisfies typeof repository;
    }),
    rubrics: postgresRepository(pool, "rubrics", (load, save) =>
      createMemoryRubricRepository({ load: () => rubricSnapshotSchema.parse(load()), save })),
    evaluationRepository: postgresRepository(pool, "evaluations", (load, save) => {
      const repository = createEvaluationRepository({
        load: () => evaluationRecordsSchema.parse(load()), save,
      });
      return {
        ...repository,
        save(round, evaluation) {
          const previous = repository.list(round).find((item) => item.evaluatorId === evaluation.evaluatorId);
          if (evaluation.revision !== (previous?.revision ?? 0) + 1)
            throw new ApiError(409, "EVALUATION_VERSION_CONFLICT", "A avaliação foi atualizada. Recarregue e tente novamente.");
          return repository.save(round, evaluation);
        },
      } satisfies typeof repository;
    }),
    resultReleases: postgresRepository(pool, "results", (load, save) =>
      createResultReleaseRepository({ load: () => z.array(releaseSchema).parse(load()), save })),
  };
}
