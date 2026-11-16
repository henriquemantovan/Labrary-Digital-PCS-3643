import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { AuthRepository, createAuthRepository } from "./authRepository.js";
import { createPostgresIdentityRepository } from "./postgresIdentityRepository.js";
import { OAuthAttemptRepository } from "./oauthAttemptRepository.js";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function createPostgresAuthRepository(pool: Pool): AuthRepository {
  const memory = createAuthRepository();
  const identities = createPostgresIdentityRepository(pool);
  return {
    directory: memory.directory,
    findById: memory.findById,
    findByEmail: memory.findByEmail,
    refresh: () => identities.refresh(memory.directory),
    async createSession(userId, now, ttl) {
      await pool.query("DELETE FROM auth_session WHERE expires_at <= $1", [
        new Date(now),
      ]);
      const token = randomBytes(32).toString("hex");
      await pool.query(
        "INSERT INTO auth_session(token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
        [hash(token), userId, new Date(now + ttl)],
      );
      return token;
    },
    async getSession(token, now) {
      if (!token) return undefined;
      const result = await pool.query(
        "SELECT user_id,expires_at,view_role FROM auth_session WHERE token_hash=$1 AND expires_at > $2",
        [hash(token), new Date(now)],
      );
      const row = result.rows[0];
      return row
        ? {
            userId: Number(row.user_id),
            expiresAt: row.expires_at.getTime(),
            ...(row.view_role ? { viewRole: row.view_role } : {}),
          }
        : undefined;
    },
    async setViewRole(token, viewRole, now) {
      const result = await pool.query(
        "UPDATE auth_session s SET view_role=$1 FROM app_user u WHERE s.token_hash=$2 AND s.expires_at>$3 AND u.id=s.user_id AND u.active AND u.role='ADMIN' RETURNING s.token_hash",
        [viewRole, hash(token), new Date(now)],
      );
      return result.rows.length > 0;
    },
    async deleteSession(token) {
      if (token)
        await pool.query("DELETE FROM auth_session WHERE token_hash=$1", [
          hash(token),
        ]);
    },
  };
}
export function createPostgresOAuthAttempts(
  pool: Pool,
): OAuthAttemptRepository {
  return {
    async save(state, attempt, now) {
      await pool.query(
        "DELETE FROM oauth_login_attempt WHERE expires_at <= $1",
        [new Date(now)],
      );
      await pool.query(
        "INSERT INTO oauth_login_attempt(state_hash,nonce,code_verifier,expires_at) VALUES ($1,$2,$3,$4)",
        [
          hash(state),
          attempt.nonce,
          attempt.verifier,
          new Date(attempt.expiresAt),
        ],
      );
    },
    async consume(state, now) {
      const result = await pool.query(
        "DELETE FROM oauth_login_attempt WHERE state_hash=$1 RETURNING nonce,code_verifier,expires_at",
        [hash(state)],
      );
      const row = result.rows[0];
      return row && row.expires_at.getTime() > now
        ? {
            nonce: row.nonce,
            verifier: row.code_verifier,
            expiresAt: row.expires_at.getTime(),
          }
        : undefined;
    },
  };
}
