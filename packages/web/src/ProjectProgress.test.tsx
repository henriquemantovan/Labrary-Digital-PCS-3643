import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  nextStep,
  ProjectProgress,
  projectSteps,
  SectionNav,
} from "./pages/ProjectProgress";
import type { SubmissionChecklist } from "./submissionTypes";

const checklist = (
  blockedBy: SubmissionChecklist["blockedBy"],
  canSubmit = false,
): SubmissionChecklist => ({
  projectStatus: "PREPARACAO",
  rubricVersionId: blockedBy === "RUBRIC_NOT_CONFIGURED" ? null : 1,
  items: [],
  blockedBy,
  canSubmit,
  canReopen: false,
  lastReopening: null,
});

describe("etapas do projeto", () => {
  it("marca materiais pendentes e entrega bloqueada pelos requisitos", () => {
    const steps = projectSteps("PREPARACAO", ["VIDEO", "MANUAL"], checklist("RUBRIC_NOT_CONFIGURED"));
    expect(steps.map((step) => step.state)).toEqual(["current", "blocked", "todo", "todo"]);
    expect(steps[0].hint).toBe("Pendentes: Vídeo, Manual");
    expect(steps[1].hint).toBe("Aguardando requisitos do professor");
  });
  it("indica entrega pronta, avaliação em andamento e projeto finalizado", () => {
    expect(projectSteps("PREPARACAO", [], checklist(null, true)).map((s) => s.state)).toEqual([
      "done", "current", "todo", "todo",
    ]);
    expect(projectSteps("AJUSTES", [], null)[0].state).toBe("current");
    expect(projectSteps("PREPARACAO", [], checklist("INCOMPLETE_SUBMISSION"))[1].state).toBe("todo");
    expect(projectSteps("EM_AVALIACAO", [], null).map((s) => s.state)).toEqual([
      "done", "done", "current", "todo",
    ]);
    const finished = projectSteps("FINALIZADO", [], null);
    expect(finished.every((step) => step.state === "done")).toBe(true);
    expect(finished[3].hint).toBe("Projeto finalizado");
  });
});

describe("próximo passo por papel", () => {
  it("orienta o aluno do envio à submissão", () => {
    expect(nextStep("ALUNO", "PREPARACAO", ["VIDEO"], null)?.text).toBe(
      "Próximo passo: enviar 1 material obrigatório.",
    );
    expect(nextStep("ALUNO", "PREPARACAO", ["VIDEO", "MANUAL"], null)?.target?.id).toBe("secao-materiais");
    expect(nextStep("ALUNO", "PREPARACAO", [], checklist("RUBRIC_NOT_CONFIGURED"))?.target).toBeUndefined();
    expect(nextStep("ALUNO", "PREPARACAO", [], checklist("DEADLINE_PASSED"))?.text).toMatch(/Fale com o professor/);
    expect(nextStep("ALUNO", "PREPARACAO", [], checklist(null, true))?.target?.id).toBe("secao-entrega");
    expect(nextStep("ALUNO", "EM_AVALIACAO", [], null)?.target?.id).toBe("secao-feedback");
    expect(nextStep("ALUNO", "FINALIZADO", [], null)?.target?.id).toBe("secao-resultado");
    expect(nextStep("ALUNO", "PREPARACAO", [], checklist("SUBMISSION_LOCKED"))).toBeNull();
  });
  it("orienta professor e avaliador", () => {
    expect(nextStep("PROFESSOR", "PREPARACAO", ["VIDEO"], checklist("RUBRIC_NOT_CONFIGURED"))?.target?.label).toBe(
      "Configurar",
    );
    expect(nextStep("ADMIN", "PREPARACAO", ["VIDEO", "MANUAL"], null)?.text).toBe(
      "Aguardando o grupo enviar 2 materiais obrigatórios.",
    );
    expect(nextStep("PROFESSOR", "PREPARACAO", [], checklist("DEADLINE_PASSED"))?.target?.id).toBe("secao-entrega");
    expect(nextStep("PROFESSOR", "PREPARACAO", [], checklist(null, true))?.target).toBeUndefined();
    expect(nextStep("PROFESSOR", "EM_AVALIACAO", [], null)?.target?.id).toBe("secao-avaliacao");
    expect(nextStep("PROFESSOR", "FINALIZADO", [], null)?.target?.id).toBe("secao-publicacao");
    expect(nextStep("AVALIADOR", "EM_AVALIACAO", [], null)?.text).toBe("Próximo passo: avaliar a rodada submetida.");
    expect(nextStep("AVALIADOR", "PREPARACAO", [], null)?.text).toBe("Aguardando a submissão do grupo.");
    expect(nextStep("AVALIADOR", "FINALIZADO", [], null)).toEqual({ text: "Projeto finalizado." });
  });
});

describe("resumo de andamento", () => {
  it("mostra etapa atual e leva até a seção do próximo passo", async () => {
    const target = document.createElement("div");
    target.id = "secao-materiais";
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    render(
      <ProjectProgress project={{ status: "PREPARACAO" }} role="ALUNO" missing={["RELATORIO"]} checklist={null} />,
    );
    const progress = within(screen.getByRole("region", { name: "Andamento do projeto" }));
    expect(progress.getByText("Pendentes: Relatório")).toBeTruthy();
    expect(progress.getByText("Em preparação")).toBeTruthy();
    expect(screen.getByText("Materiais").closest("li")?.getAttribute("aria-current")).toBe("step");
    await userEvent.click(progress.getByRole("button", { name: "Enviar materiais" }));
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    target.remove();
  });
  it("mostra próximo passo sem ação e etapas concluídas", () => {
    render(
      <ProjectProgress project={{ status: "PREPARACAO" }} role="AVALIADOR" missing={[]} checklist={checklist("RUBRIC_NOT_CONFIGURED")} />,
    );
    expect(screen.getByText("Aguardando a submissão do grupo.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("navega entre seções sem alterar o endereço", async () => {
    render(<SectionNav items={[{ id: "secao-feedback", label: "Feedback" }]} />);
    await userEvent.click(screen.getByRole("link", { name: "Feedback" }));
    expect(window.location.hash).toBe("");
  });
});
