import { createPublicationService } from "./services/publicationService.js";
import { PublicationProviders } from "./services/publicationProviders.js";
import { createPublicationRouter } from "./routes/publicationRoutes.js";
import { createGroupRouter } from "./routes/groupRoutes.js";
import { createRubricRouter } from "./routes/rubricRoutes.js";
import {
  createMemoryRubricRepository,
  RubricRepository,
} from "./repositories/rubricRepository.js";
import { createRubricMaterialPolicy } from "./services/rubricMaterialPolicy.js";
import {
  createMemoryGroupRepository,
  GroupRepository,
} from "./repositories/groupRepository.js";
import express from "express";
import { ZodError } from "zod";
import {
  createAuthRepository,
  AuthRepository,
} from "./repositories/authRepository.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { protectMutations, requireAuth } from "./middleware/auth.js";
import { ApiError } from "./errors.js";
import {
  createMemoryProjectRepository,
  ProjectRepository,
} from "./repositories/projectRepository.js";
import { createProjectRouter } from "./routes/projectRoutes.js";
import { MaterialPolicy } from "./services/materialPolicy.js";
import { createDiskStorage, FileStorage } from "./services/fileStorage.js";

import { GoogleAuthOptions } from "./controllers/googleAuthController.js";

import { createAdminRouter } from "./routes/adminRoutes.js";
import {
  AdminRepository,
  createMemoryAdminRepository,
} from "./repositories/adminRepository.js";

export interface AppOptions {
  publicationProviders?: PublicationProviders;
  rubrics?: RubricRepository;
  groups?: GroupRepository;
  admin?: AdminRepository;
  google?: GoogleAuthOptions;
  localLogin?: boolean;
  repository?: ProjectRepository;
  auth?: AuthRepository;
  now?: () => number;
  secureCookies?: boolean;
  origin?: string;
  sessionTtlMs?: number;
  loginLimit?: number;
  materialPolicy?: MaterialPolicy;
  storage?: FileStorage;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const repository =
    options.repository ?? createMemoryProjectRepository(!options.google);

  const auth = options.auth ?? createAuthRepository();
  const now = options.now ?? Date.now;
  const storage = options.storage ?? createDiskStorage(".uploads");
  const rubrics = options.rubrics ?? createMemoryRubricRepository();
  app.disable("x-powered-by");
  app.use("/api", (_request, response, next) => {
    response.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  app.use("/api", protectMutations(options.origin ?? "http://localhost:5173"));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ data: { status: "ok" } });
  });

  app.use(
    "/api",
    createAuthRouter(auth, {
      google: options.google,
      localLogin: options.localLogin ?? !options.google,
      now,
      secureCookies: options.secureCookies ?? false,
      sessionTtlMs: options.sessionTtlMs ?? 8 * 60 * 60_000,
      loginLimit: options.loginLimit ?? 20,
    }),
  );
  app.use(
    "/api/admin",
    createAdminRouter(
      auth,
      options.admin ?? createMemoryAdminRepository(auth),
      now,
    ),
  );
  app.use("/api/classes", requireAuth(auth, now));
  app.use("/api/projects", requireAuth(auth, now));
  app.use(
    "/api",
    createPublicationRouter(
      createPublicationService(
        repository,
        auth,
        storage,
        now,
        options.publicationProviders,
      ),
      storage,
    ),
  );
  app.use("/api", createRubricRouter(repository, auth, rubrics, now));
  app.use(
    "/api",
    createGroupRouter(
      repository,
      auth,
      options.groups ?? createMemoryGroupRepository(auth.directory),
      now,
    ),
  );
  app.use(
    "/api",
    createProjectRouter(repository, auth, {
      now,
      materialPolicy:
        options.materialPolicy ?? createRubricMaterialPolicy(rubrics),
      storage,
    }),
  );

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "ROUTE_NOT_FOUND", message: "Rota não encontrada." },
    });
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "A requisição contém dados inválidos.",
            details: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        });
        return;
      }

      if (error instanceof ApiError) {
        response
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
        return;
      }

      if (error instanceof SyntaxError && "body" in error) {
        response.status(400).json({
          error: {
            code: "INVALID_JSON",
            message: "O corpo da requisição deve ser um JSON válido.",
          },
        });
        return;
      }

      console.error(error);
      response.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Ocorreu um erro interno." },
      });
    },
  );

  return app;
}
