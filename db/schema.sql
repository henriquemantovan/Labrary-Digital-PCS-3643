-- Labrary Digital — PostgreSQL schema (MVP)
-- Execute with: psql -d <database> -f db/schema.sql
-- Files are stored outside PostgreSQL; this schema stores private metadata only.

BEGIN;

CREATE TYPE user_role AS ENUM ('ALUNO', 'AVALIADOR', 'PROFESSOR');
CREATE TYPE project_status AS ENUM ('PREPARACAO', 'EM_AVALIACAO', 'AJUSTES', 'FINALIZADO');
CREATE TYPE material_kind AS ENUM ('VIDEO', 'RELATORIO', 'MANUAL', 'OUTRO');
CREATE TYPE submission_status AS ENUM ('EM_AVALIACAO', 'DEVOLVIDA', 'CONCLUIDA');
CREATE TYPE publication_status AS ENUM ('PUBLICADO', 'RETIRADO');

CREATE TABLE app_user (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE course_class (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    academic_year SMALLINT NOT NULL CHECK (academic_year BETWEEN 2000 AND 2200),
    professor_id BIGINT NOT NULL REFERENCES app_user(id),
    UNIQUE (name, academic_year)
);

CREATE TABLE student_group (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES course_class(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, name),
    UNIQUE (id, class_id)
);

CREATE TABLE group_membership (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES student_group(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    CHECK (left_at IS NULL OR left_at >= joined_at)
);
CREATE UNIQUE INDEX one_active_group_per_student ON group_membership(user_id) WHERE left_at IS NULL;
CREATE INDEX group_membership_group_idx ON group_membership(group_id);

CREATE TABLE project (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES course_class(id),
    group_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(100) NOT NULL,
    status project_status NOT NULL DEFAULT 'PREPARACAO',
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id),
    UNIQUE (id, group_id),
    FOREIGN KEY (group_id, class_id) REFERENCES student_group(id, class_id)
);
CREATE INDEX project_class_status_idx ON project(class_id, status);

CREATE TABLE project_evaluator (
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    evaluator_id BIGINT NOT NULL REFERENCES app_user(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, evaluator_id)
);

CREATE TABLE project_requirement (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    kind material_kind NOT NULL,
    label VARCHAR(160) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_mime_types TEXT[] NOT NULL DEFAULT '{}',
    max_size_bytes BIGINT CHECK (max_size_bytes IS NULL OR max_size_bytes > 0),
    due_at TIMESTAMPTZ,
    UNIQUE (project_id, kind, label)
);

CREATE TABLE project_material (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id),
    requirement_id BIGINT REFERENCES project_requirement(id),
    kind material_kind NOT NULL,
    title VARCHAR(200) NOT NULL,
    created_by BIGINT NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, project_id)
);

CREATE TABLE material_version (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    material_id BIGINT NOT NULL REFERENCES project_material(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    mime_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    checksum_sha256 CHAR(64),
    uploaded_by BIGINT NOT NULL REFERENCES app_user(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (material_id, version_number),
    UNIQUE (id, material_id)
);

CREATE TABLE submission (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id),
    round_number INTEGER NOT NULL CHECK (round_number > 0),
    status submission_status NOT NULL DEFAULT 'EM_AVALIACAO',
    submitted_by BIGINT NOT NULL REFERENCES app_user(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    return_reason TEXT,
    UNIQUE (project_id, round_number),
    UNIQUE (id, project_id)
);

-- Snapshot imutável: cada entrega aponta para versões exatas dos materiais.
CREATE TABLE submission_material (
    submission_id BIGINT NOT NULL REFERENCES submission(id) ON DELETE CASCADE,
    material_id BIGINT NOT NULL,
    material_version_id BIGINT NOT NULL,
    PRIMARY KEY (submission_id, material_id),
    FOREIGN KEY (material_version_id, material_id)
        REFERENCES material_version(id, material_id),
    UNIQUE (submission_id, material_version_id)
);

CREATE TABLE project_message (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES app_user(id),
    material_version_id BIGINT REFERENCES material_version(id),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ
);
CREATE INDEX project_message_timeline_idx ON project_message(project_id, created_at);

CREATE TABLE rubric_version (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES course_class(id),
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    title VARCHAR(160) NOT NULL,
    created_by BIGINT NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, version_number),
    UNIQUE (id, class_id)
);

CREATE TABLE rubric_criterion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rubric_version_id BIGINT NOT NULL REFERENCES rubric_version(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    weight NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
    min_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 10,
    position SMALLINT NOT NULL CHECK (position > 0),
    CHECK (max_score > min_score),
    UNIQUE (rubric_version_id, position),
    UNIQUE (id, rubric_version_id)
);

CREATE TABLE project_rubric (
    project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    rubric_version_id BIGINT NOT NULL REFERENCES rubric_version(id),
    PRIMARY KEY (project_id, rubric_version_id)
);

CREATE TABLE evaluation (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES submission(id),
    evaluator_id BIGINT NOT NULL REFERENCES app_user(id),
    rubric_version_id BIGINT NOT NULL REFERENCES rubric_version(id),
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submission_id, evaluator_id),
    UNIQUE (id, rubric_version_id),
    CHECK ((is_final AND finalized_at IS NOT NULL) OR (NOT is_final AND finalized_at IS NULL))
);

CREATE TABLE evaluation_score (
    evaluation_id BIGINT NOT NULL,
    rubric_version_id BIGINT NOT NULL,
    criterion_id BIGINT NOT NULL,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    comment TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (evaluation_id, criterion_id),
    FOREIGN KEY (evaluation_id, rubric_version_id) REFERENCES evaluation(id, rubric_version_id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id, rubric_version_id) REFERENCES rubric_criterion(id, rubric_version_id)
);

CREATE TABLE result_release (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id),
    submission_id BIGINT NOT NULL REFERENCES submission(id),
    released_by BIGINT NOT NULL REFERENCES app_user(id),
    released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    CHECK (revoked_at IS NULL OR revoked_at >= released_at)
);

CREATE TABLE project_publication (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES project(id),
    status publication_status NOT NULL,
    title VARCHAR(200) NOT NULL,
    public_description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    published_by BIGINT NOT NULL REFERENCES app_user(id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    UNIQUE (id, project_id),
    CHECK ((status = 'PUBLICADO' AND withdrawn_at IS NULL) OR status = 'RETIRADO')
);
CREATE UNIQUE INDEX one_active_publication_per_project ON project_publication(project_id) WHERE status = 'PUBLICADO';

CREATE TABLE publication_material (
    publication_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    material_version_id BIGINT NOT NULL REFERENCES material_version(id),
    PRIMARY KEY (publication_id, material_version_id),
    FOREIGN KEY (publication_id, project_id) REFERENCES project_publication(id, project_id) ON DELETE CASCADE
);

COMMIT;
