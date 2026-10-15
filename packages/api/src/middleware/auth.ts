import { Request, RequestHandler } from "express";
import { ApiError } from "../errors.js";
import { User } from "../models/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";

declare global {
  namespace Express {
    interface Locals {
      user: User;
    }
  }
}
export const sessionCookie = "labrary_session";
export function readSessionToken(request: Request): string {
  return (
    request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.slice(sessionCookie.length + 1) ?? ""
  );
}
export function requireAuth(
  auth: AuthRepository,
  now: () => number,
): RequestHandler {
  return (request, response, next) => {
    const token = readSessionToken(request);
    const session = auth.getSession(token, now());
    const user = session && auth.findById(session.userId);
    if (!user?.active) {
      auth.deleteSession(token);
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Entre na sua conta para continuar.",
      );
    }
    response.locals.user = user;
    next();
  };
}
export function protectMutations(origin: string): RequestHandler {
  return (request, _response, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      (request.get("X-CSRF-Protection") !== "1" ||
        (request.get("Origin") && request.get("Origin") !== origin) ||
        request.get("Sec-Fetch-Site") === "cross-site")
    ) {
      throw new ApiError(
        403,
        "INVALID_ORIGIN",
        "Origem da requisição não permitida.",
      );
    }
    next();
  };
}
