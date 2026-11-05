BEGIN;
-- Preserve the existing USP columns and identities for history.
CREATE UNIQUE INDEX app_user_email_casefold_key ON app_user (lower(email));
ALTER TABLE app_user ADD COLUMN google_subject VARCHAR(255) UNIQUE;
ALTER TABLE app_user ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_user ADD COLUMN google_synced_at TIMESTAMPTZ;
CREATE TABLE auth_session (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE INDEX auth_session_expiry_idx ON auth_session(expires_at);
CREATE TABLE oauth_login_attempt (
    state_hash CHAR(64) PRIMARY KEY,
    nonce VARCHAR(128) NOT NULL,
    code_verifier VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX oauth_login_attempt_expiry_idx ON oauth_login_attempt(expires_at);
COMMIT;
