-- Estado acadêmico transacional. As estruturas versionadas são preservadas
-- em JSONB nativo do PostgreSQL, sem dependência de arquivos do servidor.
CREATE TABLE academic_state (
    domain TEXT PRIMARY KEY CHECK (domain IN ('projects', 'rubrics', 'evaluations', 'results')),
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO academic_state(domain, payload) VALUES
  ('projects', '{"projects":[],"materials":[],"messages":[],"submissions":[]}'),
  ('rubrics', '{"versions":[]}'),
  ('evaluations', '[]'),
  ('results', '[]');

CREATE TABLE academic_data_import (
    source_hash CHAR(64) PRIMARY KEY,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE r2_usage (
    scope TEXT PRIMARY KEY,
    month CHAR(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    used_a INTEGER NOT NULL DEFAULT 0 CHECK (used_a >= 0),
    used_b INTEGER NOT NULL DEFAULT 0 CHECK (used_b >= 0)
);
