import { randomBytes } from "node:crypto";
import { Request, Response } from "express";
import { ApiError } from "../errors.js";
import { readSessionToken, sessionCookie } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { OAuthAttemptRepository } from "../repositories/oauthAttemptRepository.js";
import { GoogleOAuth, GoogleProfile } from "../services/googleOAuth.js";
import { User } from "../models/auth.js";
import { AuthOptions } from "./authController.js";
export interface GoogleAuthOptions {
  client: GoogleOAuth;
  saveProfile(profile: GoogleProfile): Promise<User>;
  attempts: OAuthAttemptRepository;
  origin: string;
}
export function createGoogleAuthController(
  auth: AuthRepository,
  options: AuthOptions,
  google: GoogleAuthOptions,
) {
  const limits = new Map<string, { count: number; until: number }>();
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: options.secureCookies,
    path: "/api/auth/google",
  };
  const fail = (response: Response, reason = "google") =>
    response.redirect(`${google.origin}/login?authError=${reason}`);
  return {
    async start(request: Request, response: Response) {
      const now = options.now();
      for (const [key, value] of limits)
        if (value.until <= now) limits.delete(key);
      const key = request.ip ?? "unknown";
      const limit = limits.get(key) ?? { count: 0, until: now + 15 * 60_000 };
      if (limit.count >= options.loginLimit) {
        response.set(
          "Retry-After",
          String(Math.ceil((limit.until - now) / 1000)),
        );
        throw new ApiError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        );
      }
      limit.count++;
      limits.set(key, limit);
      const state = randomBytes(32).toString("base64url"),
        nonce = randomBytes(32).toString("base64url"),
        verifier = randomBytes(32).toString("base64url");
      try {
        await google.attempts.save(
          state,
          { nonce, verifier, expiresAt: now + 10 * 60_000 },
          now,
        );
        response.cookie("labrary_google", state, {
          ...cookie,
          maxAge: 10 * 60_000,
        });
        response.redirect(
          google.client.authorizationUrl(state, nonce, verifier),
        );
      } catch {
        fail(response);
      }
    },
    async callback(request: Request, response: Response) {
      response.set("Referrer-Policy", "no-referrer");
      const state =
        request.headers.cookie
          ?.split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("labrary_google="))
          ?.slice("labrary_google=".length) ?? "";
      response.clearCookie("labrary_google", cookie);
      if (
        !state ||
        typeof request.query.state !== "string" ||
        request.query.state !== state
      ) {
        fail(response);
        return;
      }
      try {
        const attempt = await google.attempts.consume(state, options.now());
        if (
          !attempt ||
          request.query.error ||
          typeof request.query.code !== "string" ||
          !request.query.code ||
          request.query.code.length > 4096
        ) {
          fail(response);
          return;
        }
        const user = await google.saveProfile(
          await google.client.profile(
            request.query.code,
            attempt.verifier,
            attempt.nonce,
          ),
        );
        if (!user.active) {
          fail(response, "inactive");
          return;
        }
        const index = auth.directory.users.findIndex((u) => u.id === user.id);
        if (index < 0) auth.directory.users.push(user);
        else auth.directory.users[index] = user;
        await auth.deleteSession(readSessionToken(request));
        const token = await auth.createSession(
          user.id,
          options.now(),
          options.sessionTtlMs,
        );
        response.cookie(sessionCookie, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: options.secureCookies,
          path: "/api",
          maxAge: options.sessionTtlMs,
        });
        response.redirect(`${google.origin}/projetos`);
      } catch (error) {
        fail(
          response,
          error instanceof ApiError && error.code === "GOOGLE_ACCOUNT_CONFLICT"
            ? "account_conflict"
            : "google",
        );
      }
    },
  };
}
