import { ApiError } from "../errors.js";
import { LinkChange, Requirement, RubricVersion } from "../models/planning.js";

// Same process-local adapter boundary as the existing project repository.
// PostgreSQL integration must replace this adapter, not merely change Prisma.
export function createMemoryPlanningRepository() {
  const requirements = new Map<number, Requirement[]>();
  const rubrics: RubricVersion[] = [];
  const changes: LinkChange[] = [];
  return {
    requirements(projectId: number) {
      return structuredClone(requirements.get(projectId) ?? []);
    },
    saveRequirements(projectId: number, input: Requirement[]) {
      requirements.set(projectId, structuredClone(input));
      return structuredClone(input);
    },
    rubrics(projectId: number) {
      return structuredClone(
        rubrics.filter((item) => item.projectId === projectId),
      );
    },
    createRubric(
      input: Omit<RubricVersion, "id" | "versionNumber">,
      baseVersion: number,
    ) {
      const previous = rubrics
        .filter((item) => item.projectId === input.projectId)
        .at(-1);
      if ((previous?.id ?? 0) !== baseVersion)
        throw new ApiError(
          409,
          "RUBRIC_VERSION_CONFLICT",
          "A rubrica mudou. Recarregue antes de criar uma versão.",
        );
      const classVersions = rubrics.filter(
        (item) => item.classId === input.classId,
      );
      const version = {
        ...structuredClone(input),
        id: rubrics.length + 1,
        versionNumber: (classVersions.at(-1)?.versionNumber ?? 0) + 1,
      };
      rubrics.push(version);
      return structuredClone(version);
    },
    recordChange(change: LinkChange) {
      changes.push(structuredClone(change));
    },
    history(target: LinkChange["target"], targetId: number) {
      return structuredClone(
        changes.filter(
          (item) => item.target === target && item.targetId === targetId,
        ),
      );
    },
  };
}
export type PlanningRepository = ReturnType<
  typeof createMemoryPlanningRepository
>;
