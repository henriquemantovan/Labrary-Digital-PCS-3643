import type { DataRepository } from "../repositories/asyncRepository.js";
import { RubricRepository } from "../repositories/rubricRepository.js";
import { defaultMaterialRules, fileFormats, AsyncMaterialPolicy } from "./materialPolicy.js";

/** Adapta C0 à política de upload sem duplicar extensões ou detecção dos bytes. */
export function createRubricMaterialPolicy(rubrics: DataRepository<RubricRepository>): AsyncMaterialPolicy {
  return {
    async rulesFor(project) {
      const configuration = (await rubrics.latest(project.id));
      if (!configuration) return structuredClone(defaultMaterialRules);
      const required = configuration.requirements.map((requirement) => ({
        kind: requirement.kind,
        defaultTitle: requirement.label,
        required: requirement.required,
        formats: Object.values(fileFormats).filter((format) => requirement.allowedMimeTypes.includes(format.mimeType)),
        maxSizeBytes: requirement.maxSizeBytes,
        dueAt: requirement.dueAt,
      }));
      return [...required, ...structuredClone(defaultMaterialRules.filter((rule) => rule.kind === "OUTRO"))];
    },
  };
}
