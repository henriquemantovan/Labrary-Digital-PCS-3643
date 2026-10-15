import { AuthRepository } from "../repositories/authRepository.js";
import { Router } from "express";
import { createProjectController } from "../controllers/projectController.js";
import { ProjectRepository } from "../repositories/projectRepository.js";

export function createProjectRouter(
  repository: ProjectRepository,
  auth: AuthRepository,
) {
  const router = Router();
  const controller = createProjectController(repository, auth);

  router.get("/projects", controller.list);
  router.post("/projects", controller.create);
  router.get("/projects/:projectId", controller.get);
  router.get("/projects/:projectId/materials", controller.listMaterials);
  router.post("/projects/:projectId/materials", controller.createMaterial);

  return router;
}
