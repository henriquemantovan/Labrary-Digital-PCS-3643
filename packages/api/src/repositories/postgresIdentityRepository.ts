import { Pool } from "pg";
import { ApiError } from "../errors.js";
import { Directory, User } from "../models/auth.js";
import { profileEmail, profileRole, UspProfile } from "../services/uspOAuth.js";

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string | null;
  role: User["role"];
  active: boolean;
  usp_number: string | null;
  usp_affiliations: User["uspAffiliations"];
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
    ...(row.usp_number
      ? { uspNumber: row.usp_number, uspAffiliations: row.usp_affiliations }
      : {}),
  };
}
export function createPostgresIdentityRepository(pool: Pool) {
  return {
    async saveProfile(profile: UspProfile): Promise<User> {
      const role = profileRole(profile),
        email = profileEmail(profile);
      try {
        const result = await pool.query<UserRow>(
          `
          INSERT INTO app_user (full_name, email, password_hash, role, usp_number, usp_affiliations, usp_synced_at)
          VALUES ($1, $2, NULL, $3, $4, $5::jsonb, now())
          ON CONFLICT (usp_number) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email,
            role = CASE WHEN app_user.role = 'AVALIADOR' AND EXCLUDED.role = 'ALUNO' THEN app_user.role ELSE EXCLUDED.role END,
            usp_affiliations = EXCLUDED.usp_affiliations, usp_synced_at = now()
          RETURNING *`,
          [
            profile.nomeUsuario,
            email,
            role,
            profile.loginUsuario,
            JSON.stringify(profile.vinculo),
          ],
        );
        return userFromRow(result.rows[0]);
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          throw new ApiError(
            409,
            "USP_ACCOUNT_CONFLICT",
            "Conta existente: solicite ao responsável a vinculação pelo número USP.",
          );
        throw error;
      }
    },
    async refresh(directory: Directory) {
      const users = await pool.query<UserRow>("SELECT * FROM app_user");
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
