import { createMessageController } from "../controllers/messageController.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { Router } from "express";
import { createProjectController } from "../controllers/projectController.js";
import { ProjectRepository } from "../repositories/projectRepository.js";

export function createProjectRouter(
  repository: ProjectRepository,
  auth: AuthRepository,
  now: () => number = Date.now,
) {
  const router = Router();
  const controller = createProjectController(repository, auth);

  router.get("/projects", controller.list);
  router.post("/projects", controller.create);
  router.get("/projects/:projectId", controller.get);
  router.get("/projects/:projectId/materials", controller.listMaterials);
  router.post("/projects/:projectId/materials", controller.createMaterial);
  router.post(
    "/projects/:projectId/materials/:materialId/versions",
    controller.createVersion,
  );

  const messages = createMessageController(repository, auth, now);
  router.get("/projects/:projectId/messages", messages.list);
  router.post("/projects/:projectId/messages", messages.create);

  return router;
}
