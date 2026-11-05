import { Pool } from "pg";
import {
  AdminRepository,
  assertRoleChange,
  ManagedUser,
} from "./adminRepository.js";
const columns = "id,full_name,email,role,active";
const fromRow = (row: Record<string, any>): ManagedUser => ({
  id: Number(row.id),
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  active: row.active,
});
export function createPostgresAdminRepository(pool: Pool): AdminRepository {
  return {
    async listUsers() {
      return (
        await pool.query(`SELECT ${columns} FROM app_user ORDER BY id`)
      ).rows.map(fromRow);
    },
    async changeRole(actorId, targetId, role, now) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Serialize role changes so two concurrent demotions cannot remove all admins.
        await client.query("SELECT pg_advisory_xact_lock(3643001)");
        const actor = (
          await client.query(
            `SELECT ${columns} FROM app_user WHERE id=$1 FOR UPDATE`,
            [actorId],
          )
        ).rows[0];
        const target = (
          await client.query(
            `SELECT ${columns} FROM app_user WHERE id=$1 FOR UPDATE`,
            [targetId],
          )
        ).rows[0];
        const activeAdmins = Number(
          (
            await client.query(
              "SELECT count(*) AS count FROM app_user WHERE active AND role='ADMIN'",
            )
          ).rows[0].count,
        );
        assertRoleChange(actor, target, role, activeAdmins);
        if (target.role !== role) {
          await client.query("UPDATE app_user SET role=$1 WHERE id=$2", [
            role,
            targetId,
          ]);
          await client.query(
            "UPDATE auth_session SET view_role=NULL WHERE user_id=$1",
            [targetId],
          );
          await client.query(
            "INSERT INTO user_role_audit(actor_id,target_id,previous_role,new_role,created_at) VALUES ($1,$2,$3,$4,$5)",
            [actorId, targetId, target.role, role, new Date(now)],
          );
        }
        await client.query("COMMIT");
        return fromRow({ ...target, role });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
