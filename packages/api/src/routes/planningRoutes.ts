import { Router } from "express";
import { createPlanningController } from "../controllers/planningController.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { ProjectRepository } from "../repositories/projectRepository.js";
import { PlanningRepository } from "../repositories/planningRepository.js";

export function createPlanningRouter(
  projects: ProjectRepository,
  auth: AuthRepository,
  planning: PlanningRepository,
  now: () => number,
) {
  const router = Router();
  const controller = createPlanningController(projects, auth, planning, now);
  router.get("/classes/:classId/administration", controller.administration);
  router.post("/classes/:classId/groups", controller.createGroup);
  router.put("/classes/:classId/groups/:groupId/members", controller.members);
  router.get("/projects/:projectId/evaluators", controller.evaluators);
  router.put("/projects/:projectId/evaluators", controller.setEvaluators);
  router.get("/projects/:projectId/requirements", controller.requirements);
  router.put("/projects/:projectId/requirements", controller.setRequirements);
  router.get("/projects/:projectId/rubrics", controller.rubrics);
  router.post("/projects/:projectId/rubrics", controller.createRubric);
  return router;
}
