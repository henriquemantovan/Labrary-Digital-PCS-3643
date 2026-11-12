import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { publicationContext, publicationInput } from "../test/publication.js";
import {
  context,
  sampleFiles,
  storedMaterial,
  versionInput,
} from "../test/context.js";
import { publicProjectSchema } from "../models/publication.js";
const management = "/api/projects/1/publication",
  finalization = "/api/projects/1/finalization";
const finalize = async (c: Awaited<ReturnType<typeof publicationContext>>) =>
  c.client(3).post(finalization).send({ submissionId: 11 });
const publish = async (c: Awaited<ReturnType<typeof publicationContext>>) =>
  c.client(3).post(management).send(publicationInput);
const binary = (req: request.Test) =>
  req.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on("data", (b: Buffer) => chunks.push(b));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
describe("HU11 — finalização e publicação", () => {
  it("mantém as mutações fechadas sem os adapters reais e permite acervo vazio", async () => {
    const c = context();
    expect((await c.client(3).get(management)).body.data).toMatchObject({
      canFinalize: false,
      canPublish: false,
    });
    expect(
      (await c.client(3).post(finalization).send({ submissionId: 11 })).body
        .error.code,
    ).toBe("PUBLICATION_INTEGRATION_UNAVAILABLE");
    expect((await request(c.app).get("/api/catalog")).body).toEqual({
      data: [],
    });
    expect((await request(c.app).get("/api/catalog/1")).status).toBe(404);
    expect((await c.client(3).delete(management)).status).toBe(204);
  });
  it("exige sessão, CSRF, papel e escopo docente e usa a conta real do ADMIN", async () => {
    const c = await publicationContext();
    for (const path of [management, finalization])
      expect(
        (
          await request(c.app)
            .post(path)
            .set("X-CSRF-Protection", "1")
            .send(publicationInput)
        ).status,
      ).toBe(401);
    expect((await request(c.app).get(management)).status).toBe(401);
    expect(
      (
        await c
          .client(3)
          .post(finalization)
          .unset("X-CSRF-Protection")
          .send({ submissionId: 11 })
      ).status,
    ).toBe(403);
    for (const actor of [1, 2]) {
      expect((await c.client(actor).get(management)).status).toBe(403);
      expect(
        (await c.client(actor).post(finalization).send({ submissionId: 11 }))
          .status,
      ).toBe(403);
      expect((await c.client(actor).delete(management)).status).toBe(403);
    }
    c.auth.directory.classes.push({
      id: 2,
      name: "Externa",
      academicYear: 2026,
      professorId: 99,
    });
    c.repository.create({
      classId: 2,
      groupId: 20,
      title: "Privado",
      description: "",
      category: "Digital",
    });
    expect((await c.client(3).get("/api/projects/3/publication")).status).toBe(
      404,
    );
    expect(
      (await c.client(3).get("/api/projects/999/publication")).status,
    ).toBe(404);
    c.auth.directory.users.push({
      ...c.auth.directory.users[2],
      id: 200,
      email: "admin@example.com",
      role: "ADMIN",
    });
    const admin = c.client(200);
    await admin.post("/api/auth/view-role").send({ role: "PROFESSOR" });
    expect((await admin.get(management)).status).toBe(404);
    await admin.post("/api/auth/view-role").send({ role: null });
    expect(
      (await admin.post(finalization).send({ submissionId: 11 })).status,
    ).toBe(200);
    expect(c.repository.publicationHistory(1)[0].actorId).toBe(200);
  });
  it("finaliza de forma explícita e só publica as versões selecionadas com autorização do grupo", async () => {
    const c = await publicationContext();
    expect((await c.client(3).get(management)).body.data.canFinalize).toBe(
      true,
    );
    expect((await publish(c)).status).toBe(409);
    expect((await finalize(c)).status).toBe(200);
    expect(c.repository.get(1)?.status).toBe("FINALIZADO");
    expect((await request(c.app).get("/api/catalog/1")).status).toBe(404);
    expect((await c.client(3).get(management)).body.data.canPublish).toBe(true);
    expect((await finalize(c)).status).toBe(200);
    expect(c.repository.publicationHistory(1)).toHaveLength(1);
    const result = await publish(c);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({
      status: "PUBLICADO",
      canPublish: false,
    });
    expect(result.body.data.history[1].authorizationReference).toBe(
      publicationInput.groupAuthorization.reference,
    );
    const publicResult = await request(c.app).get("/api/catalog/1");
    expect(publicResult.status).toBe(200);
    publicProjectSchema.parse(publicResult.body.data);
    expect(
      publicResult.body.data.materials.map(
        (m: { versionId: number }) => m.versionId,
      ),
    ).toEqual([1, 2]);
    expect(publicResult.text).not.toMatch(
      /storageKey|checksum|uploadedBy|submittedBy|rubric|evaluations|messages|groupAuthorization/,
    );
    expect(
      (await request(c.app).get("/api/catalog/1/materials/3/file")).status,
    ).toBe(404);
    expect((await publish(c)).status).toBe(200);
    expect(c.repository.publicationHistory(1)).toHaveLength(2);
    expect(
      (
        await c
          .client(3)
          .post(management)
          .send({ ...publicationInput, materialVersionIds: [3] })
      ).body.error.code,
    ).toBe("PUBLICATION_ALREADY_ACTIVE");
    for (const query of [
      "q=SEM%C3%81FORO&academicYear=2026&classId=1&category=Sistemas%20digitais",
      "q=%20controlador%20",
    ])
      expect(
        (await request(c.app).get(`/api/catalog?${query}`)).body.data,
      ).toHaveLength(1);
    for (const query of [
      "q=inexistente",
      "academicYear=2025",
      "classId=99",
      "category=Outra",
    ])
      expect(
        (await request(c.app).get(`/api/catalog?${query}`)).body.data,
      ).toEqual([]);
    expect(publicResult.headers["cache-control"]).toBe("no-store");
  });
  it("valida os campos e exige autorização explícita, listas únicas e versões do snapshot", async () => {
    const c = await publicationContext();
    await finalize(c);
    for (const input of [
      {
        ...publicationInput,
        groupAuthorization: { confirmed: false, reference: "Ata" },
      },
      { ...publicationInput, groupAuthorization: undefined },
      {
        ...publicationInput,
        groupAuthorization: { confirmed: true, reference: "" },
      },
      { ...publicationInput, materialVersionIds: [] },
      { ...publicationInput, materialVersionIds: [1, 1] },
      { ...publicationInput, role: "ADMIN" },
    ])
      expect((await c.client(3).post(management).send(input)).status).toBe(400);
    expect(
      (
        await c
          .client(3)
          .post(management)
          .send({ ...publicationInput, materialVersionIds: [999] })
      ).body.error.code,
    ).toBe("PUBLICATION_VERSION_CONFLICT");
    expect(
      (await c.client(3).post(finalization).send({ submissionId: 99 })).status,
    ).toBe(409);
    for (const url of [
      "/api/catalog?classId=abc",
      "/api/catalog?unknown=1",
      "/api/catalog?academicYear=0",
      "/api/catalog/abc",
      management.replace("1", "abc"),
    ])
      expect((await c.client(3).get(url)).status).toBe(400);
  });
  it("serve bytes e intervalos com HEAD e bloqueia links copiados após retirada sem apagar arquivos privados", async () => {
    const c = await publicationContext();
    await finalize(c);
    await publish(c);
    const url = "/api/catalog/1/materials/1/file";
    const full = await binary(request(c.app).get(url));
    expect(full.status).toBe(200);
    expect(full.body).toEqual(sampleFiles.mp4);
    expect(full.headers["content-disposition"]).toMatch(/^inline;/);
    for (const [range, start, end] of [
      ["bytes=0-3", 0, 3],
      ["bytes=4-", 4, sampleFiles.mp4.length - 1],
      ["bytes=-4", sampleFiles.mp4.length - 4, sampleFiles.mp4.length - 1],
      ["bytes=0-9999", 0, sampleFiles.mp4.length - 1],
    ] as const) {
      const res = await binary(request(c.app).get(url).set("Range", range));
      expect(res.status).toBe(206);
      expect(res.body).toEqual(sampleFiles.mp4.subarray(start, end + 1));
      expect(res.headers["content-range"]).toBe(
        `bytes ${start}-${end}/${sampleFiles.mp4.length}`,
      );
      expect(res.headers["cache-control"]).toBe("no-store");
    }
    for (const range of [
      "bytes=999-",
      "bytes=2-1",
      "bytes=0-1,3-4",
      "bytes=-0",
      "bytes=-",
      "items=0-2",
      "bytes=9007199254740993-",
    ]) {
      const res = await request(c.app).get(url).set("Range", range);
      expect(res.status).toBe(416);
      expect(res.headers["content-range"]).toBe(
        `bytes */${sampleFiles.mp4.length}`,
      );
    }
    const head = await request(c.app).head(url);
    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    expect(head.headers["content-length"]).toBe(String(sampleFiles.mp4.length));
    const pdf = await binary(
      request(c.app).get("/api/catalog/1/materials/2/file"),
    );
    expect(pdf.body).toEqual(sampleFiles.pdf);
    expect(pdf.headers["content-disposition"]).toMatch(/^attachment;/);
    await c
      .client(3)
      .post("/api/projects/1/messages")
      .send({ clientMessageId: crypto.randomUUID(), body: "Conversa privada" });
    expect((await c.client(3).delete(management)).status).toBe(204);
    expect((await c.client(3).delete(management)).status).toBe(204);
    expect(c.repository.publicationHistory(1).map((e) => e.action)).toEqual([
      "FINALIZADO",
      "PUBLICADO",
      "RETIRADO",
    ]);
    expect(c.repository.listMaterials(1)).toHaveLength(3);
    expect(c.repository.listMessages(1)).toHaveLength(1);
    expect((await request(c.app).get("/api/catalog")).body.data).toEqual([]);
    for (const req of [
      request(c.app).get(url),
      request(c.app).get(url).set("Range", "bytes=0-1"),
      request(c.app).head(url),
      request(c.app).get("/api/catalog/1"),
    ]) {
      const result = await req;
      expect(result.status).toBe(404);
      expect(result.headers["content-range"]).toBeUndefined();
      expect(result.headers["cache-control"]).toBe("no-store");
    }
    expect((await c.client(3).get("/api/projects/1/materials")).status).toBe(
      200,
    );
    expect((await publish(c)).status).toBe(200);
    expect(c.repository.publicationHistory(1)).toHaveLength(4);
  });
  it("recusa entrega/avaliação incompleta mesmo com resultado liberado e não aceita outra rodada", async () => {
    const c = await publicationContext();
    const initial = structuredClone(c.data);
    const reset = () => {
      c.data.submission = structuredClone(initial.submission);
      c.data.evaluations = structuredClone(initial.evaluations);
    };
    for (const alter of [
      () => {
        c.data.submission = undefined;
      },
      () => {
        c.data.submission!.status = "DEVOLVIDA";
        c.data.submission!.returnedAt = new Date().toISOString();
      },
      () => {
        c.data.evaluations = undefined;
      },
      () => {
        c.data.evaluations!.completedEvaluatorIds = [];
        c.data.evaluations!.resultReleased = true;
      },
      () => {
        c.data.evaluations!.allEvaluationsCompleted = false;
      },
      () => {
        c.data.evaluations!.round = 2;
      },
      () => {
        c.data.submission!.materials[0].sizeBytes++;
      },
      () => {
        c.data.submission!.rubric.classId = 99;
      },
    ]) {
      reset();
      alter();
      expect((await finalize(c)).status).toBe(409);
      expect(c.repository.get(1)?.status).toBe("EM_AVALIACAO");
    }
    reset();
    await finalize(c);
    c.data.submission!.round = 2;
    c.data.evaluations!.round = 2;
    expect((await publish(c)).body.error.code).toBe(
      "PUBLICATION_VERSION_CONFLICT",
    );
  });
  it("serializa solicitações concorrentes e mantém idempotência do histórico", async () => {
    const c = await publicationContext();
    expect(
      (await Promise.all([finalize(c), finalize(c)])).map((r) => r.status),
    ).toEqual([200, 200]);
    expect(
      (await Promise.all([publish(c), publish(c)])).map((r) => r.status),
    ).toEqual([200, 200]);
    expect(c.repository.publicationHistory(1)).toHaveLength(2);
    const old = JSON.stringify(c.repository.publicationHistory(1));
    c.repository.publicationHistory(1)[1].actorId = 999;
    expect(JSON.stringify(c.repository.publicationHistory(1))).toBe(old);
  });
  it("recusa bytes removidos ou divergentes e revalida a retirada durante a abertura", async () => {
    const c = await publicationContext();
    await finalize(c);
    await publish(c);
    const version = c.repository.getMaterial(1, 1)!.versions[0];
    const open = c.storage.open.bind(c.storage);
    vi.spyOn(c.storage, "open").mockImplementationOnce(async (key) => {
      await c.client(3).delete(management);
      return open(key);
    });
    expect(
      (await request(c.app).get("/api/catalog/1/materials/1/file")).status,
    ).toBe(404);
    await publish(c);
    await c.storage.remove(version.storageKey);
    expect(
      (await request(c.app).get("/api/catalog/1/materials/1/file")).status,
    ).toBe(404);
    expect((await c.client(3).delete(management)).status).toBe(204);
    expect((await publish(c)).status).toBe(409);
  });
});

it("retirada durante a consulta ao disco não revela tamanho por Range inválido", async () => {
  const c = await publicationContext();
  await finalize(c);
  await publish(c);
  const open = c.storage.open.bind(c.storage);
  vi.spyOn(c.storage, "open").mockImplementationOnce(async (key) => {
    await c.client(3).delete(management);
    return open(key);
  });
  const result = await request(c.app)
    .get("/api/catalog/1/materials/1/file")
    .set("Range", "bytes=999999-");
  expect(result.status).toBe(404);
  expect(result.headers["content-range"]).toBeUndefined();
});

it("uma falha dos provedores impede novas decisões e não impede consultar ou retirar publicação ativa", async () => {
  const c = await publicationContext();
  const failure = vi
    .spyOn(c.providers.submissions, "latest")
    .mockRejectedValueOnce(new Error("Serviço indisponível"));
  expect((await finalize(c)).status).toBe(503);
  failure.mockRestore();
  await finalize(c);
  await publish(c);
  vi.spyOn(c.providers.submissions, "latest").mockRejectedValue(
    new Error("Serviço indisponível"),
  );
  expect((await c.client(3).get(management)).body.data.status).toBe(
    "PUBLICADO",
  );
  expect((await c.client(3).delete(management)).status).toBe(204);
  expect((await publish(c)).status).toBe(503);
});

it("mudança de atribuição durante a verificação dos arquivos impede finalização", async () => {
  const c = await publicationContext(),
    open = c.storage.open.bind(c.storage);
  vi.spyOn(c.storage, "open").mockImplementationOnce(async (key) => {
    c.auth.directory.assignments = [];
    return open(key);
  });
  expect((await finalize(c)).body.error.code).toBe(
    "PUBLICATION_VERSION_CONFLICT",
  );
  expect(c.repository.get(1)?.status).toBe("EM_AVALIACAO");
});
