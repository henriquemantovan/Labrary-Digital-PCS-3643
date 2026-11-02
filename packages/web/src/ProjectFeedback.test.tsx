import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectFeedback } from "./ProjectFeedback";
import type { ProjectMessage } from "./api";

const expired = vi.fn();
const material = {
  id: 7,
  title: "Relatório",
  kind: "RELATORIO",
  versionNumber: 2,
  originalFilename: "relatorio.pdf",
};
const original: ProjectMessage = {
  id: 1,
  projectId: 2,
  clientMessageId: "e8ad019f-3f20-4fee-ad44-c9ebcd09c613",
  body: "Primeira mensagem",
  author: { id: 1, fullName: "Marina", role: "ALUNO" },
  createdAt: "2026-11-02T12:00:00.000Z",
  materialVersion: null,
};
let saved: ProjectMessage[];
let failLoad: number;
let failSend: boolean;
let pendingSend: ((response: Response) => void) | undefined;
let holdSend: boolean;
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status >= 400 ? { error: { message: "Falha na conversa." } } : { data },
    ),
    { status },
  );
beforeEach(() => {
  saved = [];
  failLoad = 0;
  failSend = false;
  holdSend = false;
  pendingSend = undefined;
  expired.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        const payload = JSON.parse(String(options.body));
        let message = saved.find(
          (item) => item.clientMessageId === payload.clientMessageId,
        );
        if (!message) {
          message = {
            ...original,
            ...payload,
            id: saved.length + 1,
            materialVersion: payload.materialVersionId
              ? { id: 7, title: "Relatório", versionNumber: 2 }
              : null,
          };
          saved.push(message!);
        }
        if (failSend) throw new Error("Resposta perdida");
        if (holdSend)
          return new Promise<Response>((resolve) => {
            pendingSend = resolve;
          });
        return json(message);
      }
      return failLoad ? json(null, failLoad) : json(saved);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
const show = () =>
  render(
    <ProjectFeedback projectId={2} materials={[material]} expired={expired} />,
  );
it("envia como texto seguro, mostra contexto e mantém a conversa ao reabrir", async () => {
  const view = show();
  await screen.findByText("Nenhuma mensagem ainda. Comece a conversa.");
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Contexto da mensagem"), "7");
  const text = '<script>alert("xss")</script>';
  await user.type(screen.getByLabelText("Mensagem", { exact: true }), text);
  await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByText(text);
  expect(document.querySelector(".feedback script")).toBeNull();
  expect(screen.getByText("Relatório · v2", { selector: "p" })).toBeTruthy();
  expect(screen.getByText("Marina")).toBeTruthy();
  expect(screen.getByText("Mensagem enviada.")).toBeTruthy();
  expect(screen.getByLabelText("Mensagem", { exact: true })).toHaveProperty(
    "value",
    "",
  );
  view.unmount();
  show();
  await screen.findByText(text);
  saved.push({ ...original, id: 2, body: "Nova resposta" });
  await user.click(screen.getByRole("button", { name: "Atualizar conversa" }));
  await screen.findByText("Nova resposta");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
it("mantém rascunho e identificador após resposta perdida, sem duplicar no retry", async () => {
  failSend = true;
  show();
  await screen.findByText(/Nenhuma mensagem ainda/);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("Mensagem", { exact: true }),
    "Revisar circuito",
  );
  await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Mensagem", { exact: true })).toHaveProperty(
    "value",
    "Revisar circuito",
  );
  failSend = false;
  await user.click(screen.getByRole("button", { name: "Atualizar conversa" }));
  await screen.findByText("Revisar circuito", { selector: "p" });
  await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByText("Mensagem enviada.");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  const posts = vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts[0][1]?.body).toBe(posts[1][1]?.body);
});
it("bloqueia envio durante solicitação e permite retomar consulta que falha", async () => {
  failLoad = 503;
  show();
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Enviar mensagem" }),
  ).toHaveProperty("disabled", true);
  failLoad = 0;
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Atualizar conversa" }));
  await screen.findByText(/Nenhuma mensagem ainda/);
  await user.type(
    screen.getByLabelText("Mensagem", { exact: true }),
    "Enviando",
  );
  holdSend = true;
  await user.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByRole("button", { name: "Enviando…" });
  expect(screen.getByRole("button", { name: "Enviando…" })).toHaveProperty(
    "disabled",
    true,
  );
  await waitFor(() => expect(pendingSend).toBeDefined());
  pendingSend!(json(saved[0]));
  await screen.findByText("Mensagem enviada.");
});
it.each([401, 404])("trata perda de acesso %s", async (status) => {
  failLoad = status;
  show();
  await screen.findByRole("alert");
  if (status === 401) expect(expired).toHaveBeenCalled();
  else expect(screen.queryByLabelText("Mensagem", { exact: true })).toBeNull();
});
