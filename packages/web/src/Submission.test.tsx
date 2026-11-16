import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionPanel } from "./Submission";
import type { Material, User } from "./api";
import type { Submission, SubmissionChecklist } from "./submissionTypes";

const student: User = { id: 1, fullName: "Marina", email: "a@example.test", role: "ALUNO" };
const professor: User = { id: 3, fullName: "Helena", email: "p@example.test", role: "PROFESSOR" };
const version = (id: number, versionNumber: number) => ({
  id, versionNumber, originalFilename: "relatorio.pdf", mimeType: "application/pdf", sizeBytes: 2400,
  uploadedBy: { id: 1, fullName: "Marina" }, uploadedAt: "2026-11-02T12:00:00.000Z",
  downloadUrl: `/api/projects/2/materials/5/versions/${id}/file`,
});
const materials: Material[] = [
  { id: 5, title: "Relatório", kind: "RELATORIO", currentVersion: version(9, 2), versions: [version(9, 2), version(8, 1)] },
];
const checklist = (overrides: Partial<SubmissionChecklist> = {}): SubmissionChecklist => ({
  projectStatus: "PREPARACAO",
  rubricVersionId: 1,
  items: [
    { kind: "VIDEO", label: "Vídeo de apresentação", materialId: null, versionId: null, ok: false },
    { kind: "RELATORIO", label: "Relatório do projeto", materialId: 5, versionId: 9, ok: true },
    { kind: "MANUAL", label: "Manual de uso", materialId: 6, versionId: 10, ok: false },
  ],
  blockedBy: "INCOMPLETE_SUBMISSION",
  canSubmit: false,
  ...overrides,
});
const round = (overrides: Partial<Submission> = {}): Submission => ({
  id: 11, projectId: 2, round: 1, clientSubmissionId: "7f1c2b8e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
  status: "SUBMETIDA", submittedBy: 1, submittedAt: "2026-11-08T12:00:00.000Z", returnedAt: null,
  rubricVersionId: 1,
  rubric: { id: 1, projectId: 2, classId: 1, versionNumber: 1, title: "Entrega", requirements: [], criteria: [], createdBy: 3, createdAt: "2026-11-01T12:00:00.000Z" },
  materials: [{ materialId: 5, kind: "RELATORIO", title: "Relatório", versionId: 9, versionNumber: 2,
    originalFilename: "relatorio.pdf", mimeType: "application/pdf", sizeBytes: 2400, checksumSha256: null }],
  ...overrides,
});

let state: { checklist: SubmissionChecklist; rounds: Submission[] };
let post: (url: string, body: unknown) => Response | Promise<Response>;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status >= 400 ? { error: { message: String(data) } } : { data }), { status });
const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
  if (options?.method === "POST") return post(url, options.body ? JSON.parse(String(options.body)) : undefined);
  if (url.endsWith("/submission-checklist")) return json(state.checklist);
  if (url.endsWith("/submissions")) return json(state.rounds);
  return json("Rota inesperada", 404);
});
beforeEach(() => {
  state = { checklist: checklist(), rounds: [] };
  post = () => json("Sem resposta configurada", 500);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const panel = (props: Partial<Parameters<typeof SubmissionPanel>[0]> = {}) => {
  const handlers = { expired: vi.fn(), onStatusChanged: vi.fn() };
  const view = render(<SubmissionPanel project={{ id: 2, status: "PREPARACAO" }} user={student}
    materials={materials} {...handlers} {...props} />);
  return { ...view, ...handlers };
};

it("mostra presentes, ausentes e incompatíveis e explica o bloqueio sem oferecer submissão", async () => {
  panel();
  expect(screen.getByRole("status").textContent).toBe("Carregando entrega…");
  const list = await screen.findByRole("list", { name: "Checklist da entrega" });
  const items = within(list).getAllByRole("listitem").map((item) => item.textContent);
  expect(items).toEqual([
    "Vídeo de apresentaçãoAusente",
    "Relatório do projetoPresente (versão 2)",
    "Manual de usoFormato ou tamanho fora do exigido",
  ]);
  expect(screen.getByText("1 de 3 obrigatórios prontos")).toBeDefined();
  expect(screen.getByText(/Envie todos os materiais obrigatórios/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Submeter para avaliação" })).toBeNull();
  expect(screen.getByText("Nenhuma rodada submetida ainda.")).toBeDefined();
});

it("explica rubrica ausente, prazo vencido e projeto em avaliação", async () => {
  state.checklist = checklist({ rubricVersionId: null, items: [], blockedBy: "RUBRIC_NOT_CONFIGURED" });
  const view = panel();
  expect(await screen.findByText(/ainda não configurou os requisitos/)).toBeDefined();
  expect(screen.queryByRole("list", { name: "Checklist da entrega" })).toBeNull();

  state.checklist = checklist({ blockedBy: "DEADLINE_PASSED" });
  view.rerender(<SubmissionPanel project={{ id: 2, status: "PREPARACAO" }} user={student} materials={materials}
    refreshKey={1} expired={vi.fn()} onStatusChanged={vi.fn()} />);
  expect(await screen.findByText(/O prazo de entrega terminou/)).toBeDefined();

  state.checklist = checklist({ projectStatus: "EM_AVALIACAO", blockedBy: "SUBMISSION_LOCKED" });
  view.rerender(<SubmissionPanel project={{ id: 2, status: "EM_AVALIACAO" }} user={student} materials={materials}
    refreshKey={1} expired={vi.fn()} onStatusChanged={vi.fn()} />);
  expect(await screen.findByText(/Projeto submetido e em avaliação/)).toBeDefined();

  state.checklist = checklist({ projectStatus: "FINALIZADO", blockedBy: "SUBMISSION_LOCKED" });
  view.rerender(<SubmissionPanel project={{ id: 2, status: "FINALIZADO" }} user={student} materials={materials}
    refreshKey={1} expired={vi.fn()} onStatusChanged={vi.fn()} />);
  expect(await screen.findByText("O projeto não está aberto para submissão.")).toBeDefined();
});

it("aluno confirma a submissão e o painel informa a rodada e o novo estado", async () => {
  state.checklist = checklist({ blockedBy: null, canSubmit: true });
  const bodies: unknown[] = [];
  post = (url, body) => {
    bodies.push(body);
    expect(url).toBe("/api/projects/2/submissions");
    state.rounds = [round()];
    return json(round(), 201);
  };
  const { onStatusChanged } = panel();
  await userEvent.click(await screen.findByRole("button", { name: "Submeter para avaliação" }));
  const confirm = screen.getByRole("group", { name: "Confirmar submissão" });
  expect(confirm.textContent).toContain("os materiais ficam bloqueados");
  await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("group", { name: "Confirmar submissão" })).toBeNull();
  expect(bodies).toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: "Submeter para avaliação" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar submissão" }));
  expect(await screen.findByText("Projeto submetido. A rodada 1 está em avaliação.")).toBeDefined();
  expect(bodies).toEqual([{ clientSubmissionId: expect.stringMatching(/^[0-9a-f-]{36}$/) }]);
  expect(onStatusChanged).toHaveBeenCalledWith("EM_AVALIACAO");
});

it("reutiliza o identificador após falha de rede e gera outro após recusa da API", async () => {
  state.checklist = checklist({ blockedBy: null, canSubmit: true });
  const ids: string[] = [];
  const answers: (() => Response)[] = [
    () => { throw new TypeError("offline"); },
    () => json("Materiais obrigatórios pendentes: Manual de uso.", 409),
    () => json(round(), 201),
  ];
  post = (_url, body) => {
    ids.push((body as { clientSubmissionId: string }).clientSubmissionId);
    return answers.shift()!();
  };
  panel();
  await userEvent.click(await screen.findByRole("button", { name: "Submeter para avaliação" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar submissão" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível conectar");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar submissão" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Manual de uso");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar submissão" }));
  await screen.findByText(/A rodada 1 está em avaliação/);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[2]).not.toBe(ids[1]);
});

it("professor devolve a rodada atual e vê o histórico com downloads das versões submetidas", async () => {
  state.checklist = checklist({ projectStatus: "EM_AVALIACAO", blockedBy: "SUBMISSION_LOCKED" });
  state.rounds = [round({ id: 10, round: 1, status: "DEVOLVIDA", returnedAt: "2026-11-09T12:00:00.000Z" }), round({ round: 2, submittedBy: 4 })];
  post = (url) => {
    expect(url).toBe("/api/projects/2/submissions/11/return");
    return json(round({ round: 2, status: "DEVOLVIDA", returnedAt: "2026-11-10T12:00:00.000Z" }));
  };
  const { onStatusChanged } = panel({ project: { id: 2, status: "EM_AVALIACAO" }, user: professor });
  const rounds = (await screen.findAllByText(/^Rodada \d/)).map((item) => item.textContent);
  expect(rounds).toEqual(["Rodada 2", "Rodada 1"]);
  expect(screen.getByText(/pela conta 4/)).toBeDefined();
  expect(screen.getByText(/devolvida em/)).toBeDefined();
  const links = screen.getAllByRole("link", { name: "Relatório — versão 2" });
  expect(links[0].getAttribute("href")).toBe("/api/projects/2/materials/5/versions/9/file");
  expect(screen.queryByRole("button", { name: "Submeter para avaliação" })).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Devolver para ajustes" }));
  const confirm = screen.getByRole("group", { name: "Confirmar devolução" });
  expect(confirm.textContent).toContain("A rodada 2 será marcada como devolvida");
  await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
  await userEvent.click(screen.getByRole("button", { name: "Devolver para ajustes" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar devolução" }));
  expect(await screen.findByText(/Rodada 2 devolvida para ajustes/)).toBeDefined();
  expect(onStatusChanged).toHaveBeenCalledWith("AJUSTES");
});

it("mostra erro da devolução, permite atualizar e não oferece devolução fora de avaliação", async () => {
  state.rounds = [round()];
  post = () => json("Somente a rodada atual, ainda em avaliação, pode ser devolvida para ajustes.", 409);
  const view = panel({ project: { id: 2, status: "EM_AVALIACAO" }, user: professor });
  await userEvent.click(await screen.findByRole("button", { name: "Devolver para ajustes" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar devolução" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Somente a rodada atual");
  await userEvent.click(screen.getByRole("button", { name: "Atualizar entrega" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());

  view.rerender(<SubmissionPanel project={{ id: 2, status: "AJUSTES" }} user={professor} materials={materials}
    expired={vi.fn()} onStatusChanged={vi.fn()} />);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Devolver para ajustes" })).toBeNull());
  expect(screen.getByText(/por você|pela conta 1/)).toBeDefined();
});

it("sessão expirada chama expired e falha de carga oferece nova tentativa", async () => {
  fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 401 }));
  const first = panel();
  await waitFor(() => expect(first.expired).toHaveBeenCalled());
  first.unmount();

  fetchMock.mockImplementationOnce(async () => json("Serviço indisponível.", 503));
  panel();
  expect((await screen.findByRole("alert")).textContent).toContain("Serviço indisponível.");
  await userEvent.click(screen.getByRole("button", { name: "Atualizar entrega" }));
  expect(await screen.findByRole("list", { name: "Checklist da entrega" })).toBeDefined();
});

it("sessão expirada durante a submissão chama expired", async () => {
  state.checklist = checklist({ blockedBy: null, canSubmit: true });
  post = () => new Response("{}", { status: 401 });
  const { expired } = panel();
  await userEvent.click(await screen.findByRole("button", { name: "Submeter para avaliação" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar submissão" }));
  await waitFor(() => expect(expired).toHaveBeenCalled());
});
