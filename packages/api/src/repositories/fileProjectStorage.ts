import { publicationHistorySchema } from "../models/publicationDecision.js";
import {
  constants,
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { roles } from "../models/auth.js";
import { materialKinds, projectStatuses } from "../models/project.js";
import { submissionSchema } from "../models/submission.js";
import { ProjectStorage } from "./projectRepository.js";

const id = z.number().int().positive();
const timestamp = z.iso.datetime();
const snapshotSchema = z.object({
  publicationDecisions: publicationHistorySchema.optional(),
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
      createdBy: id,
      createdAt: timestamp,
      versions: z
        .array(
          z.object({
            id,
            materialId: id,
            versionNumber: id,
            originalFilename: z.string(),
            mimeType: z.string(),
            sizeBytes: z.number().nonnegative(),
            storageKey: z.string(),
            checksumSha256: z.string().nullable(),
            uploadedBy: id,
            uploadedAt: timestamp,
          }),
        )
        .min(1),
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
  // Arquivos gravados antes da HU05 não têm rodadas; carregam com lista vazia.
  submissions: z.array(submissionSchema).default([]),
});

// Formato anterior à HU04: uma linha por versão, só metadados, sem bytes gravados.
const legacySnapshotSchema = snapshotSchema.extend({
  materials: z.array(
    z.object({ id, projectId: id, versionNumber: id, storageKey: z.string() }),
  ),
});
const isLegacy = (data: unknown) =>
  (data as { materials?: unknown[] } | null)?.materials?.some(
    (item) => !(item as { versions?: unknown }).versions,
  ) ?? false;

/**
 * Copia o arquivo antigo para `<path>.legacy-backup` e descarta os materiais,
 * que nunca tiveram arquivo. Projetos e mensagens são mantidos.
 */
function migrateLegacy(path: string, data: unknown) {
  const { projects, messages, submissions, publicationDecisions } =
    legacySnapshotSchema.parse(data);
  const backup = `${path}.legacy-backup`;
  try {
    copyFileSync(path, backup, constants.COPYFILE_EXCL);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (!readFileSync(backup).equals(readFileSync(path)))
      throw new Error(`Backup divergente já existe em ${backup}.`);
  }
  return {
    projects,
    materials: [],
    messages,
    submissions,
    ...(publicationDecisions ? { publicationDecisions } : {}),
  };
}

// Um único processo escritor. A troca por rename evita snapshots parcialmente escritos.
export function createFileProjectStorage(path: string): ProjectStorage {
  return {
    load() {
      try {
        const data: unknown = JSON.parse(readFileSync(path, "utf8"));
        return isLegacy(data)
          ? migrateLegacy(path, data)
          : snapshotSchema.parse(data);
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
