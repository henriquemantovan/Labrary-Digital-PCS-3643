import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GuestInvitations } from "./GuestInvitations";

const item = {
  id: 1,
  email: "externo@gmail.com",
  invitedBy: 3,
  createdAt: "2026-11-22T12:00:00Z",
  revokedAt: null,
  revokedBy: null,
};
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(status >= 400 ? { error: { message: data } } : { data }),
    { status },
  );
afterEach(() => vi.unstubAllGlobals());

it("autoriza o e-mail, exige confirmação para revogar e mostra o histórico", async () => {
  let invited = false,
    revoked = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        invited = true;
        return response(item, 201);
      }
      if (init?.method === "DELETE") {
        revoked = true;
        return new Response(null, { status: 204 });
      }
      return response(
        invited
          ? [{ ...item, revokedAt: revoked ? "2026-11-22T13:00:00Z" : null }]
          : [],
      );
    }),
  );
  render(<GuestInvitations expired={vi.fn()} />);
  expect(
    await screen.findByText("Nenhum convidado cadastrado."),
  ).not.toBeNull();
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("E-mail Google do convidado"),
    item.email,
  );
  await user.click(screen.getByRole("button", { name: "Autorizar convidado" }));
  expect(
    await screen.findByText(
      `Acesso de convidado autorizado para ${item.email}.`,
    ),
  ).not.toBeNull();
  await user.click(
    screen.getByRole("button", { name: `Revogar acesso de ${item.email}` }),
  );
  await user.click(screen.getByRole("button", { name: "Cancelar revogação" }));
  expect(revoked).toBe(false);
  await user.click(
    screen.getByRole("button", { name: `Revogar acesso de ${item.email}` }),
  );
  const confirmation = screen.getByRole("group", {
    name: "Confirmar revogação de convidado",
  });
  await user.click(
    within(confirmation).getByRole("button", { name: "Confirmar revogação" }),
  );
  expect(
    await screen.findByText("Acesso de convidado revogado."),
  ).not.toBeNull();
  expect(screen.getByText(`${item.email} · Revogado`)).not.toBeNull();
});

it("recupera erro da listagem e trata falhas de autorização/revogação", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response("Indisponível", 503))
    .mockResolvedValueOnce(response([item]))
    .mockResolvedValueOnce(response("Convite recusado", 409))
    .mockResolvedValueOnce(response("Revogação recusada", 409));
  vi.stubGlobal("fetch", fetch);
  render(<GuestInvitations expired={vi.fn()} />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Indisponível",
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Recarregar convidados" }),
  );
  expect(await screen.findByText(`${item.email} · Autorizado`)).not.toBeNull();
  await user.type(
    screen.getByLabelText("E-mail Google do convidado"),
    item.email,
  );
  await user.click(screen.getByRole("button", { name: "Autorizar convidado" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Convite recusado",
  );
  await user.click(
    screen.getByRole("button", { name: `Revogar acesso de ${item.email}` }),
  );
  await user.click(screen.getByRole("button", { name: "Confirmar revogação" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Revogação recusada",
  );
});

it("encaminha sessão expirada", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response("Sessão expirada", 401)),
  );
  const expired = vi.fn();
  render(<GuestInvitations expired={expired} />);
  await waitFor(() => expect(expired).toHaveBeenCalled());
});
