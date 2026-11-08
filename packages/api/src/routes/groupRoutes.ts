import { Router } from "express";
import { createGroupController } from "../controllers/groupController.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { GroupRepository } from "../repositories/groupRepository.js";

export function createGroupRouter(
  projects: ProjectRepository,
  auth: AuthRepository,
  planning: GroupRepository,
  now: () => number,
) {
  const router = Router();
  const controller = createGroupController(projects, auth, planning, now);
  router.get("/classes/:classId/administration", controller.administration);
  router.post("/classes/:classId/groups", controller.createGroup);
  router.put("/classes/:classId/groups/:groupId/members", controller.members);
  router.get("/projects/:projectId/evaluators", controller.evaluators);
  router.put("/projects/:projectId/evaluators", controller.setEvaluators);
  return router;
}
