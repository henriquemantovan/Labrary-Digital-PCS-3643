import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gradebook } from "./Gradebook";
import type { GradeRow } from "./gradeClient";
import examples from "../../../docs/contratos/c3-exemplos.json";
let rows: GradeRow[];
let classes: { id: number; name: string; academicYear: number }[];
let failure = "", failureStatus = 500;
const expired = vi.fn();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status >= 400 ? { error: { message: data } } : { data }), { status });
beforeEach(() => {
  expired.mockReset(); failure = ""; failureStatus = 500;
  classes = [{ id: 1, name: "Laboratório", academicYear: 2026 }, { id: 2, name: "Outra turma", academicYear: 2026 }];
  const base: GradeRow = { projectId: 1, groupId: 1, groupName: "Grupo 01", title: "Circuito", submissionId: 10, round: 1, rubricVersionId: 4,
    expectedEvaluatorIds: [2, 5], receivedEvaluatorIds: [2], pendingEvaluatorIds: [5], evaluatorGrades: [{ evaluatorId: 2, grade: 8.0561 }],
    grade: 8.0561, finalGrade: null, status: "PARTIAL", allEvaluationsCompleted: false, resultReleased: false };
  rows = [base, { ...base, projectId: 2, groupId: 2, groupName: "Grupo 02", grade: 0, finalGrade: 0, status: "FINAL", allEvaluationsCompleted: true, pendingEvaluatorIds: [], receivedEvaluatorIds: [2, 5] },
    { ...base, projectId: 3, groupId: 3, groupName: "Grupo 03", grade: null, status: "NO_SUBMISSION", round: null }];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (failure && url.endsWith(failure)) return response("Falha de integração", failureStatus);
    if (url === "/api/scope") return response({ classes, groups: [] });
    if (url.includes("format=csv")) return new Response("CSV", { headers: { "Content-Type": "text/csv" } });
    if (url.endsWith("/grades")) return response(url.includes("/2/") ? [] : rows);
    if (url.endsWith("/consolidation")) return response({ result: rows[1], fingerprint: "a".repeat(64) });
    if (options?.method === "POST") return response({ ...rows[1], resultReleased: true });
    throw new Error(`Rota inesperada ${url}`);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("consome os mesmos exemplos C3 do produtor e preserva bloqueio separado de completude", async () => {
  rows = [examples.partial, { ...examples.finalBlocked, projectId: 2, groupName: "Grupo 02" },
    { ...examples.finalReleased, projectId: 3, groupName: "Grupo 03" }] as GradeRow[];
  render(<Gradebook expired={expired} />);
  await screen.findByRole("table");
  expect((screen.getByRole("button", { name: "Liberar resultado de Grupo 01" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Liberar resultado de Grupo 02" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText("Liberado")).toBeTruthy();
});
it("mostra parcial/final, zero, ausência e exporta CSV; muda de turma", async () => {
  render(<Gradebook expired={expired} />);
  const table = await screen.findByRole("table");
  expect(within(table).getByText("8.06")).toBeTruthy();
  expect(within(table).getByText("0.00")).toBeTruthy();
  expect(within(table).getByText("Parcial")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Liberar resultado de Grupo 01" }) as HTMLButtonElement).disabled).toBe(true);
  const create = vi.fn(() => "blob:csv"), revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
  expect(click).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith("blob:csv");
  await userEvent.selectOptions(screen.getByLabelText("Turma da consolidação"), "2");
  expect(await screen.findByText("Nenhum projeto nesta turma.")).toBeTruthy();
});
it("exige confirmação explícita e permite cancelar antes de liberar", async () => {
  render(<Gradebook expired={expired} />);
  const open = await screen.findByRole("button", { name: "Liberar resultado de Grupo 02" });
  await userEvent.click(open);
  await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("region", { name: "Confirmar liberação" })).toBeNull();
  await userEvent.click(open);
  await userEvent.click(await screen.findByRole("button", { name: "Confirmar liberação" }));
  expect(await screen.findByText("Resultado liberado para o grupo.")).toBeTruthy();
  expect(screen.getByText("Liberado")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.find(call => call[1]?.method === "POST")?.[1]?.body).toBe(JSON.stringify({ submissionId: 10, fingerprint: "a".repeat(64) }));
});
it("mostra erro e recupera consulta/preview/liberação/exportação sem sucesso falso", async () => {
  failure = "/grades";
  render(<Gradebook expired={expired} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Falha de integração");
  failure = "";
  await userEvent.click(screen.getByRole("button", { name: "Atualizar consolidação" }));
  const button = await screen.findByRole("button", { name: "Liberar resultado de Grupo 02" });
  failure = "/consolidation";
  await userEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toContain("Falha de integração");
  failure = ""; await userEvent.click(button);
  const confirm = await screen.findByRole("button", { name: "Confirmar liberação" });
  failure = "/release"; await userEvent.click(confirm);
  expect((await screen.findByRole("alert")).textContent).toContain("Falha de integração");
  expect(screen.queryByText("Resultado liberado para o grupo.")).toBeNull();
  failure = "format=csv";
  await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Falha de integração");
});
it("recarrega escopo após falha e distingue conta sem turma", async () => {
  failure = "/scope";
  render(<Gradebook expired={expired} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  failure = ""; classes = [];
  await userEvent.click(screen.getByRole("button", { name: "Atualizar consolidação" }));
  expect(await screen.findByText("Nenhuma turma disponível.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Exportar CSV" }) as HTMLButtonElement).disabled).toBe(true);
});
it.each(["/scope", "/grades", "/consolidation", "/release", "format=csv"])("encaminha sessão expirada em %s", async path => {
  if (["/scope", "/grades"].includes(path)) { failure = path; failureStatus = 401; }
  render(<Gradebook expired={expired} />);
  if (!["/scope", "/grades"].includes(path)) {
    const open = await screen.findByRole("button", { name: "Liberar resultado de Grupo 02" });
    if (path === "/release") {
      await userEvent.click(open);
      const confirm = await screen.findByRole("button", { name: "Confirmar liberação" });
      failure = path; failureStatus = 401; await userEvent.click(confirm);
    } else {
      failure = path; failureStatus = 401;
      await userEvent.click(path === "/consolidation" ? open : screen.getByRole("button", { name: "Exportar CSV" }));
    }
  }
  await vi.waitFor(() => expect(expired).toHaveBeenCalled());
});
