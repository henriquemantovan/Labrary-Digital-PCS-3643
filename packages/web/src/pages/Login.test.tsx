import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Login } from "./Login";

const response = (data: unknown, status = 200) => new Response(JSON.stringify(status === 200 ? { data } : { error: { message: data } }), { status });
afterEach(() => vi.unstubAllGlobals());

it("preserva o login Google sem formulário de senha quando a exceção está desligada", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ google: true, local: false })));
  render(<Login onLogin={vi.fn()} message="" />);
  expect((await screen.findByRole("link", { name: "Entrar com Google" })).getAttribute("href")).toBe("/api/auth/google");
  expect(screen.queryByLabelText("Senha")).toBeNull();
  expect(screen.queryByText(/Contas de teste do desenvolvimento/)).toBeNull();
});

it("identifica o formulário exclusivo de teste e mantém o Google para contas pessoais", async () => {
  const person = { id: 4, email: "aluno@labrary.test", fullName: "Marina Oliveira (teste)", role: "ALUNO" };
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => response(url.endsWith("providers") ? { google: true, local: true, testLogin: true } : person));
  vi.stubGlobal("fetch", fetch);
  const onLogin = vi.fn();
  render(<Login onLogin={onLogin} message="" />);
  const email = await screen.findByLabelText("E-mail da conta de teste");
  expect(screen.getByText(/Sua conta pessoal continua usando o Google/)).not.toBeNull();
  expect(screen.getByRole("link", { name: "Entrar com Google" })).not.toBeNull();
  const user = userEvent.setup();
  await user.type(email, "aluno@labrary.test");
  await user.type(screen.getByLabelText("Senha", { exact: true }), "senha de teste");
  await user.click(screen.getByRole("button", { name: "Entrar no meu espaço" }));
  await waitFor(() => expect(onLogin).toHaveBeenCalledWith(person));
  const call = fetch.mock.calls.find(([url]) => url === "/api/auth/login");
  expect(JSON.parse(call![1]!.body as string)).toEqual({ email: "aluno@labrary.test", password: "senha de teste" });
});

it("exibe a recusa da credencial e permite tentar outra vez no formulário de teste", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("providers")
    ? response({ google: true, local: true, testLogin: true })
    : response("E-mail ou senha inválidos.", 401)));
  const onLogin = vi.fn();
  render(<Login onLogin={onLogin} message="" />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail da conta de teste"), "pessoa@usp.br");
  await user.type(screen.getByLabelText("Senha", { exact: true }), "incorreta");
  await user.click(screen.getByRole("button", { name: "Entrar no meu espaço" }));
  expect((await screen.findByRole("alert")).textContent).toContain("E-mail ou senha inválidos.");
  expect((screen.getByRole("button", { name: "Entrar no meu espaço" }) as HTMLButtonElement).disabled).toBe(false);
  expect(onLogin).not.toHaveBeenCalled();
});
