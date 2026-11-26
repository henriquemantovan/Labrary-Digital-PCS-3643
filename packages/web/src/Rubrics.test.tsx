import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rubrics } from "./Rubrics";
import { rubric } from "./test/assessmentFixtures";
import type { RubricVersion } from "./assessmentTypes";

let versions: RubricVersion[];
let failStatus: number;
let writes: Record<string, unknown>[];
const expired = vi.fn();
beforeEach(() => {
  versions = []; failStatus = 0; writes = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
    if (failStatus) return new Response(JSON.stringify({ error: { message: "Falha nos critérios de avaliação" } }), { status: failStatus });
    if (options?.method === "POST") {
      const input = JSON.parse(String(options.body)); writes.push(input);
      const saved = { ...rubric, ...input, id: versions.length + 1, versionNumber: versions.length + 1 };
      versions.push(saved);
      return new Response(JSON.stringify({ data: saved }), { status: 201 });
    }
    return new Response(JSON.stringify({ data: versions }));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function openForm() {
  await userEvent.click(await screen.findByRole("button", { name: "Nova versão dos critérios de avaliação" }));
}
function deadlines() {
  for (const name of ["Vídeo", "Relatório", "Manual"]) fireEvent.change(screen.getByLabelText(`Prazo de ${name}`), { target: { value: "2026-12-01T12:00" } });
}
describe("requisitos e critérios de avaliação", () => {
  it("exibe a nomenclatura atual em versões históricas sem alterar seus títulos e identificadores", async () => {
    versions = [
      { ...structuredClone(rubric), title: "Rubrica de demonstração" },
      { ...structuredClone(rubric), id: 2, versionNumber: 2, title: "rubrica do projeto" },
    ];
    const persisted = structuredClone(versions);
    render(<Rubrics projectId={1} canEdit expired={expired} />);

    expect(await screen.findByRole("heading", { name: "critérios de avaliação do projeto · Versão 2" })).toBeDefined();
    await userEvent.click(screen.getByText("Versões anteriores (1)"));
    expect(screen.getByRole("heading", { name: "Critérios de avaliação de demonstração · Versão 1" })).toBeDefined();
    await openForm();
    expect((screen.getByLabelText("Título dos critérios de avaliação") as HTMLInputElement).value)
      .toBe("critérios de avaliação do projeto");
    expect(versions).toEqual(persisted);
    expect(writes).toHaveLength(0);
  });
  it("cria versão com requisitos completos e preserva uma versão anterior", async () => {
    const refresh = vi.fn(async () => {});
    render(<Rubrics projectId={1} canEdit expired={expired} onConfigurationSaved={refresh} />);
    expect(await screen.findByText("Nenhum conjunto de critérios de avaliação configurado para este projeto.")).toBeDefined();
    await openForm(); deadlines();
    fireEvent.change(screen.getByLabelText("Título dos critérios de avaliação"), { target: { value: "Primeiros critérios de avaliação" } });
    fireEvent.change(screen.getByLabelText("Descrição do critério 1"), { target: { value: "Circuito funcional" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect(await screen.findByText(/Versão 1 salva/)).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(writes[0]).toMatchObject({ baseVersionId: 0, title: "Primeiros critérios de avaliação", criteria: [{ weight: 100, minScore: 0, maxScore: 10 }] });
    expect((writes[0].requirements as unknown[])).toHaveLength(3);
    await openForm();
    await userEvent.click(screen.getByLabelText("video/webm"));
    fireEvent.change(screen.getByLabelText("Tamanho máximo de Vídeo (MiB)"), { target: { value: "50" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect(await screen.findByText(/Versão 2 salva/)).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(writes[1]).toMatchObject({ baseVersionId: 1 });
    await userEvent.click(screen.getByText("Versões anteriores (1)"));
    expect(screen.getByRole("heading", { name: "Primeiros critérios de avaliação · Versão 1" })).toBeDefined();
  });
  it("valida soma dos pesos, adiciona e remove critérios sem alterar a versão existente", async () => {
    versions = [structuredClone(rubric)];
    render(<Rubrics projectId={1} canEdit expired={expired} />); await openForm();
    fireEvent.change(screen.getByLabelText("Peso do critério 1 (%)"), { target: { value: "50" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("soma seja 100%");
    expect(writes).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar critério" }));
    fireEvent.change(screen.getByLabelText("Critério 3"), { target: { value: "Documentação" } });
    fireEvent.change(screen.getByLabelText("Peso do critério 3 (%)"), { target: { value: "10" } });
    expect(screen.getByText("Soma dos pesos: 100%")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Remover critério 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar nova versão" }));
    expect(screen.queryByLabelText("Critério 1")).toBeNull();
    expect(versions[0].criteria[0].weight).toBe(60);
  });
  it("exige formato e permite recuperar falha ao salvar mantendo o formulário", async () => {
    versions = [structuredClone(rubric)];
    render(<Rubrics projectId={1} canEdit expired={expired} />); await openForm();
    await userEvent.click(screen.getByLabelText("video/mp4"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("pelo menos um formato");
    await userEvent.click(screen.getByLabelText("video/webm"));
    failStatus = 409;
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Falha nos critérios de avaliação");
    expect((screen.getByLabelText("Critério 1") as HTMLInputElement).value).toBe("Funcionamento");
    failStatus = 0;
    await userEvent.click(screen.getByRole("button", { name: "Recarregar critérios de avaliação" }));
    expect(await screen.findByRole("button", { name: "Nova versão dos critérios de avaliação" })).toBeDefined();
  });
  it("mostra versão somente para leitura e retorna ao login quando expira", async () => {
    versions = [structuredClone(rubric)];
    const view = render(<Rubrics projectId={1} canEdit={false} expired={expired} />);
    expect(await screen.findByRole("heading", { name: "Projeto digital · Versão 1" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Nova versão dos critérios de avaliação" })).toBeNull();
    failStatus = 401;
    view.rerender(<Rubrics projectId={2} canEdit={false} expired={expired} />);
    await waitFor(() => expect(expired).toHaveBeenCalledOnce());
  });
  it("recupera falha de consulta sem presumir configuração vazia", async () => {
    failStatus = 500;
    render(<Rubrics projectId={1} canEdit expired={expired} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Falha nos critérios de avaliação");
    expect(screen.queryByText("Nenhum conjunto de critérios de avaliação configurado para este projeto.")).toBeNull();
    failStatus = 0;
    await userEvent.click(screen.getByRole("button", { name: "Recarregar critérios de avaliação" }));
    expect(await screen.findByText("Nenhum conjunto de critérios de avaliação configurado para este projeto.")).toBeDefined();
  });
  it("mantém confirmação de gravação se a atualização do painel de materiais falha e permite recuperar", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("Não foi possível atualizar materiais")).mockResolvedValue(undefined);
    versions = [structuredClone(rubric)];
    render(<Rubrics projectId={1} canEdit expired={expired} onConfigurationSaved={refresh} />);
    await openForm();
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível atualizar materiais");
    expect(screen.getByText(/Versão 2 salva/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Recarregar critérios de avaliação" }));
    expect(await screen.findByRole("heading", { name: "Projeto digital · Versão 2" })).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
