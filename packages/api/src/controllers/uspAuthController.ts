import { randomBytes } from "node:crypto";
import { Request, Response } from "express";
import { ApiError } from "../errors.js";
import { readSessionToken, sessionCookie } from "../middleware/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";
import { OAuthToken, UspOAuth, UspProfile } from "../services/uspOAuth.js";
import { User } from "../models/auth.js";
import { AuthOptions } from "./authController.js";

export interface UspAuthOptions {
  client: UspOAuth;
  saveProfile: (profile: UspProfile) => Promise<User>;
  origin: string;
}
export function createUspAuthController(
  auth: AuthRepository,
  options: AuthOptions,
  usp: UspAuthOptions,
) {
  const pending = new Map<
    string,
    { credentials: OAuthToken; expires: number }
  >();
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: options.secureCookies,
    path: "/api/auth/usp",
  };
  return {
    async start(_request: Request, response: Response) {
      for (const [key, value] of pending)
        if (value.expires <= options.now()) pending.delete(key);
      if (pending.size >= 1000)
        throw new ApiError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Aguarde alguns minutos e tente novamente.",
        );
      let credentials: OAuthToken;
      try {
        credentials = await usp.client.requestToken();
      } catch {
        response.redirect(`${usp.origin}/login?authError=usp`);
        return;
      }
      const state = randomBytes(32).toString("hex");
      pending.set(state, { credentials, expires: options.now() + 10 * 60_000 });
      response.cookie("labrary_usp", state, { ...cookie, maxAge: 10 * 60_000 });
      response.redirect(usp.client.authorizationUrl(credentials.token));
    },
    async callback(request: Request, response: Response) {
      response.set("Referrer-Policy", "no-referrer");
      const state =
        request.headers.cookie
          ?.split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("labrary_usp="))
          ?.slice(12) ?? "";
      const attempt = pending.get(state);
      pending.delete(state);
      response.clearCookie("labrary_usp", cookie);
      if (
        !attempt ||
        attempt.expires <= options.now() ||
        typeof request.query.oauth_token !== "string" ||
        request.query.oauth_token !== attempt.credentials.token ||
        typeof request.query.oauth_verifier !== "string" ||
        !request.query.oauth_verifier ||
        request.query.oauth_verifier.length > 2048
      ) {
        response.redirect(`${usp.origin}/login?authError=usp`);
        return;
      }
      try {
        const user = await usp.saveProfile(
          await usp.client.profile(
            attempt.credentials,
            request.query.oauth_verifier,
          ),
        );
        if (!user.active)
          throw new ApiError(403, "INACTIVE_USER", "Conta desativada.");
        const index = auth.directory.users.findIndex((u) => u.id === user.id);
        if (index < 0) auth.directory.users.push(user);
        else auth.directory.users[index] = user;
        auth.deleteSession(readSessionToken(request));
        const token = auth.createSession(
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
        response.redirect(`${usp.origin}/projetos`);
      } catch {
        response.redirect(`${usp.origin}/login?authError=usp`);
      }
    },
  };
}
