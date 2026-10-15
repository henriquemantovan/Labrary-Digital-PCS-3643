import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP scrypt profile: N=2^15, r=8, p=3 (32 MiB per operation).
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [, salt, hash] = encoded.split("$");
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

// Same derivation cost for unknown accounts. This is never an account credential.
export const dummyPasswordHash = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
