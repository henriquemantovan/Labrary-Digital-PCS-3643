import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupManager, EvaluatorManager } from "./Groups";
import type { Administration, Evaluators } from "./api";
let administration: Administration;
let links: Evaluators;
let failure: string;
let failureStatus: number;
let writes: unknown[];
const expired = vi.fn(),
  changed = vi.fn();
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status >= 400 ? { error: { message: data } } : { data }),
    { status },
  );
beforeEach(() => {
  administration = {
    groups: [
      { id: 2, classId: 1, name: "Grupo 02", memberIds: [1], history: [] },
    ],
    people: [
      { id: 1, fullName: "Marina", role: "ALUNO" },
      { id: 2, fullName: "Rafael", role: "AVALIADOR" },
      { id: 200, fullName: "Administrador", role: "ADMIN" },
    ],
  };
  links = { evaluatorIds: [2], history: [] };
  failure = "";
  failureStatus = 500;
  writes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (failure && url.endsWith(failure))
        return response("Falha ao salvar ou consultar", failureStatus);
      const body = options?.body ? JSON.parse(String(options.body)) : {};
      if (options?.method) writes.push(body);
      if (url.endsWith("/administration")) return response(administration);
      if (url.endsWith("/groups")) {
        const group = {
          id: 3,
          classId: 1,
          name: body.name,
          memberIds: [],
          history: [],
        };
        administration.groups.push(group);
        return response(group, 201);
      }
      if (url.endsWith("/members")) {
        const group = administration.groups[0];
        group.history.push({
          before: [...group.memberIds],
          after: body.memberIds,
          changedBy: 3,
          changedAt: "2026-11-07T12:00:00Z",
        });
        group.memberIds = body.memberIds;
        return response(group);
      }
      if (url.endsWith("/evaluators")) {
        if (options?.method === "PUT")
          links = {
            evaluatorIds: body.evaluatorIds,
            history: [
              {
                before: [2],
                after: body.evaluatorIds,
                changedBy: 3,
                changedAt: "2026-11-07T12:00:00Z",
              },
            ],
          };
        return response(links);
      }
      throw new Error(`Rota inesperada: ${url}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("gestão de grupos", () => {
  it("cadastra grupo e registra a alteração dos integrantes com sucesso e histórico", async () => {
    render(<GroupManager classId={1} onChanged={changed} expired={expired} />);
    await userEvent.type(
      await screen.findByLabelText("Nome do novo grupo"),
      "Grupo novo",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar grupo" }),
    );
    await screen.findByRole("heading", { name: "Grupo novo" });
    expect(changed).toHaveBeenCalledOnce();
    const group = screen.getByRole("group", {
      name: "Integrantes de Grupo 02",
    });
    expect(within(group).queryByLabelText("Rafael")).toBeNull();
    await userEvent.click(within(group).getByLabelText("Marina"));
    await userEvent.click(
      within(group).getByRole("button", {
        name: "Salvar integrantes de Grupo 02",
      }),
    );
    await screen.findByText("Integrantes atualizados.");
    await userEvent.click(screen.getByText("Histórico de vínculos (1)"));
    expect(screen.getByText(/Conta 3:/).textContent).toContain("[1] → []");
    expect(writes).toContainEqual({ memberIds: [] });
  });
  it("trata falha de leitura, recuperação e falha de gravação sem anunciar sucesso", async () => {
    failure = "administration";
    render(<GroupManager classId={1} onChanged={changed} expired={expired} />);
    await screen.findByRole("alert");
    failure = "";
    await userEvent.click(
      screen.getByRole("button", { name: "Recarregar grupos" }),
    );
    await userEvent.type(
      await screen.findByLabelText("Nome do novo grupo"),
      "Novo",
    );
    failure = "groups";
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar grupo" }),
    );
    await screen.findByRole("alert");
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByText("Grupo cadastrado.")).toBeNull();
  });
  it("mostra lista vazia e ausência de contas e expira a sessão em gravação", async () => {
    administration.groups = [];
    administration.people = [];
    const view = render(
      <GroupManager classId={1} onChanged={changed} expired={expired} />,
    );
    await screen.findByText("Nenhum grupo cadastrado.");
    await userEvent.type(screen.getByLabelText("Nome do novo grupo"), "Novo");
    await userEvent.click(
      screen.getByRole("button", { name: "Cadastrar grupo" }),
    );
    await screen.findByText("Nenhuma conta ativa disponível.");
    failure = "members";
    failureStatus = 401;
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar integrantes de Novo" }),
    );
    expect(expired).toHaveBeenCalledOnce();
    view.unmount();
  });
  it("informa sessão expirada na leitura", async () => {
    failure = "administration";
    failureStatus = 401;
    render(<GroupManager classId={1} onChanged={changed} expired={expired} />);
    await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce());
  });
});
describe("gestão de avaliadores", () => {
  it("seleciona contas apropriadas, salva e apresenta histórico", async () => {
    render(<EvaluatorManager classId={1} projectId={2} expired={expired} />);
    await screen.findByLabelText("Rafael");
    expect(screen.queryByLabelText("Marina")).toBeNull();
    await userEvent.click(screen.getByLabelText("Rafael"));
    await userEvent.click(screen.getByLabelText("Administrador"));
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar avaliadores" }),
    );
    await screen.findByText("Avaliadores atualizados.");
    expect(writes).toContainEqual({ evaluatorIds: [200] });
    await userEvent.click(screen.getByText("Histórico de vínculos (1)"));
    expect(screen.getByText(/Conta 3:/).textContent).toContain("[2] → [200]");
  });
  it("recupera falha de leitura e preserva seleção após falha de gravação", async () => {
    failure = "evaluators";
    render(<EvaluatorManager classId={1} projectId={2} expired={expired} />);
    await screen.findByRole("alert");
    failure = "";
    await userEvent.click(
      screen.getByRole("button", { name: "Recarregar avaliadores" }),
    );
    await screen.findByLabelText("Rafael");
    failure = "evaluators";
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar avaliadores" }),
    );
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Rafael") as HTMLInputElement).checked).toBe(
      true,
    );
    failureStatus = 401;
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar avaliadores" }),
    );
    expect(expired).toHaveBeenCalledOnce();
  });
  it("mostra ausência de contas disponíveis", async () => {
    administration.people = [];
    render(<EvaluatorManager classId={1} projectId={2} expired={expired} />);
    await screen.findByText("Nenhuma conta ativa disponível.");
  });
});
