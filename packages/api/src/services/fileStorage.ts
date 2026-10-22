import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ApiError } from "../errors.js";

/** Bytes iniciais guardados para identificar o formato real do arquivo. */
export const signatureLength = 16;

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  checksumSha256: string;
  signature: Buffer;
}

export interface StoredFileStream {
  stream: Readable;
  sizeBytes: number;
}

export interface FileStorage {
  save(source: Readable, options: { maxBytes: number }): Promise<StoredFile>;
  open(storageKey: string): Promise<StoredFileStream | undefined>;
  remove(storageKey: string): Promise<void>;
}

const storageKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const fileTooLarge = () =>
  new ApiError(413, "FILE_TOO_LARGE", "O arquivo excede o tamanho permitido.");

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === "ENOENT";

/**
 * Arquivos ficam fora de qualquer pasta servida pela web e só são lidos pela
 * API depois da checagem de permissão. A chave é um UUID gerado aqui; o nome
 * enviado pelo usuário nunca vira caminho no disco.
 */
export function createDiskStorage(root: string): FileStorage {
  const pathOf = (storageKey: string) => {
    if (!storageKeyPattern.test(storageKey)) return undefined;
    return join(root, storageKey);
  };

  return {
    async save(source, { maxBytes }) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const storageKey = randomUUID();
      const finalPath = join(root, storageKey);
      const partialPath = `${finalPath}.part`;
      const hash = createHash("sha256");
      const head: Buffer[] = [];
      let headLength = 0;
      let sizeBytes = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          sizeBytes += chunk.length;
          if (sizeBytes > maxBytes) {
            callback(fileTooLarge());
            return;
          }
          if (headLength < signatureLength) {
            head.push(chunk.subarray(0, signatureLength - headLength));
            headLength += head[head.length - 1].length;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      try {
        await pipeline(
          source,
          meter,
          createWriteStream(partialPath, { flags: "wx", mode: 0o600 }),
        );
        await rename(partialPath, finalPath);
      } catch (error) {
        await unlink(partialPath).catch(() => undefined);
        throw error;
      }
      return {
        storageKey,
        sizeBytes,
        checksumSha256: hash.digest("hex"),
        signature: Buffer.concat(head),
      };
    },

    async open(storageKey) {
      const path = pathOf(storageKey);
      if (!path) return undefined;
      try {
        const { size } = await stat(path);
        return { stream: createReadStream(path), sizeBytes: size };
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },

    async remove(storageKey) {
      const path = pathOf(storageKey);
      if (!path) return;
      await unlink(path).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    },
  };
}
