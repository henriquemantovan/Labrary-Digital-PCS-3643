import { Router } from "express";
import {
  AuthOptions,
  createAuthController,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";

import { createUspAuthController } from "../controllers/uspAuthController.js";

export function createAuthRouter(auth: AuthRepository, options: AuthOptions) {
  const router = Router();
  const controller = createAuthController(auth, options);
  router.get("/auth/providers", (_request, response) =>
    response.json({
      data: { usp: Boolean(options.usp), local: options.localLogin !== false },
    }),
  );
  if (options.usp) {
    const usp = createUspAuthController(auth, options, options.usp);
    router.get("/auth/usp", usp.start);
    router.get("/auth/usp/callback", usp.callback);
  }
  router.post("/auth/login", controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", requireAuth(auth, options.now), controller.me);
  router.get("/scope", requireAuth(auth, options.now), controller.scope);
  return router;
}
