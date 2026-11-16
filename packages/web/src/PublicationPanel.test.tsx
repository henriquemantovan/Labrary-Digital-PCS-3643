import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicationPanel } from "./PublicationPanel";
import type { PublicationManagement } from "../../api/src/models/publicationDecision";
let state: PublicationManagement, failRead: number, failWrite: number;
let writes: { method: string; body: any }[];
const expired = vi.fn(),
  changed = vi.fn();
const response = (value: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status >= 400 ? { error: { message: value } } : { data: value },
    ),
    { status },
  );
beforeEach(() => {
  state = {
    status: "EM_AVALIACAO",
    submissionId: 11,
    canFinalize: true,
    canPublish: false,
    reason: null,
    materials: [
      { id: 1, versionId: 4, versionNumber: 2, title: "Vídeo", kind: "VIDEO" },
      {
        id: 2,
        versionId: 5,
        versionNumber: 1,
        title: "Relatório",
        kind: "RELATORIO",
      },
    ],
    history: [],
  };
  failRead = 0;
  failWrite = 0;
  writes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit = {}) => {
      if (!options.method)
        return failRead
          ? response("Falha ao carregar", failRead)
          : response(state);
      if (failWrite) return response("Falha ao gravar", failWrite);
      const body = options.body ? JSON.parse(String(options.body)) : null;
      writes.push({ method: options.method!, body });
      state = {
        ...state,
        status:
          options.method === "DELETE"
            ? "RETIRADO"
            : url.endsWith("finalization")
              ? "FINALIZADO"
              : "PUBLICADO",
        canFinalize: false,
        canPublish: options.method === "DELETE" || url.endsWith("finalization"),
      };
      state.history = [
        ...state.history,
        {
          id: state.history.length + 1,
          action: state.status as "FINALIZADO",
          actorId: 3,
          createdAt: "2026-11-12T12:00:00Z",
          ...(body?.groupAuthorization
            ? { authorizationReference: body.groupAuthorization.reference }
            : {}),
        },
      ];
      return options.method === "DELETE"
        ? new Response(null, { status: 204 })
        : response(state);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const show = () =>
  render(
    <PublicationPanel projectId={1} expired={expired} onChanged={changed} />,
  );
it("finaliza, registra autorização e versões e permite retirar preservando histórico", async () => {
  show();
  const finalize = await screen.findByRole("button", {
    name: "Finalizar projeto",
  });
  expect((finalize as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(
    screen.getByLabelText("Confirmo a finalização desta rodada."),
  );
  await userEvent.click(finalize);
  await screen.findByText("Projeto finalizado. O conteúdo continua privado.");
  await userEvent.click(
    screen.getByLabelText(
      "O grupo autorizou a divulgação dos materiais selecionados.",
    ),
  );
  await userEvent.type(
    screen.getByLabelText("Registro da autorização do grupo"),
    "Ata autorizada pelo grupo",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Publicar no acervo" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Selecione ao menos um",
  );
  await userEvent.click(screen.getByLabelText("Vídeo · v2"));
  await userEvent.click(
    screen.getByRole("button", { name: "Publicar no acervo" }),
  );
  await screen.findByText("Projeto publicado com os materiais autorizados.");
  expect(writes[1].body).toEqual({
    submissionId: 11,
    materialVersionIds: [4],
    groupAuthorization: {
      confirmed: true,
      reference: "Ata autorizada pelo grupo",
    },
  });
  expect(
    screen
      .getByRole("link", { name: "Abrir projeto no acervo" })
      .getAttribute("href"),
  ).toBe("/acervo/1");
  expect(
    (
      screen.getByRole("button", {
        name: "Retirar publicação",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await userEvent.click(
    screen.getByLabelText("Confirmo a retirada do acervo."),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retirar publicação" }),
  );
  await screen.findByText(
    "Publicação retirada. O conteúdo privado foi preservado.",
  );
  await userEvent.click(screen.getByText("Histórico de publicação (3)"));
  expect(
    screen.getByText("Autorização: Ata autorizada pelo grupo"),
  ).toBeTruthy();
  expect(changed).toHaveBeenCalledTimes(3);
});
it("mantém finalização desabilitada enquanto a integração estiver pendente", async () => {
  state.canFinalize = false;
  state.submissionId = null;
  state.reason = "Aguardando integração das entregas e avaliações.";
  show();
  await screen.findByText(state.reason);
  expect(
    (
      screen.getByRole("button", {
        name: "Finalizar projeto",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await userEvent.click(
    screen.getByLabelText("Confirmo a finalização desta rodada."),
  );
  expect(
    (
      screen.getByLabelText(
        "Confirmo a finalização desta rodada.",
      ) as HTMLInputElement
    ).checked,
  ).toBe(false);
  expect(writes).toEqual([]);
});
it("recupera falha de leitura e informa sessão expirada na gravação", async () => {
  failRead = 500;
  show();
  await screen.findByRole("alert");
  failRead = 0;
  await userEvent.click(
    screen.getByRole("button", { name: "Recarregar publicação" }),
  );
  await screen.findByRole("button", { name: "Finalizar projeto" });
  await userEvent.click(
    screen.getByLabelText("Confirmo a finalização desta rodada."),
  );
  failWrite = 401;
  await userEvent.click(
    screen.getByRole("button", { name: "Finalizar projeto" }),
  );
  expect(expired).toHaveBeenCalledOnce();
  expect(changed).not.toHaveBeenCalled();
});
it("preserva as escolhas após falha de publicação e não anuncia sucesso", async () => {
  state.status = "FINALIZADO";
  state.canPublish = true;
  state.canFinalize = false;
  show();
  await userEvent.click(await screen.findByLabelText("Vídeo · v2"));
  await userEvent.click(
    screen.getByLabelText(
      "O grupo autorizou a divulgação dos materiais selecionados.",
    ),
  );
  await userEvent.type(
    screen.getByLabelText("Registro da autorização do grupo"),
    "Declaração do grupo",
  );
  failWrite = 500;
  await userEvent.click(
    screen.getByRole("button", { name: "Publicar no acervo" }),
  );
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Vídeo · v2") as HTMLInputElement).checked,
  ).toBe(true);
  expect(
    (
      screen.getByLabelText(
        "Registro da autorização do grupo",
      ) as HTMLTextAreaElement
    ).value,
  ).toBe("Declaração do grupo");
  expect(changed).not.toHaveBeenCalled();
});
it("informa sessão expirada ao carregar sem renderizar controles disponíveis", async () => {
  failRead = 401;
  show();
  await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce());
  expect(
    screen.queryByRole("button", { name: "Finalizar projeto" }),
  ).toBeNull();
});
