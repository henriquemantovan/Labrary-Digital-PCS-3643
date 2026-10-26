import { UspConfig } from "./uspOAuth.js";
export function loadUspConfig(
  env: NodeJS.ProcessEnv,
  origin: string,
): UspConfig | undefined {
  const values = [
    env.SENHAUNICA_KEY,
    env.SENHAUNICA_SECRET,
    env.SENHAUNICA_CALLBACK_ID,
  ];
  if (!values.some(Boolean)) return undefined;
  if (!values.every(Boolean) || !env.DATABASE_URL)
    throw new Error(
      "Configure SENHAUNICA_KEY, SENHAUNICA_SECRET, SENHAUNICA_CALLBACK_ID e DATABASE_URL.",
    );
  if (env.AUTH_DEMO === "true" || env.AUTH_USERS_FILE)
    throw new Error("Senha Única não pode ser combinada com contas locais.");
  if (!/^\d+$/.test(env.SENHAUNICA_CALLBACK_ID!))
    throw new Error("SENHAUNICA_CALLBACK_ID deve ser numérico.");
  const baseUrl = (
    env.SENHAUNICA_BASE_URL ?? "https://uspdigital.usp.br/wsusuario/oauth"
  ).replace(/\/$/, "");
  const url = new URL(baseUrl);
  if (
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "SENHAUNICA_BASE_URL deve usar HTTPS (HTTP local apenas para desenvolvimento).",
    );
  return {
    key: env.SENHAUNICA_KEY!,
    secret: env.SENHAUNICA_SECRET!,
    callbackId: env.SENHAUNICA_CALLBACK_ID!,
    callbackUrl: new URL("/api/auth/usp/callback", origin).toString(),
    baseUrl,
  };
}
