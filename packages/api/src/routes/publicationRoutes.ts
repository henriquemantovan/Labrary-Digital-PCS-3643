import { Router } from "express";
import { createPublicationController } from "../controllers/publicationController.js";
import { PublicationService } from "../services/publicationService.js";
import { FileStorage } from "../services/fileStorage.js";
export function createPublicationRouter(
  service: PublicationService,
  storage: FileStorage,
) {
  const router = Router(),
    controller = createPublicationController(service, storage);
  router.get("/projects/:projectId/publication", controller.management);
  router.post("/projects/:projectId/finalization", controller.finalize);
  router.post("/projects/:projectId/publication", controller.publish);
  router.delete("/projects/:projectId/publication", controller.withdraw);
  router.get("/catalog", controller.list);
  router.get("/catalog/:projectId", controller.get);
  router.get("/catalog/:projectId/materials/:versionId/file", controller.file);
  return router;
}
