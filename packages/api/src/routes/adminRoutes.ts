import { Router } from "express";
import { z } from "zod";
import { roles } from "../models/auth.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { AdminRepository } from "../repositories/adminRepository.js";
export function createAdminRouter(
  auth: AuthRepository,
  admin: AdminRepository,
  now: () => number,
) {
  const router = Router();
  router.use(requireAuth(auth, now), requireAdmin);
  router.get("/users", async (_request, response) => {
    response.json({ data: await admin.listUsers() });
  });
  router.patch("/users/:userId/role", async (request, response) => {
    const { userId } = z
      .object({
        userId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      })
      .parse(request.params);
    const { role } = z
      .object({ role: z.enum(roles) })
      .strict()
      .parse(request.body);
    response.json({
      data: await admin.changeRole(
        response.locals.accountUser.id,
        userId,
        role,
        now(),
      ),
    });
  });
  return router;
}
