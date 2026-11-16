import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createPostgresAuthRepository } from "../src/repositories/postgresAuthRepository.js";
import { createPostgresIdentityRepository } from "../src/repositories/postgresIdentityRepository.js";
import { createPostgresGroupRepository } from "../src/repositories/postgresGroupRepository.js";
import { createMemoryProjectRepository } from "../src/repositories/projectRepository.js";
import { createFileProjectStorage } from "../src/repositories/fileProjectStorage.js";

export async function verifyGroups(pool: Pool, connectionString: string) {
  const identity = createPostgresIdentityRepository(pool);
  const student = await identity.saveProfile({
    subject: "hu02-student",
    fullName: "Estudante Google",
    email: "hu02-student@example.com",
    emailVerified: true,
  });
  const evaluator = await identity.saveProfile({
    subject: "hu02-evaluator",
    fullName: "Avaliador Google",
    email: "hu02-evaluator@example.com",
    emailVerified: true,
  });
  const teacher = await identity.saveProfile({
    subject: "hu02-teacher",
    fullName: "Professor Google",
    email: "hu02-teacher@example.com",
    emailVerified: true,
  });
  const administrator = await identity.saveProfile({
    subject: "hu02-admin",
    fullName: "Administrador Google",
    email: "hu02-admin@example.com",
    emailVerified: true,
  });
  await pool.query("UPDATE app_user SET role='PROFESSOR' WHERE id=$1", [
    teacher.id,
  ]);
  await pool.query("UPDATE app_user SET role='AVALIADOR' WHERE id=$1", [
    evaluator.id,
  ]);
  await pool.query("UPDATE app_user SET role='ADMIN' WHERE id=$1", [
    administrator.id,
  ]);
  const classId = Number(
    (
      await pool.query(
        "INSERT INTO course_class(name,academic_year,professor_id) VALUES ('HU02',2026,$1) RETURNING id",
        [teacher.id],
      )
    ).rows[0].id,
  );
  const foreignClass = Number(
    (
      await pool.query(
        "INSERT INTO course_class(name,academic_year,professor_id) VALUES ('Externa HU02',2026,$1) RETURNING id",
        [administrator.id],
      )
    ).rows[0].id,
  );
  const root = mkdtempSync(join(tmpdir(), "labrary-hu02-pg-"));
  const path = join(root, "projects.json");
  const now = Date.now();
  const auth = createPostgresAuthRepository(pool);
  const app = createApp({
    auth,
    groups: createPostgresGroupRepository(pool),
    repository: createMemoryProjectRepository(
      false,
      createFileProjectStorage(path),
    ),
    now: () => now,
  });
  const cookie = async (id: number) =>
    `labrary_session=${await auth.createSession(id, now, 60_000)}`;
  const teacherCookie = await cookie(teacher.id),
    studentCookie = await cookie(student.id),
    evaluatorCookie = await cookie(evaluator.id),
    adminCookie = await cookie(administrator.id);
  const mutate = (
    method: "post" | "put",
    url: string,
    body: unknown,
    session = teacherCookie,
  ) =>
    request(app)
      [method](url)
      .set("Cookie", session)
      .set("X-CSRF-Protection", "1")
      .send(body);
  try {
    const group = await mutate("post", `/api/classes/${classId}/groups`, {
      name: "Grupo Google",
    });
    assert.equal(group.status, 201);
    const groupId = group.body.data.id;
    assert.equal(
      (
        await mutate("post", `/api/classes/${classId}/groups`, {
          name: "Grupo Google",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await mutate("post", `/api/classes/${foreignClass}/groups`, {
          name: "Vedado",
        })
      ).status,
      404,
    );
    const project = await mutate("post", "/api/projects", {
      classId,
      groupId,
      title: "Projeto Google persistido",
      description: "HU02",
      category: "Digital",
    });
    assert.equal(project.status, 201);
    const projectId = project.body.data.id;
    const members = `/api/classes/${classId}/groups/${groupId}/members`,
      assignments = `/api/projects/${projectId}/evaluators`;
    assert.equal(
      (
        await mutate("put", members, {
          memberIds: [student.id, administrator.id],
        })
      ).status,
      200,
    );
    assert.equal(
      (await mutate("put", assignments, { evaluatorIds: [evaluator.id] }))
        .status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .get(`/api/projects/${projectId}`)
          .set("Cookie", studentCookie)
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .get(`/api/projects/${projectId}`)
          .set("Cookie", evaluatorCookie)
      ).status,
      200,
    );
    const anotherGroup = await mutate(
      "post",
      `/api/classes/${classId}/groups`,
      { name: "Segundo grupo explícito" },
    );
    assert.equal(
      (
        await mutate(
          "put",
          `/api/classes/${classId}/groups/${anotherGroup.body.data.id}/members`,
          { memberIds: [student.id] },
        )
      ).status,
      200,
    );
    assert.equal(
      (await mutate("put", members, { memberIds: [999999] })).status,
      400,
    );
    // Novas conexões e repositórios restauram dados e a sessão preexistente.
    const restartedPool = new Pool({ connectionString });
    try {
      const restartedAuth = createPostgresAuthRepository(restartedPool);
      const restarted = createApp({
        auth: restartedAuth,
        groups: createPostgresGroupRepository(restartedPool),
        repository: createMemoryProjectRepository(
          false,
          createFileProjectStorage(path),
        ),
        now: () => now,
      });
      assert.equal(
        (
          await request(restarted)
            .get(`/api/projects/${projectId}`)
            .set("Cookie", studentCookie)
        ).status,
        200,
      );
      const overview = await request(restarted)
        .get(`/api/classes/${classId}/administration`)
        .set("Cookie", teacherCookie);
      assert.deepEqual(
        overview.body.data.groups.find(
          (item: { id: number }) => item.id === groupId,
        ).history[0].after,
        [student.id, administrator.id],
      );
      assert.equal(
        (await request(restarted).get(assignments).set("Cookie", teacherCookie))
          .body.data.history.length,
        1,
      );
    } finally {
      await restartedPool.end();
    }
    const removed = await mutate("put", members, { memberIds: [] });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.data.history[1].before, [
      student.id,
      administrator.id,
    ]);
    assert.equal(
      (
        await request(app)
          .get(`/api/projects/${projectId}`)
          .set("Cookie", studentCookie)
      ).status,
      404,
    );
    assert.equal(
      (await mutate("put", assignments, { evaluatorIds: [] })).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .get(`/api/projects/${projectId}`)
          .set("Cookie", evaluatorCookie)
      ).status,
      404,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::integer AS n FROM group_membership WHERE group_id=$1 AND left_at IS NOT NULL",
          [groupId],
        )
      ).rows[0].n,
      2,
    );
    await mutate("post", "/api/auth/view-role", { role: "ALUNO" }, adminCookie);
    assert.equal(
      (await mutate("put", members, { memberIds: [student.id] }, adminCookie))
        .status,
      403,
    );
    // Operações concorrentes deixam uma cadeia de auditoria consistente.
    const results = await Promise.all([
      mutate("put", members, { memberIds: [student.id] }),
      mutate("put", members, { memberIds: [administrator.id] }),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      [200, 200],
    );
    const history = await createPostgresGroupRepository(pool).history(
      "GROUP",
      groupId,
    );
    assert.deepEqual(history[3].before, history[2].after);
    console.log(
      "PASS: HU02 PostgreSQL — contas Google/ADMIN, turma isolada, grupos e vínculos após reinício, revogação em sessão existente, histórico de participação e concorrência.",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
