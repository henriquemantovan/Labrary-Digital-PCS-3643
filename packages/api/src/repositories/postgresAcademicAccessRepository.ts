import type { Pool, PoolClient } from "pg";
import { ApiError } from "../errors.js";
import {
  academicProfileInputSchema,
  guestEmailSchema,
  isUspEmail,
  type GuestInvitation,
} from "../models/academicAccess.js";
import {
  type AcademicAccessRepository,
  assertAcademicStudent,
  assertGuestAdministrator,
  duplicatedUspNumber,
} from "./academicAccessRepository.js";
import { userFromRow, type UserRow } from "./postgresIdentityRepository.js";

const invitation = (row: Record<string, any>): GuestInvitation => ({
  id: Number(row.id),
  email: row.email,
  invitedBy: Number(row.invited_by),
  createdAt: row.created_at.toISOString(),
  revokedAt: row.revoked_at?.toISOString() ?? null,
  revokedBy: row.revoked_by === null ? null : Number(row.revoked_by),
});
const lockedUser = async (client: PoolClient, id: number) => {
  const row = (
    await client.query<UserRow>(
      "SELECT u.*, EXISTS(SELECT 1 FROM guest_invitation g WHERE g.email=u.email AND g.revoked_at IS NULL) AS guest FROM app_user u WHERE u.id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
  return row && userFromRow(row);
};
export function createPostgresAcademicAccessRepository(
  pool: Pool,
  developmentTestLogin = false,
): AcademicAccessRepository {
  async function transaction<T>(action: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Coordena convites, revogações e cadastro dentro deste adapter.
      await client.query("SELECT pg_advisory_xact_lock(3643002)");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async isGuest(email) {
      return (
        (
          await pool.query(
            "SELECT 1 FROM guest_invitation WHERE email=$1 AND revoked_at IS NULL",
            [email.toLowerCase()],
          )
        ).rows.length > 0
      );
    },
    async saveProfile(userId, input, now) {
      const parsed = academicProfileInputSchema(now).parse(input);
      try {
        await transaction(async (client) => {
          assertAcademicStudent(await lockedUser(client, userId), developmentTestLogin);
          await client.query(
            "UPDATE app_user SET full_name=$1,usp_number=$2,entry_year=$3,academic_profile_completed_at=$4 WHERE id=$5",
            [
              parsed.fullName,
              parsed.uspNumber,
              parsed.entryYear,
              new Date(now),
              userId,
            ],
          );
        });
      } catch (error) {
        if ((error as { code?: string }).code === "23505")
          throw duplicatedUspNumber();
        throw error;
      }
    },
    async listInvitations() {
      return (
        await pool.query("SELECT * FROM guest_invitation ORDER BY id")
      ).rows.map(invitation);
    },
    async invite(actorId, input, now) {
      const email = guestEmailSchema.parse(input);
      if (isUspEmail(email))
        throw new ApiError(
          400,
          "GUEST_NOT_REQUIRED",
          "Contas USP não precisam de convite.",
        );
      return transaction(async (client) => {
        assertGuestAdministrator(await lockedUser(client, actorId));
        const inserted = await client.query(
          "INSERT INTO guest_invitation(email,invited_by,created_at) VALUES ($1,$2,$3) ON CONFLICT (email) WHERE revoked_at IS NULL DO NOTHING RETURNING *",
          [email, actorId, new Date(now)],
        );
        const row =
          inserted.rows[0] ??
          (
            await client.query(
              "SELECT * FROM guest_invitation WHERE email=$1 AND revoked_at IS NULL",
              [email],
            )
          ).rows[0];
        return invitation(row);
      });
    },
    async revoke(actorId, invitationId, now) {
      await transaction(async (client) => {
        const actor = await lockedUser(client, actorId);
        assertGuestAdministrator(actor);
        const row = (
          await client.query(
            "SELECT * FROM guest_invitation WHERE id=$1 FOR UPDATE",
            [invitationId],
          )
        ).rows[0];
        if (!row)
          throw new ApiError(
            404,
            "INVITATION_NOT_FOUND",
            "Convite não encontrado.",
          );
        if (row.email === actor!.email)
          throw new ApiError(
            409,
            "OWN_INVITATION",
            "Outro administrador deve revogar seu acesso de convidado.",
          );
        if (!row.revoked_at) {
          await client.query(
            "UPDATE guest_invitation SET revoked_at=$1,revoked_by=$2 WHERE id=$3",
            [new Date(now), actorId, invitationId],
          );
          await client.query(
            "DELETE FROM auth_session WHERE user_id IN (SELECT id FROM app_user WHERE email=$1)",
            [row.email],
          );
        }
      });
    },
  };
}
