import { Router } from "express";
import { z } from "zod";
import { publicUser } from "../models/auth.js";
import {
  academicProfileInputSchema,
  guestEmailSchema,
} from "../models/academicAccess.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import type { AuthRepository } from "../repositories/authRepository.js";
import type { AcademicAccessRepository } from "../repositories/academicAccessRepository.js";

export function createAcademicAccessRouter(
  auth: AuthRepository,
  access: AcademicAccessRepository,
  now: () => number,
) {
  const router = Router();
  router.post(
    "/auth/profile",
    requireAuth(auth, now),
    async (request, response) => {
      const input = academicProfileInputSchema(now()).parse(request.body);
      await access.saveProfile(response.locals.accountUser.id, input, now());
      await auth.refresh?.();
      response.json({
        data: publicUser(auth.findById(response.locals.accountUser.id)!),
      });
    },
  );
  router.use("/admin/guests", requireAuth(auth, now), requireAdmin);
  router.get("/admin/guests", async (_request, response) =>
    response.json({ data: await access.listInvitations() }),
  );
  router.post("/admin/guests", async (request, response) => {
    const { email } = z
      .object({ email: guestEmailSchema })
      .strict()
      .parse(request.body);
    response
      .status(201)
      .json({
        data: await access.invite(response.locals.accountUser.id, email, now()),
      });
  });
  router.delete("/admin/guests/:invitationId", async (request, response) => {
    const id = z.coerce
      .number()
      .int()
      .positive()
      .safe()
      .parse(request.params.invitationId);
    await access.revoke(response.locals.accountUser.id, id, now());
    await auth.refresh?.();
    response.status(204).end();
  });
  return router;
}
