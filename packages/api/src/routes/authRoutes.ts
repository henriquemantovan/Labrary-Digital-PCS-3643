import { Router } from "express";
import {
  AuthOptions,
  createAuthController,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";

export function createAuthRouter(auth: AuthRepository, options: AuthOptions) {
  const router = Router();
  const controller = createAuthController(auth, options);
  router.post("/auth/login", controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", requireAuth(auth, options.now), controller.me);
  router.get("/scope", requireAuth(auth, options.now), controller.scope);
  return router;
}
