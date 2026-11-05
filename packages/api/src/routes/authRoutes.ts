import { academicRoles, publicUser } from "../models/auth.js";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { Router } from "express";
import {
  AuthOptions,
  createAuthController,
} from "../controllers/authController.js";
import {
  readSessionToken,
  requireAdmin,
  requireAuth,
} from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";

import { createGoogleAuthController } from "../controllers/googleAuthController.js";

export function createAuthRouter(auth: AuthRepository, options: AuthOptions) {
  const router = Router();
  const controller = createAuthController(auth, options);
  router.get("/auth/providers", (_request, response) =>
    response.json({
      data: {
        google: Boolean(options.google),
        local: options.localLogin !== false,
      },
    }),
  );
  if (options.google) {
    const google = createGoogleAuthController(auth, options, options.google);
    router.get("/auth/google", google.start);
    router.get("/auth/google/callback", google.callback);
  }
  router.post("/auth/login", controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", requireAuth(auth, options.now), controller.me);
  router.post(
    "/auth/view-role",
    requireAuth(auth, options.now),
    requireAdmin,
    async (request, response) => {
      const { role } = z
        .object({ role: z.enum(academicRoles).nullable() })
        .strict()
        .parse(request.body);
      if (
        !(await auth.setViewRole(
          readSessionToken(request),
          role,
          options.now(),
        ))
      )
        throw new ApiError(
          401,
          "UNAUTHENTICATED",
          "Sua sessão terminou. Entre novamente.",
        );
      response.json({
        data: publicUser(response.locals.accountUser, role ?? undefined),
      });
    },
  );
  router.get("/scope", requireAuth(auth, options.now), controller.scope);
  return router;
}
