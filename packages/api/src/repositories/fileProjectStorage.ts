import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { roles } from "../models/auth.js";
import { materialKinds, projectStatuses } from "../models/project.js";
import { ProjectStorage } from "./projectRepository.js";

const id = z.number().int().positive();
const timestamp = z.iso.datetime();
const snapshotSchema = z.object({
  projects: z.array(
    z.object({
      id,
      classId: id,
      groupId: id,
      title: z.string(),
      description: z.string(),
      category: z.string(),
      status: z.enum(projectStatuses),
      dueAt: timestamp.nullable(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ),
  materials: z.array(
    z.object({
      id,
      projectId: id,
      title: z.string(),
      kind: z.enum(materialKinds),
      versionNumber: id,
      originalFilename: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().nonnegative(),
      storageKey: z.string(),
      uploadedAt: timestamp,
    }),
  ),
  messages: z.array(
    z.object({
      id,
      projectId: id,
      clientMessageId: z.uuid(),
      body: z.string().min(1).max(5000),
      createdAt: timestamp,
      author: z.object({
        id,
        fullName: z.string(),
        role: z.enum(roles),
      }),
      materialVersion: z
        .object({ id, title: z.string(), versionNumber: id })
        .nullable(),
    }),
  ),
});

// Um único processo escritor. A troca por rename evita snapshots parcialmente escritos.
export function createFileProjectStorage(path: string): ProjectStorage {
  return {
    load() {
      try {
        return snapshotSchema.parse(JSON.parse(readFileSync(path, "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return undefined;
        throw error;
      }
    },
    save(snapshot) {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.tmp`;
      writeFileSync(temporary, JSON.stringify(snapshot), {
        mode: 0o600,
        flush: true,
      });
      renameSync(temporary, path);
    },
  };
}
