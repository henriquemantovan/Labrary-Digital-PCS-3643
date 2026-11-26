import { z } from "zod";
import type { User } from "./auth.js";
import { isDevelopmentProfileAccount } from "../services/developmentTestAccounts.js";

export const guestEmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const isUspEmail = (email: string) =>
  email.toLowerCase().endsWith("@usp.br");
export const requiresAcademicProfile = (user: User, developmentTestLogin = false) =>
  Boolean(
    (user.googleLinked || (developmentTestLogin && isDevelopmentProfileAccount(user))) &&
      user.role === "ALUNO" &&
      !user.guest &&
      !user.academicProfileCompleted,
  );

export const academicProfileInputSchema = (now: number) =>
  z
    .object({
      fullName: z
        .string()
        .trim()
        .min(3)
        .max(160)
        .refine(
          (value) => value.split(/\s+/).length >= 2,
          "Informe seu nome completo.",
        ),
      uspNumber: z
        .string()
        .trim()
        .regex(/^[0-9]{1,32}$/, "Informe um NUSP numérico."),
      entryYear: z.number().int().min(1900).max(new Date(now).getUTCFullYear()),
    })
    .strict();
export type AcademicProfileInput = z.infer<
  ReturnType<typeof academicProfileInputSchema>
>;
export interface GuestInvitation {
  id: number;
  email: string;
  invitedBy: number;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
}
