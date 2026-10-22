import { afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp, AppOptions } from "../app.js";
import { createDemoDirectory } from "../fixtures/demo.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createMemoryProjectRepository } from "../repositories/projectRepository.js";
import { createDiskStorage } from "../services/fileStorage.js";

const uploadsRoot = mkdtempSync(join(tmpdir(), "labrary-uploads-"));
afterAll(() => rmSync(uploadsRoot, { recursive: true, force: true }));
let nextUploadDir = 1;

const demo = await createDemoDirectory();
export function context(options: AppOptions = {}) {
  const auth = options.auth ?? createAuthRepository(structuredClone(demo));
  const repository = options.repository ?? createMemoryProjectRepository();
  const uploadDir = join(uploadsRoot, String(nextUploadDir++));
  const storage = options.storage ?? createDiskStorage(uploadDir);
  const app = createApp({ auth, repository, storage, ...options });
  const client = (userId: number) => {
    const token = auth.createSession(
      userId,
      (options.now ?? Date.now)(),
      options.sessionTtlMs ?? 60_000,
    );
    return {
      get: (path: string) =>
        request(app).get(path).set("Cookie", `labrary_session=${token}`),
      post: (path: string) =>
        request(app)
          .post(path)
          .set("Cookie", `labrary_session=${token}`)
          .set("X-CSRF-Protection", "1"),
    };
  };
  const login = (
    email = "aluno@labrary.local",
    password = "Labrary@2026",
    cookie?: string,
  ) => {
    const req = request(app)
      .post("/api/auth/login")
      .set("X-CSRF-Protection", "1");
    if (cookie) req.set("Cookie", cookie);
    return req.send({ email, password });
  };
  return { app, auth, repository, storage, uploadDir, client, login };
}
export const projectInput = {
  classId: 1,
  groupId: 3,
  title: "Contador síncrono",
  category: "Lógica digital",
};
export const materialInput = { kind: "RELATORIO", title: "Relatório técnico" };

/** Conteúdos mínimos com a assinatura real de cada formato. */
export const sampleFiles = {
  pdf: Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n"),
  mp4: Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from("ftypisom"),
    Buffer.alloc(24, 1),
  ]),
  webm: Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.alloc(24),
  ]),
  zip: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(24)]),
  png: Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(24),
  ]),
  jpeg: Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(24),
  ]),
  text: Buffer.from("isto não é um PDF de verdade"),
};

type Client = ReturnType<ReturnType<typeof context>["client"]>;
export function upload(
  actor: Client,
  path: string,
  fields: Record<string, string>,
  file?: { content: Buffer; filename: string },
) {
  let req = actor.post(path);
  for (const [name, value] of Object.entries(fields))
    req = req.field(name, value);
  if (file) req = req.attach("file", file.content, file.filename);
  return req;
}
export const pdfFile = (filename = "relatorio.pdf") => ({
  content: sampleFiles.pdf,
  filename,
});
