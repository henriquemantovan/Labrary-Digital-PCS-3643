BEGIN;
ALTER TYPE user_role ADD VALUE 'ADMIN';
ALTER TABLE auth_session ADD COLUMN view_role user_role;
ALTER TABLE auth_session ADD CONSTRAINT auth_session_academic_view CHECK (
    view_role IS NULL OR view_role IN ('ALUNO', 'AVALIADOR', 'PROFESSOR')
);
CREATE TABLE user_role_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id BIGINT NOT NULL REFERENCES app_user(id),
    target_id BIGINT NOT NULL REFERENCES app_user(id),
    previous_role user_role NOT NULL,
    new_role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_role_audit_target_idx ON user_role_audit(target_id, created_at);
COMMIT;
