import { randomUUID } from "node:crypto";
import request from "supertest";
import { expect, it } from "vitest";
import { context, pdfFile, sampleFiles, upload } from "../test/context.js";

it("S5/HU06: acompanha bytes e feedback da versão original, revogando todos os acessos", async () => {
  const { app, client } = context();
  const student = client(1),
    evaluator = client(2),
    teacher = client(3);
  const base = "/api/projects/2";
  expect(
    (await teacher.put(`${base}/evaluators`).send({ evaluatorIds: [2] }))
      .status,
  ).toBe(200);
  const before = await evaluator.get(
    "/api/projects?groupId=2&status=PREPARACAO&pending=true",
  );
  expect(before.body.data).toHaveLength(1);
  expect(before.body.data[0].missingMaterials).toEqual([
    "VIDEO",
    "RELATORIO",
    "MANUAL",
  ]);
  const first = await upload(
    student,
    `${base}/materials`,
    { kind: "RELATORIO" },
    pdfFile("original.pdf"),
  );
  expect(first.status).toBe(201);
  const material = first.body.data;
  const version = material.currentVersion;
  const sent = await evaluator
    .post(`${base}/messages`)
    .send({
      clientMessageId: randomUUID(),
      body: "Revisar esta versão",
      materialVersionId: version.id,
    });
  expect(sent.status).toBe(201);
  const second = await upload(
    student,
    `${base}/materials/${material.id}/versions`,
    {},
    {
      filename: "revisado.pdf",
      content: Buffer.from("%PDF-1.7\nrevisão\n%%EOF\n"),
    },
  );
  expect(second.status).toBe(201);
  for (const kind of ["VIDEO", "MANUAL"]) {
    expect(
      (
        await upload(
          student,
          `${base}/materials`,
          { kind },
          kind === "VIDEO"
            ? { content: sampleFiles.mp4, filename: "video.mp4" }
            : pdfFile("manual.pdf"),
        )
      ).status,
    ).toBe(201);
  }
  const complete = await evaluator.get(
    "/api/projects?groupId=2&status=PREPARACAO&pending=false",
  );
  expect(complete.body.data).toHaveLength(1);
  expect(complete.body.data[0].missingMaterials).toEqual([]);
  const history = (await evaluator.get(`${base}/materials`)).body.data.find(
    (item: { id: number }) => item.id === material.id,
  );
  expect(history.versions.map((item: { id: number }) => item.id)).toEqual([
    second.body.data.currentVersion.id,
    version.id,
  ]);
  for (const actor of [student, evaluator, teacher]) {
    const original = await actor.get(version.downloadUrl);
    expect(original.status).toBe(200);
    expect(original.body).toEqual(sampleFiles.pdf);
    const messages = await actor.get(`${base}/messages`);
    expect(messages.body.data[0].materialVersion).toMatchObject({
      id: version.id,
      versionNumber: 1,
    });
    expect(
      (await actor.get(second.body.data.currentVersion.downloadUrl)).body,
    ).toEqual(Buffer.from("%PDF-1.7\nrevisão\n%%EOF\n"));
  }
  expect(
    (await teacher.put(`${base}/evaluators`).send({ evaluatorIds: [] })).status,
  ).toBe(200);
  for (const path of [
    base,
    `${base}/materials`,
    `${base}/messages`,
    version.downloadUrl,
    second.body.data.currentVersion.downloadUrl,
  ]) {
    expect((await evaluator.get(path)).status).toBe(404);
    expect((await request(app).get(path)).status).toBe(401);
  }
  expect(
    (await evaluator.get("/api/projects?groupId=2&pending=false")).body.data,
  ).toEqual([]);
  expect(
    (
      await evaluator
        .post(`${base}/messages`)
        .send({
          clientMessageId: randomUUID(),
          body: "Não permitido",
          materialVersionId: version.id,
        })
    ).status,
  ).toBe(404);
});
