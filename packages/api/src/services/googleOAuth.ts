import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { ApiError } from "../errors.js";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}
export interface GoogleProfile {
  subject: string;
  fullName: string;
  email: string;
  emailVerified: true;
}
export const googleClaimsSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254),
  email_verified: z.literal(true),
  name: z.string().optional(),
  nonce: z.string().min(1),
  azp: z.string().optional(),
});
const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
export function createGoogleOAuth(
  config: GoogleConfig,
  dependencies: {
    transport?: typeof fetch;
    keys?: JWTVerifyGetKey;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    now?: () => number;
  } = {},
) {
  const keys =
    dependencies.keys ??
    createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
      timeoutDuration: 10_000,
    });
  const transport = dependencies.transport ?? fetch;
  return {
    authorizationUrl(state: string, nonce: string, verifier: string) {
      const url = new URL(
        dependencies.authorizationEndpoint ?? authorizationEndpoint,
      );
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();
      return url.toString();
    },
    async profile(
      code: string,
      verifier: string,
      nonce: string,
    ): Promise<GoogleProfile> {
      try {
        const response = await transport(
          dependencies.tokenEndpoint ?? tokenEndpoint,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: config.clientId,
              client_secret: config.clientSecret,
              redirect_uri: config.callbackUrl,
              grant_type: "authorization_code",
              code_verifier: verifier,
            }),
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!response.ok) throw new Error("Token exchange failed");
        const { id_token } = z
          .object({ id_token: z.string().min(1).max(32_000) })
          .parse(await response.json());
        const { payload } = await jwtVerify(id_token, keys, {
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: config.clientId,
          algorithms: ["RS256"],
          requiredClaims: ["exp", "iat", "sub", "nonce"],
          maxTokenAge: "10m",
          clockTolerance: 5,
          currentDate: new Date((dependencies.now ?? Date.now)()),
        });
        const claims = googleClaimsSchema.parse(payload);
        if (
          (Array.isArray(payload.aud) &&
            payload.aud.length > 1 &&
            claims.azp !== config.clientId) ||
          claims.nonce !== nonce ||
          (claims.azp !== undefined && claims.azp !== config.clientId)
        )
          throw new Error("Invalid identity");
        return {
          subject: claims.sub,
          email: claims.email.toLowerCase(),
          fullName:
            claims.name?.trim().slice(0, 160) || claims.email.slice(0, 160),
          emailVerified: true,
        };
      } catch {
        throw new ApiError(
          502,
          "GOOGLE_AUTH_FAILED",
          "Não foi possível confirmar sua conta Google. Tente novamente.",
        );
      }
    },
  };
}
export type GoogleOAuth = ReturnType<typeof createGoogleOAuth>;
