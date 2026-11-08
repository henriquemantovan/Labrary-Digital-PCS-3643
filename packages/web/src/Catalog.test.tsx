import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Catalog } from "./Catalog";
import { App } from "./App";
import { catalogExamples, demoCatalog } from "./fixtures/catalog";
import type { PublicProject, PublicPublicationProvider } from "./catalogClient";

beforeEach(() => {
  window.history.replaceState(null, "", "/acervo");
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("combina quatro filtros, mostra vazio e limpa sem perder opções", async () => {
  const user = userEvent.setup();
  render(<Catalog provider={demoCatalog} />);
  await screen.findByRole("link", { name: catalogExamples[0].title });
  await user.type(screen.getByLabelText("Buscar por título"), "SEMÁFORO");
  await user.selectOptions(screen.getByLabelText("Ano"), "2026");
  await user.selectOptions(screen.getByLabelText("Turma"), "3");
  await user.selectOptions(
    screen.getByLabelText("Categoria"),
    "Sistemas digitais",
  );
  expect(screen.getByRole("status").textContent).toContain("1 projeto(s)");
  await user.selectOptions(screen.getByLabelText("Ano"), "2025");
  expect(screen.getByText("Nenhum resultado")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(screen.getByRole("status").textContent).toContain("3 projeto(s)");
  // Reset each individual control too, preserving independent combinations.
  for (const label of ["Ano", "Turma", "Categoria"]) {
    await user.selectOptions(screen.getByLabelText(label), "");
  }
});

it("reconsulta detalhe, mostra somente materiais C4 e conserva filtros ao voltar", async () => {
  const user = userEvent.setup();
  render(<Catalog provider={demoCatalog} />);
  await screen.findByRole("link", { name: catalogExamples[0].title });
  await user.type(screen.getByLabelText("Buscar por título"), "semáforo");
  await user.click(
    screen.getByRole("link", { name: catalogExamples[0].title }),
  );
  await screen.findByRole("heading", { name: "Materiais autorizados" });
  expect(
    screen.getByRole("link", { name: "Baixar Relatório" }).getAttribute("href"),
  ).toBe("/api/catalog/17/materials/62/file");
  const video = screen.getByLabelText("Demonstração");
  expect(video.getAttribute("src")).toBe("/api/catalog/17/materials/61/file");
  expect(screen.queryByText("Manual")).toBeNull();
  fireEvent.error(video);
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível reproduzir",
  );
  await user.click(screen.getByRole("button", { name: /Voltar ao acervo/ }));
  await screen.findByRole("link", { name: catalogExamples[0].title });
  expect(
    (screen.getByLabelText("Buscar por título") as HTMLInputElement).value,
  ).toBe("semáforo");
  await user.click(screen.getByRole("link", { name: "labrary digital" }));
  expect(window.location.pathname).toBe("/acervo");
});

it("trata carregamento, falha recuperável, vazio e publicação retirada", async () => {
  const user = userEvent.setup();
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([]);
  const provider = { list, get: vi.fn().mockResolvedValue(undefined) };
  render(<Catalog provider={provider} />);
  expect(screen.getByRole("status").textContent).toBe("Carregando acervo…");
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum projeto publicado");
  act(() => {
    window.history.pushState(null, "", "/acervo/17");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Publicação não encontrada" });
  expect(provider.get).toHaveBeenCalledWith(17);
  for (const path of ["/acervo/invalido", "/acervo/9007199254740992"]) {
    act(() => {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "Publicação não encontrada" });
  }
  expect(provider.get).toHaveBeenCalledTimes(1);
});

it("não deixa resposta antiga substituir navegação nova, nem mantém material após falha", async () => {
  let resolve!: (p: PublicProject) => void;
  window.history.replaceState(null, "", "/acervo/17");
  const provider: PublicPublicationProvider = {
    list: async () => [],
    get: vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValueOnce(catalogExamples[1])
      .mockRejectedValueOnce(new Error("offline")),
  };
  render(<Catalog provider={provider} />);
  act(() => {
    window.history.pushState(null, "", "/acervo/18");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Monitor de energia" });
  expect(
    screen.getByText("Nenhum material autorizado para consulta pública."),
  ).toBeTruthy();
  await act(async () => resolve(catalogExamples[0]));
  expect(
    screen.queryByRole("heading", { name: catalogExamples[0].title }),
  ).toBeNull();
  act(() => {
    window.history.pushState(null, "", "/acervo/19");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("alert");
  expect(screen.queryByText("Monitor de energia")).toBeNull();
});

it("ignora carregamento encerrado após desmontagem", async () => {
  let resolve!: (p: PublicProject[]) => void;
  const view = render(
    <Catalog
      provider={{
        list: () =>
          new Promise((r) => {
            resolve = r;
          }),
        get: async () => undefined,
      }}
    />,
  );
  view.unmount();
  await act(async () => resolve(catalogExamples));
});

it("abre acervo anonimamente sem consultar sessão e nunca usa demo em erro HTTP", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  await screen.findByText("Nenhum projeto publicado");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/api/catalog", expect.anything());
});

it("carrega a demonstração isolada e identifica exemplos sem links de arquivos", async () => {
  window.history.replaceState(null, "", "/demo/acervo/17");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<App />);
  await screen.findByRole("heading", { name: catalogExamples[0].title });
  expect(screen.getByLabelText("Demonstração").textContent).toContain(
    "dados fictícios",
  );
  expect(screen.queryByRole("link", { name: "Baixar Relatório" })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.getAllByText(/sem arquivo nesta demonstração/)).toHaveLength(
      2,
    ),
  );
});
