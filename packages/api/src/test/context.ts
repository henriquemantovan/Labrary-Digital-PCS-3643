import request from "supertest";
import { createApp, AppOptions } from "../app.js";
import { createDemoDirectory } from "../fixtures/demo.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { MaterialKind } from "../models/project.js";
import {
  createMemoryProjectRepository,
  ProjectRepository,
} from "../repositories/projectRepository.js";

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
    if (typeof token !== "string")
      throw new Error(
        "Use request.agent para testar sessões assíncronas PostgreSQL.",
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

/** Versão gravada direto no repositório, sem passar pelas rotas. */
export const versionInput = {
  originalFilename: "relatorio.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2400,
  storageKey: "mock/teste",
  checksumSha256: null,
  uploadedBy: 1,
};
export const storedMaterial = (
  repository: ProjectRepository,
  projectId: number,
  material: { kind?: MaterialKind; title?: string } = {},
) =>
  repository.createMaterial(
    projectId,
    {
      kind: "RELATORIO",
      title: "Relatório técnico",
      createdBy: 1,
      ...material,
    },
    versionInput,
  );
