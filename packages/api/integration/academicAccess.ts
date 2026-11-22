import assert from "node:assert/strict";
import type { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createPostgresAcademicAccessRepository } from "../src/repositories/postgresAcademicAccessRepository.js";
import { createPostgresAuthRepository } from "../src/repositories/postgresAuthRepository.js";
import { createPostgresIdentityRepository } from "../src/repositories/postgresIdentityRepository.js";

export async function verifyAcademicAccess(pool: Pool) {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const identity = createPostgresIdentityRepository(pool);
  const access = createPostgresAcademicAccessRepository(pool);
  const auth = createPostgresAuthRepository(pool);
  const user = await identity.saveProfile({
    subject: "academic-student",
    fullName: "Nome Google",
    email: "academic.student@usp.br",
    emailVerified: true,
  });
  const admin = await identity.saveProfile({
    subject: "academic-admin",
    fullName: "Admin USP",
    email: "academic.admin@usp.br",
    emailVerified: true,
  });
  await pool.query("UPDATE app_user SET role='ADMIN' WHERE id=$1", [admin.id]);
  const app = createApp({ auth, academicAccess: access, now: () => now });
  const cookie = `labrary_session=${await auth.createSession(user.id, now, 60000)}`;
  const adminCookie = `labrary_session=${await auth.createSession(admin.id, now, 60000)}`;
  const post = (path: string, actor = cookie) =>
    request(app).post(path).set("Cookie", actor).set("X-CSRF-Protection", "1");
  const remove = (id: number) =>
    request(app)
      .delete(`/api/admin/guests/${id}`)
      .set("Cookie", adminCookie)
      .set("X-CSRF-Protection", "1");
  assert.equal(
    (await request(app).get("/api/projects").set("Cookie", cookie)).status,
    403,
  );
  const profile = {
    fullName: "Nome Completo Confirmado",
    uspNumber: "987654321",
    entryYear: 2024,
  };
  const saved = await post("/api/auth/profile").send(profile);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.requiresAcademicProfile, false);
  assert.equal(
    (await request(app).get("/api/projects").set("Cookie", cookie)).status,
    200,
  );
  const refreshed = await identity.saveProfile({
    subject: "academic-student",
    fullName: "Nome automático Google",
    email: user.email,
    emailVerified: true,
  });
  assert.equal(refreshed.fullName, profile.fullName);
  assert.equal(refreshed.uspNumber, profile.uspNumber);
  assert.equal(refreshed.entryYear, profile.entryYear);
  const restart = createPostgresAuthRepository(pool);
  await restart.refresh!();
  assert.equal(restart.findById(user.id)?.academicProfileCompleted, true);
  assert.equal(restart.findById(user.id)?.entryYear, 2024);
  const other = await identity.saveProfile({
    subject: "academic-other",
    fullName: "Outro Aluno",
    email: "academic.other@usp.br",
    emailVerified: true,
  });
  await assert.rejects(access.saveProfile(other.id, profile, now), {
    code: "USP_NUMBER_IN_USE",
  });
  assert.equal(
    (
      await pool.query(
        "SELECT academic_profile_completed_at FROM app_user WHERE id=$1",
        [other.id],
      )
    ).rows[0].academic_profile_completed_at,
    null,
  );
  assert.equal(
    (
      await post("/api/admin/guests").send({
        email: "guest.external@gmail.com",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/api/admin/guests", adminCookie).send({
        email: "conta@usp.br",
      })
    ).status,
    400,
  );
  const invited = await post("/api/admin/guests", adminCookie).send({
    email: "GUEST.EXTERNAL@gmail.com",
  });
  assert.equal(invited.status, 201, JSON.stringify(invited.body));
  const repeated = await post("/api/admin/guests", adminCookie).send({
    email: "guest.external@gmail.com",
  });
  assert.equal(repeated.body.data.id, invited.body.data.id);
  assert.equal(
    await createPostgresAcademicAccessRepository(pool).isGuest(
      "guest.external@gmail.com",
    ),
    true,
  );
  const guest = await identity.saveProfile({
    subject: "academic-guest",
    fullName: "Pessoa Convidada",
    email: "guest.external@gmail.com",
    emailVerified: true,
  });
  const guestToken = await auth.createSession(guest.id, now, 60000);
  const guestMe = await request(app)
    .get("/api/auth/me")
    .set("Cookie", `labrary_session=${guestToken}`);
  assert.equal(guestMe.status, 200);
  assert.equal(guestMe.body.data.guest, true);
  assert.equal(guestMe.body.data.requiresAcademicProfile, false);
  assert.equal(guestMe.body.data.role, "ALUNO");
  assert.equal((await remove(999999)).status, 404);
  assert.equal((await remove(invited.body.data.id)).status, 204);
  assert.equal((await remove(invited.body.data.id)).status, 204);
  assert.equal(await auth.getSession(guestToken, now), undefined);
  assert.equal(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Cookie", `labrary_session=${guestToken}`)
    ).status,
    401,
  );
  assert.equal(await access.isGuest(guest.email), false);
  const reissued = await post("/api/admin/guests", adminCookie).send({
    email: guest.email,
  });
  assert.notEqual(reissued.body.data.id, invited.body.data.id);
  const history = await access.listInvitations();
  assert.equal(history.length, 2);
  assert.equal(history[0].revokedBy, admin.id);
  assert.ok(history[0].revokedAt);
  await pool.query("UPDATE app_user SET active=false WHERE id=$1", [admin.id]);
  await assert.rejects(access.invite(admin.id, "not-invited@gmail.com", now), {
    code: "ADMIN_REQUIRED",
  });
  assert.equal(await access.isGuest("not-invited@gmail.com"), false);
  await pool.query("UPDATE app_user SET active=true WHERE id=$1", [admin.id]);
  // Novo processo enxerga tanto a autorização vigente quanto o histórico.
  assert.equal(
    await createPostgresAcademicAccessRepository(pool).isGuest(guest.email),
    true,
  );
  console.log(
    "Cadastro USP e convites: persistência, unicidade, histórico, reinício e revogação verificados.",
  );
}
