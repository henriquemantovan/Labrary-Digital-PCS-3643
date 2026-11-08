import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { GroupStorage } from "./groupRepository.js";
const id = z.number().int().positive().safe();
const snapshot = z.object({
  groups: z.array(
    z.object({
      id,
      classId: id,
      name: z.string().min(1),
      memberIds: z.array(id),
    }),
  ),
  assignments: z.array(z.object({ projectId: id, evaluatorId: id })),
  changes: z.array(
    z.object({
      target: z.enum(["GROUP", "PROJECT"]),
      targetId: id,
      before: z.array(id),
      after: z.array(id),
      changedBy: id,
      changedAt: z.iso.datetime(),
    }),
  ),
});
// Um processo escritor; contas e credenciais permanecem no diretório de origem.
export function createFileGroupStorage(path: string): GroupStorage {
  return {
    load() {
      try {
        return snapshot.parse(JSON.parse(readFileSync(path, "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return undefined;
        throw error;
      }
    },
    save(value) {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(`${path}.tmp`, JSON.stringify(value), {
        mode: 0o600,
        flush: true,
      });
      renameSync(`${path}.tmp`, path);
    },
  };
}
