import express from "express";
import { ZodError } from "zod";
import { ApiError } from "./errors.js";
import { createMemoryProjectRepository, ProjectRepository } from "./repositories/projectRepository.js";
import { createProjectRouter } from "./routes/projectRoutes.js";

export interface AppOptions {
  repository?: ProjectRepository;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const repository = options.repository ?? createMemoryProjectRepository();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({ data: { status: "ok" } });
  });

  app.use("/api", createProjectRouter(repository));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "ROUTE_NOT_FOUND", message: "Rota não encontrada." },
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "A requisição contém dados inválidos.",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      });
      return;
    }

    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({
        error: { code: "INVALID_JSON", message: "O corpo da requisição deve ser um JSON válido." },
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Ocorreu um erro interno." },
    });
  });

  return app;
}
