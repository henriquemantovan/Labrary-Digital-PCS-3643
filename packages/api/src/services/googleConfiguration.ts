import { GoogleConfig } from "./googleOAuth.js";
export function loadGoogleConfig(
  env: NodeJS.ProcessEnv,
  origin: string,
): GoogleConfig | undefined {
  if (env.AUTH_PROVIDER && !["google", "local"].includes(env.AUTH_PROVIDER))
    throw new Error("AUTH_PROVIDER deve ser google ou local.");
  if (env.AUTH_PROVIDER === "local") return undefined;
  if (
    !env.GOOGLE_CLIENT_ID &&
    !env.GOOGLE_CLIENT_SECRET &&
    env.AUTH_PROVIDER !== "google"
  )
    return undefined;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.DATABASE_URL)
    throw new Error(
      "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e DATABASE_URL para usar o login Google.",
    );
  if (env.AUTH_DEMO === "true" || env.AUTH_USERS_FILE)
    throw new Error(
      "No modo Google, desative AUTH_DEMO e remova AUTH_USERS_FILE.",
    );
  const url = new URL(origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "APP_ORIGIN deve ser uma origem HTTPS (HTTP local apenas em desenvolvimento).",
    );
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${url.origin}/api/auth/google/callback`,
  };
}
