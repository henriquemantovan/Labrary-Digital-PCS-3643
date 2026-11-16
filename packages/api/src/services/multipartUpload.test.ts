import { afterEach, describe, expect, it } from "vitest";
import { Request } from "express";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { createDiskStorage } from "./fileStorage.js";
import { cleanFilename, receiveUpload } from "./multipartUpload.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("recebimento multipart", () => {
  it("limpa o nome exibido do arquivo", () => {
    expect(cleanFilename("C:\\Users\\aluno\\relatório final.pdf")).toBe(
      "relatório final.pdf",
    );
    expect(cleanFilename("../../etc/passwd")).toBe("passwd");
    expect(cleanFilename("a\u0000b\u001f\u007fc.pdf")).toBe("abc.pdf");
    expect(cleanFilename("  muito    espaço .pdf ")).toBe("muito espaço .pdf");
    expect(cleanFilename("")).toBe("arquivo");
    expect(cleanFilename(`${"a".repeat(300)}.pdf`)).toHaveLength(255);
    expect(cleanFilename(`${"a".repeat(300)}.pdf`).endsWith(".pdf")).toBe(true);
  });
  it("descarta o arquivo parcial quando o cliente interrompe o envio", async () => {
    const root = await mkdtemp(join(tmpdir(), "labrary-multipart-"));
    roots.push(root);
    const storage = createDiskStorage(root);
    const request = Object.assign(new PassThrough(), {
      headers: { "content-type": "multipart/form-data; boundary=limite" },
      complete: false,
    });
    const received = receiveUpload(request as unknown as Request, storage, {
      maxBytes: () => 1_000,
    });
    request.write(
      '--limite\r\nContent-Disposition: form-data; name="file"; filename="r.pdf"\r\n\r\n%PDF-1.7 parte',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    request.emit("close");
    await expect(received).rejects.toMatchObject({
      code: "INVALID_MULTIPART",
    });
    expect(await readdir(root)).toEqual([]);
  });
});
