import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
export const googleNow = 1_800_000_000_000;
const { privateKey, publicKey } = await generateKeyPair("RS256", {
  extractable: true,
});
export const publicJwk = {
  ...(await exportJWK(publicKey)),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};
export const googleKeys = createLocalJWKSet({ keys: [publicJwk] });
export const googleConfig = {
  clientId: "test-client",
  clientSecret: "test-secret",
  callbackUrl: "https://labrary.example/api/auth/google/callback",
};
export async function signGoogleToken(
  patch: Record<string, unknown> = {},
  key = privateKey,
) {
  return new SignJWT({
    sub: "google-123",
    email: "maria@gmail.com",
    email_verified: true,
    name: "Maria Google",
    nonce: "nonce",
    iss: "https://accounts.google.com",
    aud: googleConfig.clientId,
    iat: googleNow / 1000,
    exp: googleNow / 1000 + 3600,
    ...patch,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(key);
}
