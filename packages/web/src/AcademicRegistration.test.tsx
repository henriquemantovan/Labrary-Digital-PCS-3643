import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AcademicRegistration } from "./AcademicRegistration";
import { App } from "./App";

const student = {
  id: 1,
  fullName: "Marina Google",
  email: "marina@usp.br",
  role: "ALUNO" as const,
  googleLinked: true,
  requiresAcademicProfile: true,
};
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status >= 400 ? { error: { message: data } } : { data }),
    { status },
  );
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
const setup = () => {
  const props = {
    user: student,
    onSaved: vi.fn(),
    expired: vi.fn(),
    logout: vi.fn(async () => {}),
    logoutBusy: false,
    logoutError: "",
  };
  render(<AcademicRegistration {...props} />);
  return props;
};
async function fill() {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Nome completo"));
  await user.type(
    screen.getByLabelText("Nome completo"),
    "Marina Nome Completo",
  );
  await user.type(screen.getByLabelText("NUSP"), "12345678");
  await user.type(screen.getByLabelText("Ano de ingresso"), "2024");
  return user;
}

it("envia os dados acadêmicos, identifica a conta e permite continuar somente após salvar", async () => {
  const saved = {
    ...student,
    fullName: "Marina Nome Completo",
    uspNumber: "12345678",
    entryYear: 2024,
    requiresAcademicProfile: false,
  };
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
    response(saved),
  );
  vi.stubGlobal("fetch", fetch);
  const props = setup();
  expect(screen.getByText(/marina@usp.br/)).not.toBeNull();
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(saved));
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    fullName: "Marina Nome Completo",
    uspNumber: "12345678",
    entryYear: 2024,
  });
});

it("mostra conflito e permite corrigir e repetir sem perder os dados", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(response("NUSP já vinculado.", 409))
      .mockResolvedValueOnce(
        response({ ...student, requiresAcademicProfile: false }),
      ),
  );
  const props = setup();
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "NUSP já vinculado.",
  );
  expect((screen.getByLabelText("NUSP") as HTMLInputElement).value).toBe(
    "12345678",
  );
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
});

it("trata sessão expirada e disponibiliza saída da conta", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response("Sessão expirada", 401)),
  );
  const props = setup();
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }));
  await waitFor(() => expect(props.expired).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "Sair da conta" }));
  expect(props.logout).toHaveBeenCalled();
});

it("bloqueia a navegação direta pelo App até concluir os dados", async () => {
  window.history.replaceState(null, "", "/projetos/2");
  const fetch = vi.fn(async (url: string) =>
    url === "/api/auth/me"
      ? response(student)
      : response("Rota inesperada", 500),
  );
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Complete seu cadastro" }),
  ).not.toBeNull();
  expect(fetch.mock.calls.every(([url]) => url === "/api/auth/me")).toBe(true);
  expect(screen.queryByRole("button", { name: "Meu projeto" })).toBeNull();
});
