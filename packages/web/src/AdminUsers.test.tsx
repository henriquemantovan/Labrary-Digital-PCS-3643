import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUsers } from "./AdminUsers";
import type { ManagedUser } from "./api";
let users: ManagedUser[];
let failList = false,
  failSave = 0;
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status >= 400 ? { error: { message: data } } : { data }),
    { status },
  );
beforeEach(() => {
  users = [
    {
      id: 1,
      fullName: "Henrique",
      email: "henrique@example.com",
      role: "ADMIN",
      active: true,
    },
    {
      id: 2,
      fullName: "Maria",
      email: "maria@example.com",
      role: "ALUNO",
      active: true,
    },
  ];
  failList = false;
  failSave = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/admin/users")
        return failList
          ? response("Serviço indisponível", 503)
          : response(users);
      if (url === "/api/auth/me")
        return response({ ...users[0], googleLinked: true });
      if (init?.method === "PATCH") {
        if (failSave)
          return response(
            failSave === 401
              ? "Sessão expirada"
              : "Não é possível remover o último administrador ativo.",
            failSave,
          );
        const id = Number(url.split("/")[4]);
        const target = users.find((user) => user.id === id)!;
        target.role = JSON.parse(String(init.body)).role;
        return response(target);
      }
      return response("Não encontrado", 404);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("lista contas, filtra e promove usuário apenas ao salvar", async () => {
  const onSessionChanged = vi.fn();
  render(<AdminUsers expired={vi.fn()} onSessionChanged={onSessionChanged} />);
  await screen.findByText("Maria");
  await userEvent.type(
    screen.getByLabelText("Buscar usuários"),
    "maria@example.com",
  );
  expect(screen.queryByText("Henrique")).toBeNull();
  const card = screen.getByRole("article", { name: "Maria" });
  await userEvent.selectOptions(
    within(card).getByLabelText("Perfil de Maria"),
    "ADMIN",
  );
  expect(users[1].role).toBe("ALUNO");
  await userEvent.click(
    within(card).getByRole("button", { name: "Salvar perfil de Maria" }),
  );
  expect(
    await screen.findByText("Perfil de Maria atualizado para Administrador."),
  ).toBeTruthy();
  expect(users[1].role).toBe("ADMIN");
  expect(onSessionChanged).toHaveBeenCalledWith(
    expect.objectContaining({ role: "ADMIN" }),
  );
  await userEvent.type(screen.getByLabelText("Buscar usuários"), "inexistente");
  expect(screen.getByText("Nenhum usuário encontrado.")).toBeTruthy();
});
it("informa falha de listagem e permite tentar novamente", async () => {
  failList = true;
  render(<AdminUsers expired={vi.fn()} onSessionChanged={vi.fn()} />);
  await screen.findByText("Serviço indisponível");
  failList = false;
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar novamente" }),
  );
  expect(await screen.findByText("Maria")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Atualizar usuários" }),
  );
  expect(await screen.findByText("Henrique")).toBeTruthy();
});
it("mantém o papel ao receber bloqueio de último administrador e permite corrigir", async () => {
  failSave = 409;
  render(<AdminUsers expired={vi.fn()} onSessionChanged={vi.fn()} />);
  await screen.findByText("Henrique");
  await userEvent.selectOptions(
    screen.getByLabelText("Perfil de Henrique"),
    "ALUNO",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar perfil de Henrique" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(users[0].role).toBe("ADMIN");
});
it("retorna à autenticação se a sessão expirar ao salvar", async () => {
  failSave = 401;
  const expired = vi.fn();
  render(<AdminUsers expired={expired} onSessionChanged={vi.fn()} />);
  await screen.findByText("Maria");
  await userEvent.selectOptions(
    screen.getByLabelText("Perfil de Maria"),
    "ADMIN",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar perfil de Maria" }),
  );
  await screen.findByText("Sessão expirada");
  expect(expired).toHaveBeenCalled();
});
it("trata sessão expirada durante a listagem", async () => {
  const expired = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response("Sessão expirada", 401)),
  );
  render(<AdminUsers expired={expired} onSessionChanged={vi.fn()} />);
  await screen.findByText("Sessão expirada");
  expect(expired).toHaveBeenCalled();
});
