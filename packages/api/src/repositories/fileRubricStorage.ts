import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { rubricSnapshotSchema } from "../models/rubric.js";
import { RubricStorage } from "./rubricRepository.js";

export function createFileRubricStorage(path: string): RubricStorage {
  return {
    load() {
      try {
        return rubricSnapshotSchema.parse(JSON.parse(readFileSync(path, "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    save(value) {
      const snapshot = rubricSnapshotSchema.parse(value);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(`${path}.tmp`, JSON.stringify(snapshot), { mode: 0o600, flush: true });
      renameSync(`${path}.tmp`, path);
    },
  };
}
