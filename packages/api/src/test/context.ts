import request from "supertest";
import { createApp, AppOptions } from "../app.js";
import { createDemoDirectory } from "../fixtures/demo.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createMemoryProjectRepository } from "../repositories/projectRepository.js";

const demo = await createDemoDirectory();
export function context(options: AppOptions = {}) {
  const auth = options.auth ?? createAuthRepository(structuredClone(demo));
  const repository = options.repository ?? createMemoryProjectRepository();
  const app = createApp({ auth, repository, ...options });
  const client = (userId: number) => {
    const token = auth.createSession(
      userId,
      (options.now ?? Date.now)(),
      options.sessionTtlMs ?? 60_000,
    );
    return {
      get: (path: string) =>
        request(app).get(path).set("Cookie", `labrary_session=${token}`),
      put: (path: string) =>
        request(app)
          .put(path)
          .set("Cookie", `labrary_session=${token}`)
          .set("X-CSRF-Protection", "1"),
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
  return { app, auth, repository, client, login };
}
export const projectInput = {
  classId: 1,
  groupId: 3,
  title: "Contador síncrono",
  category: "Lógica digital",
};
export const materialInput = {
  kind: "RELATORIO",
  title: "Relatório técnico",
  originalFilename: "relatorio.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2400,
};
