import busboy from "busboy";
import { Request } from "express";
import { PassThrough } from "node:stream";
import { ApiError } from "../errors.js";
import { FileStorage, StoredFile } from "./fileStorage.js";

export interface ReceivedUpload {
  fields: Record<string, string>;
  file: StoredFile & { originalFilename: string };
}

export interface ReceiveOptions {
  /**
   * Chamado quando o arquivo começa a chegar, com os campos recebidos antes
   * dele; devolve o limite de bytes ou lança erro para recusar o envio.
   */
  maxBytes(fields: Record<string, string>): number;
}

const fieldName = "file";
/** Folga para cabeçalhos e campos de texto do multipart. */
export const multipartOverheadBytes = 64 * 1024;

const badRequest = (code: string, message: string) =>
  new ApiError(400, code, message);

export function cleanFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  // Remove caracteres de controle e espaços repetidos do nome exibido.
  const clean = [...base]
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(-255) || "arquivo";
}

/** Recusa antes de ler o corpo quando o tamanho declarado já excede o limite. */
export function assertDeclaredLength(request: Request, maxBytes: number) {
  const declared = Number(request.get("Content-Length"));
  if (declared > maxBytes + multipartOverheadBytes)
    throw new ApiError(
      413,
      "FILE_TOO_LARGE",
      "O arquivo excede o tamanho permitido.",
    );
}

/**
 * Lê um `multipart/form-data` com um único arquivo no campo `file`, gravando-o
 * em streaming no armazenamento. Em qualquer falha o arquivo já gravado é
 * removido e o restante do corpo é descartado antes de responder.
 */
export function receiveUpload(
  request: Request,
  storage: FileStorage,
  options: ReceiveOptions,
): Promise<ReceivedUpload> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: request.headers,
        // Navegadores enviam o nome do arquivo em UTF-8 (padrão do busboy: latin1).
        defParamCharset: "utf8",
        limits: { files: 1, fields: 8, fieldSize: 1024, parts: 9 },
      });
    } catch {
      reject(
        badRequest(
          "MULTIPART_REQUIRED",
          "Envie o arquivo como multipart/form-data.",
        ),
      );
      return;
    }
    const fields: Record<string, string> = {};
    let failure: unknown;
    let saving: Promise<ReceivedUpload["file"] | undefined> | undefined;
    let relay: PassThrough | undefined;
    const fail = (error: unknown) => {
      failure ??= error;
    };

    parser.on("field", (name, value, info) => {
      if (info.nameTruncated || info.valueTruncated)
        fail(badRequest("FIELD_TOO_LONG", "Um dos campos é longo demais."));
      else fields[name] = value;
    });
    parser.on("file", (name, stream, info) => {
      if (name !== fieldName || saving || failure !== undefined) {
        if (name !== fieldName)
          fail(badRequest("UNEXPECTED_FILE", "Envie o arquivo no campo file."));
        stream.resume();
        return;
      }
      let maxBytes: number;
      try {
        maxBytes = options.maxBytes(fields);
      } catch (error) {
        fail(error);
        stream.resume();
        return;
      }
      // O PassThrough isola o stream do busboy: se a gravação falhar, o
      // restante do arquivo é descartado sem interromper a leitura do corpo.
      relay = new PassThrough();
      // A falha já chega pela gravação; evita erro sem ouvinte após o fim dela.
      relay.on("error", () => undefined);
      stream.on("error", (error) => relay!.destroy(error));
      stream.pipe(relay);
      saving = storage.save(relay, { maxBytes }).then(
        (stored) => ({
          ...stored,
          originalFilename: cleanFilename(info.filename),
        }),
        (error) => {
          fail(error);
          stream.unpipe(relay!);
          stream.resume();
          return undefined;
        },
      );
    });
    parser.on("filesLimit", () =>
      fail(badRequest("TOO_MANY_FILES", "Envie apenas um arquivo por vez.")),
    );
    parser.on("fieldsLimit", () =>
      fail(badRequest("TOO_MANY_FIELDS", "A requisição tem campos demais.")),
    );
    parser.on("partsLimit", () =>
      fail(badRequest("TOO_MANY_FIELDS", "A requisição tem campos demais.")),
    );

    let finished = false;
    const finish = async (error?: unknown) => {
      if (finished) return;
      finished = true;
      if (error !== undefined) fail(error);
      const file = await saving;
      if (failure !== undefined) {
        if (file) await storage.remove(file.storageKey);
        reject(failure);
      } else if (!file) {
        reject(
          badRequest("FILE_REQUIRED", "Selecione um arquivo para enviar."),
        );
      } else {
        resolve({ fields, file });
      }
    };
    parser.on("close", () => void finish());
    parser.on("error", (error) => {
      request.unpipe(parser);
      request.resume();
      relay?.destroy(error as Error);
      void finish(
        badRequest(
          "INVALID_MULTIPART",
          "O envio do arquivo está incompleto ou malformado.",
        ),
      );
    });
    request.on("close", () => {
      if (!request.complete) parser.destroy(new Error("Envio interrompido."));
    });
    request.pipe(parser);
  });
}
