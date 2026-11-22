import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Evaluation } from "../../api/src/models/evaluation";
import type { User } from "./api";
import { ProjectAssessment } from "./ProjectAssessment";
import type { Submission } from "./submissionTypes";
import { rubric } from "./test/assessmentFixtures";

const evaluator: User = { id: 2, fullName: "Rafael", email: "r@example.test", role: "AVALIADOR" };
const teacher: User = { id: 3, fullName: "Helena", email: "h@example.test", role: "PROFESSOR" };
const pending: Evaluation = {
  evaluatorId: 2, status: "PENDENTE", revision: 0, scores: [], finalizedAt: null, history: [],
};
const at = "2026-11-19T12:00:00.000Z";
const firstRound: Submission = {
  id: 10, projectId: 1, round: 1, clientSubmissionId: "7f1c2b8e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
  status: "DEVOLVIDA", submittedBy: 1, submittedAt: at, returnedAt: at, rubricVersionId: 1, rubric,
  materials: [{ materialId: 9, kind: "MANUAL", title: "Manual de uso", versionId: 14, versionNumber: 1,
    originalFilename: "manual.pdf", mimeType: "application/pdf", sizeBytes: 1234, checksumSha256: null }],
};
const secondRound: Submission = {
  ...firstRound, id: 11, round: 2, status: "SUBMETIDA", returnedAt: null, rubricVersionId: 2,
  rubric: { ...rubric, id: 2, versionNumber: 2, title: "Projeto revisado" },
  materials: [{ ...firstRound.materials[0], versionId: 15, versionNumber: 2 }],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(status < 400 ? { data } : { error: { message: data } }), { status });
}
function roundResponse(submission: Submission, evaluations: Evaluation[], options = {}) {
  return json({ submission, evaluations, canEdit: false, canReopen: false, ...options });
}
function openAs(user: User) {
  const expired = vi.fn();
  render(<ProjectAssessment projectId={1} user={user} expired={expired} />);
  const browser = userEvent.setup();
  return { expired, browser, open: () => browser.click(screen.getByRole("button", { name: "Avaliações por rubrica" })) };
}

afterEach(() => vi.unstubAllGlobals());

it("avalia a rodada real atual com rascunho parcial, mantém zero e exige todos os critérios na finalização", async () => {
  const requests: unknown[] = [];
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/submissions")) return json([firstRound, secondRound]);
    if (url.endsWith("/11/evaluations")) return roundResponse(secondRound, [pending], { canEdit: true });
    const payload = JSON.parse(String(options?.body));
    requests.push([url, options?.method, payload]);
    const update = (status: Evaluation["status"], revision: number, finalizedAt: string | null) => json({
      ...pending, status, revision, finalizedAt, scores: payload.scores,
    });
    if (url.endsWith("/me")) return update("RASCUNHO", 1, null);
    if (url.endsWith("/me/finalize")) return update("FINALIZADA", 2, at);
    return json("Rota inesperada", 404);
  });
  vi.stubGlobal("fetch", fetch);
  const { browser, open } = openAs(evaluator);
  expect(fetch).not.toHaveBeenCalled();
  await open();
  expect(await screen.findByRole("heading", { name: "Projeto revisado · Versão 2" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Manual de uso — versão 2" }).getAttribute("href")).toBe("/api/projects/1/materials/9/versions/15/file");
  await browser.type(screen.getByLabelText("Nota — Funcionamento"), "0");
  await browser.type(screen.getByLabelText("Comentário — Funcionamento"), "Sem resultado");
  await browser.click(screen.getByRole("button", { name: "Finalizar avaliação" }));
  expect(screen.getByRole("alert").textContent).toBe("Preencha a nota de Clareza.");
  expect(requests).toHaveLength(0);
  await browser.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect(await screen.findByText("Rascunho salvo.")).toBeDefined();
  expect((screen.getByLabelText("Nota — Funcionamento") as HTMLInputElement).value).toBe("0");
  await browser.type(screen.getByLabelText("Nota — Clareza"), "9.25");
  await browser.click(screen.getByRole("button", { name: "Finalizar avaliação" }));
  expect(await screen.findByText("Avaliação finalizada.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Salvar rascunho" })).toBeNull();
  const firstScore = { criterionId: "funciona", score: 0, comment: "Sem resultado" };
  expect(requests).toEqual([
    ["/api/projects/1/submissions/11/evaluations/me", "PUT", { expectedRevision: 0, scores: [firstScore] }],
    ["/api/projects/1/submissions/11/evaluations/me/finalize", "POST", {
      expectedRevision: 1, scores: [firstScore, { criterionId: "clareza", score: 9.25, comment: "" }],
    }],
  ]);
});

it("professora consulta rodada anterior sem editar e reabre a avaliação atual com justificativa no histórico", async () => {
  const scores = [{ criterionId: "funciona", score: 8, comment: "Versão entregue" }];
  const final: Evaluation = {
    ...pending, status: "FINALIZADA", revision: 1, finalizedAt: at, scores,
    history: [{ action: "FINALIZADA", actorId: 2, at, reason: null, revision: 1, scores }],
  };
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/submissions")) return json([firstRound, secondRound]);
    if (url.endsWith("/10/evaluations")) return roundResponse(firstRound, [final]);
    if (url.endsWith("/11/evaluations")) return roundResponse(secondRound, [final], { canReopen: true, evaluatorNames: { 2: "Rafael Costa" } });
    expect(url).toBe("/api/projects/1/submissions/11/evaluations/2/reopen");
    expect(options?.method).toBe("POST");
    const body = JSON.parse(String(options?.body));
    expect(body).toEqual({ reason: "Rever a nota.", expectedRevision: 1 });
    return json({ ...final, status: "REABERTA", revision: 2, finalizedAt: null,
      history: [...final.history, { action: "REABERTA", actorId: 3, at, reason: body.reason, revision: 2, scores }] });
  });
  vi.stubGlobal("fetch", fetch);
  const { browser, open } = openAs(teacher);
  await open();
  expect(await screen.findByRole("heading", { name: "Rafael Costa" })).toBeDefined();
  const rounds = screen.getByRole("combobox", { name: "Rodada de avaliação" });
  await browser.selectOptions(rounds, "10");
  expect(await screen.findByRole("heading", { name: "Projeto digital · Versão 1" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Avaliador 2" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Reabrir avaliação" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Salvar rascunho" })).toBeNull();
  await browser.selectOptions(rounds, "11");
  await browser.click(await screen.findByRole("button", { name: "Reabrir avaliação" }));
  await browser.type(screen.getByLabelText("Justificativa da reabertura"), "   ");
  await browser.click(screen.getByRole("button", { name: "Confirmar reabertura" }));
  expect(screen.getByRole("alert").textContent).toBe("Informe a justificativa da reabertura.");
  await browser.type(screen.getByLabelText("Justificativa da reabertura"), "Rever a nota.");
  await browser.click(screen.getByRole("button", { name: "Confirmar reabertura" }));
  expect(await screen.findByText("Avaliação reaberta.")).toBeDefined();
  await browser.click(screen.getByText("Histórico da avaliação (2)"));
  expect(screen.getByText("Justificativa: Rever a nota.")).toBeDefined();
  expect(screen.getByText(/Revisão 1 .* Conta 2/)).toBeDefined();
});

it("preserva o formulário quando o servidor recusa a revisão e encaminha sessão expirada", async () => {
  let expiredSession = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (expiredSession) return json("Sessão expirada", 401);
    if (url.endsWith("/submissions")) return json([secondRound]);
    if (options?.method === "PUT") return json("A avaliação foi alterada. Recarregue.", 409);
    return roundResponse(secondRound, [pending], { canEdit: true });
  }));
  const { browser, open, expired } = openAs(evaluator);
  await open();
  await browser.type(await screen.findByLabelText("Nota — Funcionamento"), "7");
  await browser.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  expect((await screen.findByRole("alert")).textContent).toContain("A avaliação foi alterada");
  expect((screen.getByLabelText("Nota — Funcionamento") as HTMLInputElement).value).toBe("7");
  expiredSession = true;
  await browser.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(expired).toHaveBeenCalledOnce());
});
