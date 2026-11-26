BEGIN;

ALTER TABLE app_user ADD COLUMN entry_year SMALLINT,
  ADD COLUMN academic_profile_completed_at TIMESTAMPTZ;
ALTER TABLE app_user ADD CONSTRAINT app_user_entry_year CHECK (entry_year IS NULL OR entry_year BETWEEN 1900 AND 9999),
  ADD CONSTRAINT app_user_academic_profile CHECK (academic_profile_completed_at IS NULL OR (usp_number IS NOT NULL AND entry_year IS NOT NULL));

CREATE TABLE guest_invitation (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL CHECK (email = lower(email)),
  invited_by BIGINT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by BIGINT REFERENCES app_user(id),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
CREATE UNIQUE INDEX guest_invitation_active_email ON guest_invitation(email) WHERE revoked_at IS NULL;

COMMIT;
