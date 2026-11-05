import { createHash, randomBytes } from "node:crypto";
import { AcademicRole, Directory, User } from "../models/auth.js";

export interface Session {
  userId: number;
  expiresAt: number;
  viewRole?: AcademicRole;
}
export function createAuthRepository(
  directory: Directory = {
    users: [],
    classes: [],
    groups: [],
    assignments: [],
  },
) {
  const sessions = new Map<string, Session>();
  const tokenHash = (token: string) =>
    createHash("sha256").update(token).digest("hex");
  return {
    directory,
    findByEmail(email: string): User | undefined {
      return directory.users.find((user) => user.email === email);
    },
    findById(id: number): User | undefined {
      return directory.users.find((user) => user.id === id);
    },
    createSession(userId: number, now: number, ttl: number) {
      for (const [key, session] of sessions)
        if (session.expiresAt <= now) sessions.delete(key);
      const token = randomBytes(32).toString("hex");
      sessions.set(tokenHash(token), { userId, expiresAt: now + ttl });
      return token;
    },
    getSession(token: string, now: number): Session | undefined {
      const key = tokenHash(token);
      const session = sessions.get(key);
      if (session && session.expiresAt <= now) {
        sessions.delete(key);
        return undefined;
      }
      return session;
    },
    setViewRole(token: string, viewRole: AcademicRole | null, now: number) {
      const session = sessions.get(tokenHash(token));
      if (!session || session.expiresAt <= now) return false;
      if (viewRole) session.viewRole = viewRole;
      else delete session.viewRole;
      return true;
    },
    deleteSession(token: string) {
      sessions.delete(tokenHash(token));
    },
  };
}
type Awaitable<T> = T | Promise<T>;
export interface AuthRepository {
  directory: Directory;
  refresh?: () => Promise<void>;
  findByEmail(email: string): User | undefined;
  findById(id: number): User | undefined;
  createSession(userId: number, now: number, ttl: number): Awaitable<string>;
  getSession(token: string, now: number): Awaitable<Session | undefined>;
  deleteSession(token: string): Awaitable<void>;
  setViewRole(
    token: string,
    viewRole: AcademicRole | null,
    now: number,
  ): Awaitable<boolean>;
}
