import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

const id = z.number().int().positive().safe();
const releaseSchema = z.object({
  projectId: id, submissionId: id, round: id,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), releasedBy: id, releasedAt: z.iso.datetime(),
}).strict();
export type ResultRelease = z.infer<typeof releaseSchema>;
export interface ResultReleaseRepository {
  find(projectId: number, fingerprint: string): ResultRelease | undefined;
  release(value: ResultRelease): ResultRelease;
}

/** Arquivo privado separado dos snapshots HU07; um único processo escritor. */
export function createResultReleaseRepository(path?: string): ResultReleaseRepository {
  let releases: ResultRelease[] = [];
  if (path) {
    try { releases = z.array(releaseSchema).parse(JSON.parse(readFileSync(path, "utf8"))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return {
    find(projectId, fingerprint) {
      return structuredClone(releases.find(r => r.projectId === projectId && r.fingerprint === fingerprint));
    },
    release(value) {
      const parsed = releaseSchema.parse(value);
      const existing = releases.find(r => r.projectId === parsed.projectId && r.fingerprint === parsed.fingerprint);
      if (existing) return structuredClone(existing);
      const next = [...releases, parsed];
      if (path) {
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        writeFileSync(`${path}.tmp`, JSON.stringify(next), { mode: 0o600, flush: true });
        renameSync(`${path}.tmp`, path);
      }
      releases = next;
      return structuredClone(parsed);
    },
  };
}
