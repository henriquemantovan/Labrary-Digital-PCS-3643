import request from "supertest";
import { describe, expect, it } from "vitest";
import { context } from "../test/context.js";
import { exampleRound, finalizeSecond, reopenFirst } from "../test/evaluations.js";
import { EvaluationRound } from "../models/consolidation.js";
import { createResultReleaseRepository } from "../repositories/resultReleaseRepository.js";

function setup() {
  let round: EvaluationRound | undefined = exampleRound();
  const releases = createResultReleaseRepository();
  const ctx = context({ evaluations: { getCurrentRound: async projectId => projectId === 1 ? round : undefined }, resultReleases: releases });
  const finalize = () => {
    finalizeSecond(round!);
  };
  const confirmation = async () => {
    const response = await ctx.client(3).get("/api/projects/1/results/consolidation");
    expect(response.status).toBe(200);
    return { submissionId: response.body.data.result.submissionId, fingerprint: response.body.data.fingerprint };
  };
  return { ...ctx, finalize, confirmation, setRound: (next?: EvaluationRound) => { round = next; }, getRound: () => round! };
}
describe("notas privadas e liberação explícita", () => {
  it("consolida a turma e exporta CSV coerente sem arredondar JSON", async () => {
    const { client } = setup();
    const result = await client(3).get("/api/classes/1/grades");
    expect(result.status).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body.data).toHaveLength(2);
    expect(result.body.data[0]).toMatchObject({ groupName: "Grupo 01", status: "PARTIAL", grade: 8.0561, finalGrade: null, resultReleased: false });
    expect(result.body.data[1]).toMatchObject({ status: "NO_SUBMISSION", grade: null });
    const csv = await client(3).get("/api/classes/1/grades?format=csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toContain("notas-turma-1.csv");
    expect(csv.text).toContain('"8.06","Parcial","Não"');
    expect(csv.text).toContain('"—","Sem submissão","Não"');
    expect((await client(3).get("/api/classes/1/grades?format=json")).status).toBe(400);
    expect((await client(3).get("/api/classes/no/grades")).status).toBe(400);
  });
  it("nega anônimo, aluno, avaliador e professor de outra turma, inclusive CSV/URL direta", async () => {
    const { app, auth, client } = setup();
    auth.directory.users.push({ ...auth.directory.users[2], id: 9, email: "outro@usp.br" });
    for (const path of ["/api/classes/1/grades", "/api/classes/1/grades?format=csv", "/api/projects/1/results/consolidation"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await client(1).get(path)).status).toBe(403);
      expect((await client(2).get(path)).status).toBe(403);
      expect((await client(9).get(path)).status).toBe(404);
    }
    expect((await client(3).get("/api/classes/99/grades")).status).toBe(404);
    expect((await client(3).get("/api/projects/99/results/consolidation")).status).toBe(404);
    for (const actor of [1, 2, 9]) expect((await client(actor).post("/api/projects/1/results/release").send({})).status).toBe(actor === 9 ? 404 : 403);
    expect((await request(app).post("/api/projects/1/results/release").set("X-CSRF-Protection", "1").send({})).status).toBe(401);
    expect((await request(app).post("/api/projects/1/results/release").send({})).status).toBe(403);
  });
  it("separa completude, liberação e publicação; oculta notas até liberação", async () => {
    const ctx = setup(); const { client, auth } = ctx;
    auth.directory.groups[0].memberIds = [1];
    const hidden = await client(1).get("/api/projects/1/result");
    expect(hidden.body.data).toEqual({ projectId: 1, resultReleased: false });
    expect((await client(3).post("/api/projects/1/results/release").send(await ctx.confirmation())).status).toBe(409);
    ctx.finalize();
    const before = await client(3).get("/api/projects/1/results/consolidation");
    expect(before.body.data.result).toMatchObject({ allEvaluationsCompleted: true, resultReleased: false, status: "FINAL" });
    const body = await ctx.confirmation();
    const released = await client(3).post("/api/projects/1/results/release").send(body);
    expect(released.status).toBe(200);
    expect(released.body.data).toMatchObject({ resultReleased: true, allEvaluationsCompleted: true });
    expect((await client(3).post("/api/projects/1/results/release").send(body)).body).toEqual(released.body);
    const visible = await client(1).get("/api/projects/1/result");
    expect(visible.body.data).toMatchObject({ resultReleased: true, rubricVersionId: 1 });
    expect(visible.body.data.evaluations[1].scores[1].comment).toBe("Muito bom");
    expect(visible.body.data).not.toHaveProperty("fingerprint");
    expect(visible.body.data.evaluations[0]).not.toHaveProperty("history");
    expect(ctx.repository.get(1)!.status).toBe("EM_AVALIACAO");
    expect((await client(1).get("/api/projects/2/result")).status).toBe(200);
    auth.directory.groups[1].memberIds = [];
    expect((await client(1).get("/api/projects/2/result")).status).toBe(404);
    expect((await client(2).get("/api/projects/1/result")).status).toBe(403);
    expect((await client(2).get("/api/projects/2/result")).status).toBe(404);
  });
  it("revoga exibição em reabertura, alteração de notas e nova rodada; protege tela antiga", async () => {
    const ctx = setup(); ctx.auth.directory.groups[0].memberIds = [1]; ctx.finalize();
    const body = await ctx.confirmation();
    await ctx.client(3).post("/api/projects/1/results/release").send(body);
    reopenFirst(ctx.getRound());
    expect((await ctx.client(1).get("/api/projects/1/result")).body.data).toEqual({ projectId: 1, resultReleased: false });
    ctx.getRound().evaluations[0].status = "FINALIZADA"; ctx.getRound().evaluations[0].revision++; ctx.getRound().evaluations[0].finalizedAt = "2026-11-12T13:00:00.000Z";
    expect((await ctx.client(1).get("/api/projects/1/result")).body.data.resultReleased).toBe(false);
    expect((await ctx.client(3).post("/api/projects/1/results/release").send(body)).body.error.code).toBe("RESULT_VERSION_CONFLICT");
    ctx.getRound().submissionId = 11; ctx.getRound().round++;
    expect((await ctx.client(3).post("/api/projects/1/results/release").send(body)).status).toBe(409);
    expect((await ctx.client(3).post("/api/projects/1/results/release").send({ ...body, fingerprint: "x" })).status).toBe(400);
    ctx.setRound();
    expect((await ctx.client(3).post("/api/projects/1/results/release").send(body)).body.error.code).toBe("EVALUATIONS_INCOMPLETE");
  });
  it("não inventa avaliações em produção e propaga erro de integração", async () => {
    const { client } = context();
    expect((await client(3).get("/api/classes/1/grades")).status).toBe(503);
    const empty = setup(); empty.repository.list = () => [];
    expect((await empty.client(3).get("/api/classes/1/grades")).body.data).toEqual([]);
  });
});
