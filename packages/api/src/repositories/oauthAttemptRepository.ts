export interface OAuthAttempt {
  nonce: string;
  verifier: string;
  expiresAt: number;
}
export interface OAuthAttemptRepository {
  save(state: string, attempt: OAuthAttempt, now: number): Promise<void>;
  consume(state: string, now: number): Promise<OAuthAttempt | undefined>;
}
// Factory tests and the isolated browser provider use this adapter.
export function createMemoryOAuthAttempts(): OAuthAttemptRepository {
  const attempts = new Map<string, OAuthAttempt>();
  return {
    async save(state, attempt, now) {
      for (const [key, value] of attempts)
        if (value.expiresAt <= now) attempts.delete(key);
      attempts.set(state, attempt);
    },
    async consume(state, now) {
      const attempt = attempts.get(state);
      attempts.delete(state);
      return attempt && attempt.expiresAt > now ? attempt : undefined;
    },
  };
}
