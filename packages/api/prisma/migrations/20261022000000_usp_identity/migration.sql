BEGIN;
ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE app_user ADD COLUMN usp_number VARCHAR(32) UNIQUE;
ALTER TABLE app_user ADD COLUMN usp_affiliations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE app_user ADD COLUMN usp_synced_at TIMESTAMPTZ;
ALTER TABLE app_user ADD CONSTRAINT usp_affiliations_array CHECK (jsonb_typeof(usp_affiliations) = 'array');
COMMIT;
