import type { User } from "../models/auth.js";

export const developmentTestAccounts: ReadonlyArray<{
  email: string;
  fullName: string;
  role: User["role"];
}> = [
  { email: "admin@labrary.test", fullName: "Renata Azevedo (teste)", role: "ADMIN" },
  { email: "professor@labrary.test", fullName: "Helena Almeida (teste)", role: "PROFESSOR" },
  { email: "avaliador@labrary.test", fullName: "Rafael Costa (teste)", role: "AVALIADOR" },
  { email: "aluno@labrary.test", fullName: "Marina Oliveira (teste)", role: "ALUNO" },
  { email: "aluno2@labrary.test", fullName: "Lucas Pereira (teste)", role: "ALUNO" },
  { email: "aluno3@labrary.test", fullName: "Bianca Santos (teste)", role: "ALUNO" },
  { email: "cadastro@labrary.test", fullName: "Novo Aluno (teste)", role: "ALUNO" },
  { email: "convidado@labrary.test", fullName: "Visitante Convidado (teste)", role: "ALUNO" },
];

export const developmentTestPassword = "LabraryTeste@2026";
const emails = new Set(developmentTestAccounts.map(({ email }) => email));

export const isDevelopmentTestEmail = (email: string) =>
  emails.has(email.toLowerCase());

export const isDevelopmentTestAccount = (user: User) =>
  isDevelopmentTestEmail(user.email) && !user.googleLinked && Boolean(user.passwordHash);

export const isDevelopmentProfileAccount = (user: User) =>
  isDevelopmentTestAccount(user) && user.email.toLowerCase() === "cadastro@labrary.test";

export const isDevelopmentGuestAccount = (user: User) =>
  isDevelopmentTestAccount(user) && user.email.toLowerCase() === "convidado@labrary.test";

/** Exceção optativa do ambiente Google local; nunca habilitada em produção. */
export function loadDevelopmentTestLogin(
  env: Readonly<Record<string, string | undefined>>,
  googleEnabled: boolean,
  origin: string,
): boolean {
  if (!googleEnabled) return false;
  const flag = env.DEV_TEST_LOGIN;
  if (flag === undefined || flag === "false") return false;
  if (flag !== "true") throw new Error("DEV_TEST_LOGIN deve ser true ou false.");
  if (env.NODE_ENV !== "development")
    throw new Error("DEV_TEST_LOGIN exige NODE_ENV=development e é proibido em produção.");
  const url = new URL(origin);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/"
  ) throw new Error("DEV_TEST_LOGIN exige APP_ORIGIN local, em localhost ou 127.0.0.1.");
  return true;
}
