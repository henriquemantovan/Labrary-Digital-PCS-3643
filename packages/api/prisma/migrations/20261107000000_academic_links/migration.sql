BEGIN;

-- A autenticação permite vínculos explícitos com mais de um grupo.
DROP INDEX one_active_group_per_student;
CREATE UNIQUE INDEX one_active_membership_per_group ON group_membership(group_id, user_id) WHERE left_at IS NULL;

-- Projetos usam o snapshot privado da HU07. O vínculo aponta para esse ID,
-- validado pela aplicação; não criar projetos fictícios na tabela legada.
ALTER TABLE project_evaluator DROP CONSTRAINT project_evaluator_project_id_fkey;

CREATE TABLE academic_link_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target VARCHAR(10) NOT NULL CHECK (target IN ('GROUP', 'PROJECT')),
    target_id BIGINT NOT NULL CHECK (target_id > 0),
    before_ids BIGINT[] NOT NULL,
    after_ids BIGINT[] NOT NULL,
    changed_by BIGINT NOT NULL REFERENCES app_user(id),
    changed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX academic_link_audit_target_idx ON academic_link_audit(target, target_id, id);

COMMIT;
