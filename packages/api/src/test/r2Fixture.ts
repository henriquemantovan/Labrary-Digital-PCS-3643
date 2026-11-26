import { createServer } from "node:http";
import { buffer } from "node:stream/consumers";
import { S3Client } from "@aws-sdk/client-s3";

/** Transporte S3 local: testa o SDK e os bytes reais sem acessar a nuvem. */
export async function r2Fixture() {
  const objects = new Map<
    string,
    { bytes: Buffer; size: number; etag: string; sha256?: string }
  >();
  const calls: {
    method: string;
    key: string;
    range?: string;
    authorization?: string;
    storageClass?: string;
  }[] = [];
  const control = {
    failMethod: "",
    invalidPagination: false,
    invalidSize: false,
    missingEtag: false,
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const key = decodeURIComponent(url.pathname.replace(/^\/materiais\/?/, ""));
    calls.push({
      method: request.method!,
      key,
      range: request.headers.range,
      authorization: request.headers.authorization,
      storageClass: request.headers["x-amz-storage-class"] as
        | string
        | undefined,
    });
    if (request.method === control.failMethod) {
      await buffer(request);
      response.writeHead(503, { "Content-Type": "application/xml" });
      response.end("<Error><Code>ServiceUnavailable</Code></Error>");
      return;
    }
    if (url.searchParams.has("list-type")) {
      const offset = Number(url.searchParams.get("continuation-token") ?? 0);
      const entries = [...objects];
      const item = entries[offset];
      const truncated =
        control.invalidPagination || offset + 1 < entries.length;
      response.setHeader("Content-Type", "application/xml");
      response.end(
        `<ListBucketResult><IsTruncated>${truncated}</IsTruncated>${truncated && !control.invalidPagination ? `<NextContinuationToken>${offset + 1}</NextContinuationToken>` : ""}${item ? `<Contents><Key>${item[0]}</Key><Size>${control.invalidSize ? -1 : item[1].size}</Size></Contents>` : ""}</ListBucketResult>`,
      );
      return;
    }
    if (request.method === "PUT") {
      const bytes = await buffer(request);
      objects.set(key, {
        bytes,
        size: bytes.length,
        etag: `"${bytes.toString("hex")}"`,
        sha256: request.headers["x-amz-meta-sha256"] as string | undefined,
      });
      response.end();
      return;
    }
    if (request.method === "DELETE") {
      objects.delete(key);
      response.writeHead(204).end();
      return;
    }
    const object = objects.get(key);
    if (!object) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Content-Length", object.bytes.length);
    if (!control.missingEtag) response.setHeader("ETag", object.etag);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    if (request.headers["if-match"] !== object.etag) {
      response.removeHeader("Content-Length");
      response.writeHead(412).end();
      return;
    }
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
    const bytes = range
      ? object.bytes.subarray(Number(range[1]), Number(range[2]) + 1)
      : object.bytes;
    response.setHeader("Content-Length", bytes.length);
    response.writeHead(range ? 206 : 200).end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const client = new S3Client({
    region: "auto",
    endpoint: `http://127.0.0.1:${port}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: "chave-de-teste",
      secretAccessKey: "segredo-de-teste",
    },
    maxAttempts: 1,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return {
    client,
    objects,
    calls,
    control,
    async close() {
      client.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
