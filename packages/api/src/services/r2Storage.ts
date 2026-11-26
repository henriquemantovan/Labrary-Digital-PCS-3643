import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { ApiError } from "../errors.js";
import { createDiskStorage, type FileStorage } from "./fileStorage.js";

export const r2StorageLimitBytes = 9_000_000_000;
const validKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const missing = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode === 404;
const unavailable = () =>
  new ApiError(
    503,
    "STORAGE_UNAVAILABLE",
    "O armazenamento dos arquivos está indisponível. Tente novamente mais tarde.",
  );

export function createR2Storage(options: {
  client: S3Client;
  bucket: string;
  reserve(operation: "A" | "B"): void | Promise<void>;
  temporaryRoot?: string;
}): FileStorage {
  const { client, bucket, reserve } = options;
  // Serializa verificações de capacidade e uploads nesta instância.
  let writer = Promise.resolve();
  async function serialize<T>(action: () => Promise<T>): Promise<T> {
    const previous = writer;
    let release!: () => void;
    writer = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }
  async function usedBytes() {
    let bytes = 0;
    let continuation: string | undefined;
    const tokens = new Set<string>();
    do {
      await reserve("A");
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuation,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (!Number.isSafeInteger(item.Size) || item.Size! < 0)
          throw unavailable();
        bytes += item.Size!;
        if (!Number.isSafeInteger(bytes)) throw unavailable();
      }
      continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && (!continuation || tokens.has(continuation)))
        throw unavailable();
      if (continuation) tokens.add(continuation);
    } while (continuation);
    return bytes;
  }
  async function remote<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw unavailable();
    }
  }
  return {
    async save(source, { maxBytes }) {
      const root = await mkdtemp(
        join(options.temporaryRoot ?? tmpdir(), "labrary-r2-"),
      );
      try {
        // Arquivo temporário limitado; não carrega um vídeo inteiro na RAM e
        // não inicia upload remoto de um corpo interrompido ou grande demais.
        const staging = createDiskStorage(root);
        const stored = await staging.save(source, {
          maxBytes: Math.min(maxBytes, 5_000_000_000),
        });
        return await remote(() =>
          serialize(async () => {
            if ((await usedBytes()) + stored.sizeBytes > r2StorageLimitBytes)
              throw new ApiError(
                507,
                "STORAGE_CAPACITY_LIMIT",
                "O limite de armazenamento dos arquivos foi atingido. Contate o administrador.",
              );
            await reserve("A");
            const file = (await staging.open(stored.storageKey))!;
            file.stream.on("error", () => undefined);
            try {
              await client.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: stored.storageKey,
                  Body: file.stream,
                  ContentLength: stored.sizeBytes,
                  ContentType: "application/octet-stream",
                  StorageClass: "STANDARD",
                  Metadata: { sha256: stored.checksumSha256 },
                }),
              );
            } finally {
              file.stream.destroy();
            }
            return stored;
          }),
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    async open(storageKey, range) {
      if (!validKey.test(storageKey)) return undefined;
      return remote(async () => {
        await reserve("B");
        const head = await client
          .send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }))
          .catch((error) => {
            if (missing(error)) return undefined;
            throw error;
          });
        if (!head) return undefined;
        if (
          !Number.isSafeInteger(head.ContentLength) ||
          head.ContentLength! < 0 ||
          !head.ETag
        )
          throw unavailable();
        // Reserva antes de devolver o stream, para a API ainda poder responder
        // 503 quando a cota acabar. HEAD pode reservar mais que o uso real.
        await reserve("B");
        const abort = new AbortController();
        const stream = Readable.from(
          (async function* () {
            let body: Readable | undefined;
            try {
              const file = await client.send(
                new GetObjectCommand({
                  Bucket: bucket,
                  Key: storageKey,
                  IfMatch: head.ETag,
                  ...(range
                    ? { Range: `bytes=${range.start}-${range.end}` }
                    : {}),
                }),
                { abortSignal: abort.signal },
              );
              if (!(file.Body instanceof Readable)) throw unavailable();
              body = file.Body;
              for await (const chunk of body) yield chunk;
            } catch (error) {
              if (error instanceof ApiError) throw error;
              throw unavailable();
            } finally {
              body?.destroy();
            }
          })(),
        );
        // HEAD, verificações de publicação e Range descartam o stream inicial
        // sem baixar o vídeo inteiro. Cancela também uma leitura em andamento.
        stream.once("close", () => abort.abort());
        return { stream, sizeBytes: head.ContentLength! };
      });
    },
    async remove(storageKey) {
      if (!validKey.test(storageKey)) return;
      // DeleteObject é gratuito no R2. Falha de remoção não é ocultada;
      // objetos restantes continuam entrando no cálculo da capacidade.
      await remote(() =>
        serialize(async () => {
          await client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
          );
        }),
      );
    },
  };
}
