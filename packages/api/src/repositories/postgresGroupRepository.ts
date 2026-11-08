import { Pool, PoolClient } from "pg";
import { ApiError } from "../errors.js";
import { LinkChange } from "../models/group.js";
import { GroupRepository } from "./groupRepository.js";

export function createPostgresGroupRepository(pool: Pool): GroupRepository {
  async function transaction<T>(
    classId: number,
    actorId: number,
    action: (client: PoolClient) => Promise<T>,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serializa vínculos por turma e revalida autoridade após esperar pelo bloqueio.
      const scope = await client.query(
        `SELECT c.id FROM course_class c JOIN app_user u ON u.id=$2
         WHERE c.id=$1 AND u.active AND (u.role='ADMIN' OR (u.role='PROFESSOR' AND c.professor_id=u.id)) FOR UPDATE OF c FOR SHARE OF u`,
        [classId, actorId],
      );
      if (!scope.rows.length)
        throw new ApiError(404, "CLASS_NOT_FOUND", "Turma não encontrada.");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505")
        throw new ApiError(
          409,
          "GROUP_EXISTS",
          "Já existe um grupo com este nome na turma.",
        );
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    createGroup(classId, name, actorId) {
      return transaction(classId, actorId, async (client) => {
        const result = await client.query(
          `INSERT INTO student_group(class_id,name) VALUES ($1,$2)
           RETURNING id::integer, class_id::integer AS "classId", name`,
          [classId, name],
        );
        return { ...result.rows[0], memberIds: [] };
      });
    },
    setLinks(classId, change) {
      return transaction(classId, change.changedBy, async (client) => {
        const role = change.target === "GROUP" ? "ALUNO" : "AVALIADOR";
        const people = await client.query(
          "SELECT id FROM app_user WHERE id=ANY($1::bigint[]) AND active AND (role=$2::user_role OR role='ADMIN') FOR SHARE",
          [change.after, role],
        );
        if (people.rows.length !== change.after.length)
          throw new ApiError(
            400,
            "INVALID_LINK",
            "Selecione contas ativas do perfil correto.",
          );
        if (change.target === "GROUP") {
          const found = await client.query(
            "SELECT id FROM student_group WHERE id=$1 AND class_id=$2 FOR UPDATE",
            [change.targetId, classId],
          );
          if (!found.rows.length)
            throw new ApiError(404, "GROUP_NOT_FOUND", "Grupo não encontrado.");
        }
        const before: number[] = (
          await client.query(
            change.target === "GROUP"
              ? "SELECT user_id::integer AS id FROM group_membership WHERE group_id=$1 AND left_at IS NULL ORDER BY user_id"
              : "SELECT evaluator_id::integer AS id FROM project_evaluator WHERE project_id=$1 ORDER BY evaluator_id",
            [change.targetId],
          )
        ).rows.map((row) => row.id);
        if (
          before.length === change.after.length &&
          before.every((id) => change.after.includes(id))
        )
          return;
        if (change.target === "GROUP") {
          await client.query(
            "UPDATE group_membership SET left_at=GREATEST($3::timestamptz,joined_at) WHERE group_id=$1 AND left_at IS NULL AND NOT (user_id=ANY($2::bigint[]))",
            [change.targetId, change.after, change.changedAt],
          );
          for (const person of change.after.filter(
            (id) => !before.includes(id),
          ))
            await client.query(
              "INSERT INTO group_membership(group_id,user_id,joined_at) VALUES ($1,$2,$3)",
              [change.targetId, person, change.changedAt],
            );
        } else {
          await client.query(
            "DELETE FROM project_evaluator WHERE project_id=$1",
            [change.targetId],
          );
          for (const person of change.after)
            await client.query(
              "INSERT INTO project_evaluator(project_id,evaluator_id,assigned_at) VALUES ($1,$2,$3)",
              [change.targetId, person, change.changedAt],
            );
        }
        await client.query(
          "INSERT INTO academic_link_audit(target,target_id,before_ids,after_ids,changed_by,changed_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            change.target,
            change.targetId,
            before,
            change.after,
            change.changedBy,
            change.changedAt,
          ],
        );
      });
    },
    async history(target, targetId) {
      const result = await pool.query(
        `SELECT target,target_id::integer AS "targetId",before_ids AS "before",after_ids AS "after",changed_by::integer AS "changedBy",changed_at AS "changedAt"
         FROM academic_link_audit WHERE target=$1 AND target_id=$2 ORDER BY id`,
        [target, targetId],
      );
      return result.rows.map((row) => ({
        ...row,
        before: row.before.map(Number),
        after: row.after.map(Number),
        changedAt: row.changedAt.toISOString(),
      })) as LinkChange[];
    },
  };
}
