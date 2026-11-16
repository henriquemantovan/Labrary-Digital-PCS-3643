import { Request, RequestHandler } from "express";
import { ApiError } from "../errors.js";
import { AcademicRole, User } from "../models/auth.js";
import { AuthRepository } from "../repositories/authRepository.js";

declare global {
  namespace Express {
    interface Locals {
      user: User;
      accountUser: User;
      viewRole?: AcademicRole;
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
  return async (request, response, next) => {
    const token = readSessionToken(request);
    const session = await auth.getSession(token, now());
    if (session) await auth.refresh?.();
    const user = session && auth.findById(session.userId);
    if (!user?.active) {
      await auth.deleteSession(token);
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Entre na sua conta para continuar.",
      );
    }
    response.locals.accountUser = user;
    const viewRole = user.role === "ADMIN" ? session?.viewRole : undefined;
    response.locals.viewRole = viewRole;
    response.locals.user = viewRole ? { ...user, role: viewRole } : user;
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

export const requireAdmin: RequestHandler = (_request, response, next) => {
  if (response.locals.accountUser.role !== "ADMIN")
    throw new ApiError(
      403,
      "ADMIN_REQUIRED",
      "Apenas administradores podem realizar esta ação.",
    );
  next();
};
