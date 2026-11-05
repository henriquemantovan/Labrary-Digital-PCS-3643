import { Pool } from "pg";
import { ApiError } from "../errors.js";
import { Directory, User } from "../models/auth.js";
import { GoogleProfile } from "../services/googleOAuth.js";
type UserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string | null;
  role: User["role"];
  active: boolean;
  google_subject: string | null;
};
function userFromRow(row: UserRow): User {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("ID fora do intervalo seguro.");
  return {
    id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active,
    googleLinked: Boolean(row.google_subject),
  };
}
export function createPostgresIdentityRepository(pool: Pool) {
  return {
    async saveProfile(profile: GoogleProfile): Promise<User> {
      if (!profile.emailVerified)
        throw new ApiError(
          403,
          "GOOGLE_EMAIL_UNVERIFIED",
          "Confirme seu e-mail na conta Google.",
        );
      try {
        const result = await pool.query<UserRow>(
          `
          INSERT INTO app_user (full_name,email,password_hash,role,google_subject,email_verified,google_synced_at)
          VALUES ($1,$2,NULL,'ALUNO',$3,TRUE,now())
          ON CONFLICT (google_subject) DO UPDATE SET full_name=EXCLUDED.full_name,email=EXCLUDED.email,
            email_verified=TRUE,google_synced_at=now()
          RETURNING *`,
          [profile.fullName, profile.email.toLowerCase(), profile.subject],
        );
        return userFromRow(result.rows[0]);
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          throw new ApiError(
            409,
            "GOOGLE_ACCOUNT_CONFLICT",
            "Já existe uma conta com esse e-mail. Solicite ao responsável a vinculação da conta Google.",
          );
        throw error;
      }
    },
    async refresh(directory: Directory) {
      const users = await pool.query<UserRow>(
        "SELECT id,full_name,email,password_hash,role,active,google_subject FROM app_user",
      );
      const classes = await pool.query(
        'SELECT id::integer, name, academic_year AS "academicYear", professor_id::integer AS "professorId" FROM course_class',
      );
      const groups = await pool.query(
        'SELECT g.id::integer, g.class_id::integer AS "classId", g.name, COALESCE(array_agg(m.user_id::integer) FILTER (WHERE m.user_id IS NOT NULL), ARRAY[]::integer[]) AS "memberIds" FROM student_group g LEFT JOIN group_membership m ON m.group_id = g.id AND m.left_at IS NULL GROUP BY g.id',
      );
      const assignments = await pool.query(
        'SELECT project_id::integer AS "projectId", evaluator_id::integer AS "evaluatorId" FROM project_evaluator',
      );
      directory.users = users.rows.map(userFromRow);
      directory.classes = classes.rows;
      directory.groups = groups.rows;
      directory.assignments = assignments.rows;
    },
  };
}
