import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectBoard } from "./components/ProjectBoard";
import type { Project } from "./api";

const project = (overrides: Partial<Project>): Project => ({
  id: 1,
  classId: 1,
  academicYear: 2026,
  groupId: 1,
  groupName: "Grupo 01",
  title: "Projeto",
  description: "Descrição",
  category: "Sistemas digitais",
  status: "PREPARACAO",
  dueAt: null,
  missingMaterials: [],
  ...overrides,
});

const projects = [
  project({
    id: 1,
    title: "Semáforo inteligente",
    status: "EM_AVALIACAO",
    dueAt: "2099-03-10T12:00:00.000Z",
    missingMaterials: ["VIDEO", "MANUAL"],
  }),
  project({
    id: 2,
    title: "Monitor de energia",
    groupId: 3,
    groupName: undefined,
    academicYear: null,
    dueAt: "2020-01-01T00:00:00.000Z",
  }),
  project({
    id: 3,
    title: "Contador síncrono",
    status: "FINALIZADO",
    dueAt: "2020-01-01T12:00:00.000Z",
    missingMaterials: undefined,
  }),
];

const column = (name: string) => within(screen.getByRole("region", { name }));

describe("quadro de projetos", () => {
  it("organiza os projetos em colunas por estado, com contagem", () => {
    render(<ProjectBoard projects={projects} navigate={vi.fn()} />);
    expect(
      column("Em preparação").getByRole("link", { name: "Monitor de energia" }),
    ).toBeDefined();
    expect(
      column("Em avaliação").getByRole("link", { name: "Semáforo inteligente" }),
    ).toBeDefined();
    expect(
      column("Finalizado").getByRole("link", { name: "Contador síncrono" }),
    ).toBeDefined();
    expect(column("Em ajustes").getByText("Nenhum projeto")).toBeDefined();
    expect(column("Em avaliação").queryByText("Monitor de energia")).toBeNull();
    expect(column("Em preparação").getByText("Projetos:").parentElement?.textContent).toBe(
      "Projetos: 1",
    );
  });

  it("mostra pendências, grupo e prazo de cada projeto", () => {
    render(<ProjectBoard projects={projects} navigate={vi.fn()} />);
    const evaluating = column("Em avaliação");
    expect(evaluating.getByText("Pendentes: Vídeo, Manual")).toBeDefined();
    expect(evaluating.getByText("Grupo 01")).toBeDefined();
    expect(evaluating.getByText("10 de mar.")).toBeDefined();
    const preparing = column("Em preparação");
    expect(preparing.getByText("Materiais obrigatórios presentes")).toBeDefined();
    expect(preparing.getByText("Grupo 03")).toBeDefined();
    expect(preparing.getByText("Prazo vencido")).toBeDefined();
    const finished = column("Finalizado");
    expect(finished.queryByText("Prazo vencido")).toBeNull();
    expect(finished.getByText("1 de jan.")).toBeDefined();
    expect(finished.queryByText(/Pendentes|Materiais obrigatórios/)).toBeNull();
  });

  it("abre o projeto pelo título ou pelo atalho do cartão", async () => {
    const navigate = vi.fn();
    render(<ProjectBoard projects={projects} navigate={navigate} />);
    await userEvent.click(screen.getByRole("link", { name: "Abrir Contador síncrono" }));
    await userEvent.click(screen.getByRole("link", { name: "Monitor de energia" }));
    expect(navigate.mock.calls).toEqual([["/projetos/3"], ["/projetos/2"]]);
  });
});
