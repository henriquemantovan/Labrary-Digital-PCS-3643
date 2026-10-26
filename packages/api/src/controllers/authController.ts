import { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import { publicUser } from "../models/auth.js";
import { readSessionToken, sessionCookie } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { dummyPasswordHash, verifyPassword } from "../services/password.js";

const credentialsSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();
import { UspAuthOptions } from "./uspAuthController.js";

export interface AuthOptions {
  usp?: UspAuthOptions;
  localLogin?: boolean;
  now: () => number;
  secureCookies: boolean;
  sessionTtlMs: number;
  loginLimit: number;
}
export function createAuthController(
  auth: AuthRepository,
  options: AuthOptions,
) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const cookie: CookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: options.secureCookies,
    path: "/api",
  };
  return {
    async login(request: Request, response: Response) {
      if (options.localLogin === false)
        throw new ApiError(
          403,
          "LOCAL_LOGIN_DISABLED",
          "Entre com a Senha Única USP.",
        );
      const now = options.now();
      for (const [key, value] of attempts)
        if (value.resetAt <= now) attempts.delete(key);
      const key = request.ip ?? "unknown";
      const attempt = attempts.get(key) ?? {
        count: 0,
        resetAt: now + 15 * 60_000,
      };
      attempts.set(key, attempt);
      if (attempt.count >= options.loginLimit) {
        response.set(
          "Retry-After",
          String(Math.ceil((attempt.resetAt - now) / 1000)),
        );
        throw new ApiError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        );
      }
      attempt.count++;
      const parsed = credentialsSchema.safeParse(request.body);
      const user = parsed.success
        ? auth.findByEmail(parsed.data.email)
        : undefined;
      const valid = await verifyPassword(
        parsed.success ? parsed.data.password : "",
        user?.passwordHash ?? dummyPasswordHash,
      );
      if (!valid || !user?.active)
        throw new ApiError(
          401,
          "INVALID_CREDENTIALS",
          "E-mail ou senha inválidos.",
        );
      auth.deleteSession(readSessionToken(request));
      const token = auth.createSession(
        user.id,
        options.now(),
        options.sessionTtlMs,
      );
      response.cookie(sessionCookie, token, {
        ...cookie,
        maxAge: options.sessionTtlMs,
      });
      response.status(200).json({ data: publicUser(user) });
    },
    me(_request: Request, response: Response) {
      response.json({ data: publicUser(response.locals.user) });
    },
    logout(request: Request, response: Response) {
      auth.deleteSession(readSessionToken(request));
      response.clearCookie(sessionCookie, cookie);
      response.status(204).end();
    },
    scope(_request: Request, response: Response) {
      const user = response.locals.user;
      const classes = auth.directory.classes.filter(
        (item) => user.role === "PROFESSOR" && item.professorId === user.id,
      );
      const groups = auth.directory.groups.filter((group) =>
        user.role === "ALUNO"
          ? group.memberIds.includes(user.id)
          : classes.some((item) => item.id === group.classId),
      );
      response.json({
        data: {
          classes,
          groups: groups.map(({ id, classId, name }) => ({
            id,
            classId,
            name,
          })),
        },
      });
    },
  };
}
