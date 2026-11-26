import { test, expect, Page } from "@playwright/test";
import { resolve } from "node:path";

const projectPath = "/projetos/2";
const projectApi = "/api/projects/2";
const csrf = { "X-CSRF-Protection": "1" };

async function login(page: Page, role: "aluno" | "professor" | "avaliador") {
  if (await page.getByRole("button", { name: "Sair da conta", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await expect(page.getByLabel("E-mail institucional")).toBeVisible();
  }
  await page.goto(projectPath);
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta", exact: true })).toBeVisible();
}

async function openEvaluations(page: Page) {
  await page.getByRole("button", { name: "Avaliações por critérios", exact: true }).click();
  return page.getByRole("region", { name: "Avaliações por critérios" });
}

async function configureRubric(page: Page, version: 1 | 2) {
  const update = await page.request.post(`${projectApi}/configuration/versions`, {
    headers: csrf,
    data: {
      baseVersionId: version - 1,
      title: `Avaliação do protótipo ${version === 1 ? "inicial" : "revisado"}`,
      requirements: [
        { kind: "VIDEO", label: "Vídeo de apresentação", allowedMimeTypes: ["video/webm"] },
        { kind: "RELATORIO", label: "Relatório do projeto", allowedMimeTypes: ["application/pdf"] },
        { kind: "MANUAL", label: "Manual de uso", allowedMimeTypes: ["application/pdf"] },
      ].map(requirement => ({
        ...requirement,
        required: true,
        maxSizeBytes: 1024 * 1024,
        dueAt: "2099-11-25T23:59:00-03:00",
      })),
      criteria: (version === 1 ? [
        { id: "funcionamento", title: "Funcionamento", weight: 60 },
        { id: "documentacao", title: "Documentação", weight: 40 },
      ] : [
        { id: "entrega-final", title: "Entrega final", weight: 100 },
      ]).map(criterion => ({ ...criterion, description: "", minScore: 0, maxScore: 10 })),
    },
  });
  expect(update.status()).toBe(201);
}

const pdf = (name: string, text: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.7\n${text}\n%%EOF\n`),
});

async function submit(page: Page, round: 1 | 2) {
  const delivery = page.getByRole("region", { name: "Entrega para avaliação" });
  await expect(delivery.getByText("3 de 3 obrigatórios prontos")).toBeVisible();
  await delivery.getByRole("button", { name: "Submeter para avaliação" }).click();
  await delivery.getByRole("button", { name: "Confirmar submissão" }).click();
  await expect(delivery.getByText(`Projeto submetido. A rodada ${round} está em avaliação.`)).toBeVisible();
  const response = await page.request.get(`${projectApi}/submissions`);
  expect(response.ok()).toBe(true);
  const submissions: Array<{ id: number; round: number }> = (await response.json()).data;
  return submissions.find(submission => submission.round === round)!.id;
}

test("HU08 integra entrega, rascunho, finalização, consolidação e reabertura, preservando a rodada anterior", async ({ page }, info) => {
  const reason = "Rever a clareza da documentação entregue.";
  const comment = "Medição de consumo demonstrada pelo grupo.";
  await login(page, "professor");
  await configureRubric(page, 1);
  const assignment = await page.request.put(`${projectApi}/evaluators`, {
    headers: csrf,
    data: { evaluatorIds: [2] },
  });
  expect(assignment.ok()).toBe(true);

  await login(page, "aluno");
  await page.getByLabel("Arquivo para Vídeo de apresentação")
    .setInputFiles(resolve("e2e/fixtures/demonstracao.webm"));
  await page.getByLabel("Arquivo para Relatório do projeto")
    .setInputFiles(pdf("relatorio.pdf", "Relatório da primeira rodada"));
  await page.getByLabel("Arquivo para Manual de uso")
    .setInputFiles(pdf("manual.pdf", "Manual da primeira rodada"));
  const firstSubmission = await submit(page, 1);
  expect((await page.request.get(`${projectApi}/submissions/${firstSubmission}/evaluations`)).status()).toBe(403);
  await expect(page.getByRole("button", { name: "Avaliações por critérios" })).toHaveCount(0);

  await login(page, "avaliador");
  const panel = await openEvaluations(page);
  const operation = panel.getByLabel("Nota — Funcionamento", { exact: true });
  const documentation = panel.getByLabel("Nota — Documentação", { exact: true });
  const draft = panel.getByRole("button", { name: "Salvar rascunho" });
  const finalize = panel.getByRole("button", { name: "Finalizar avaliação" });
  await expect(panel.getByRole("heading", { name: "Avaliação do protótipo inicial · Versão 1" })).toBeVisible();
  const material = panel.getByRole("link", { name: "Manual de uso — versão 1" });
  const manual = await page.request.get((await material.getAttribute("href"))!);
  expect(manual.ok()).toBe(true);
  expect(await manual.text()).toContain("Manual da primeira rodada");
  await operation.fill("0");
  await draft.click();
  await expect(panel.getByText("Rascunho salvo.")).toBeVisible();
  await page.reload();
  await openEvaluations(page);
  await expect(operation).toHaveValue("0");
  await expect(documentation).toHaveValue("");
  await finalize.click();
  await expect(panel.getByRole("alert")).toContainText("Preencha a nota de Documentação.");
  await operation.fill("8");
  await documentation.fill("9");
  await panel.getByLabel("Comentário — Funcionamento", { exact: true }).fill(comment);
  await draft.click();
  await expect(panel.getByText("Rascunho salvo.")).toBeVisible();
  if (info.project.name === "desktop") {
    await panel.screenshot({ path: info.outputPath("avaliacao.png") });
  }
  await finalize.click();
  await expect(panel.getByText("Avaliação finalizada.")).toBeVisible();
  await expect(draft).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // S7/HU10: finalização da avaliação não libera o resultado automaticamente.
  await login(page, "aluno");
  await expect(page.getByRole("region", { name: "Resultado do grupo" })).toContainText("Resultado bloqueado");
  expect(await (await page.request.get(`${projectApi}/result`)).json()).toEqual({
    data: { projectId: 2, resultReleased: false },
  });
  expect((await page.request.get("/api/projects/1/result")).status()).toBe(404);

  await login(page, "professor");
  await page.getByRole("button", { name: "Consolidação de notas" }).click();
  const group = page.getByRole("row").filter({ hasText: "Grupo 02" });
  await expect(group.getByText("8.40", { exact: true })).toBeVisible();
  const exportCsv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await exportCsv).suggestedFilename()).toBe("notas-turma-1.csv");
  const csv = await page.request.get("/api/classes/1/grades?format=csv");
  expect(await csv.text()).toContain('"8.40","Final"');
  const release = group.getByRole("button", { name: "Liberar resultado de Grupo 02" });
  await release.click();
  await page.getByRole("button", { name: "Confirmar liberação" }).click();
  await expect(group.getByText("Liberado", { exact: true })).toBeVisible();

  await login(page, "aluno");
  const result = page.getByRole("region", { name: "Resultado do grupo" });
  await expect(result).toContainText("Nota: 8.40");
  await expect(result).toContainText(comment);
  await expect(result).toContainText("Peso: 60% · Nota: 8.00");
  await expect(result).toContainText("Peso: 40% · Nota: 9.00");
  expect((await page.request.get("/api/projects/1/result")).status()).toBe(404);
  expect((await page.request.get("/api/classes/1/grades")).status()).toBe(403);
  await result.screenshot({ path: info.outputPath("resultado-real.png") });

  await login(page, "professor");
  await openEvaluations(page);
  await panel.getByRole("button", { name: "Reabrir avaliação" }).click();
  await panel.getByLabel("Justificativa da reabertura").fill(reason);
  await panel.getByRole("button", { name: "Confirmar reabertura" }).click();
  await expect(panel.getByText("Avaliação reaberta.")).toBeVisible();
  await panel.getByText(/^Histórico da avaliação/).click();
  await expect(panel.getByText(`Justificativa: ${reason}`)).toBeVisible();
  if (info.project.name === "desktop") {
    await panel.screenshot({ path: info.outputPath("reabertura.png") });
  }

  await login(page, "aluno");
  await expect(result).toContainText("Resultado bloqueado. Aguardando liberação pelo professor.");
  expect(await (await page.request.get(`${projectApi}/result`)).json()).toEqual({
    data: { projectId: 2, resultReleased: false },
  });
  await expect(result.getByText(comment)).toHaveCount(0);

  await login(page, "avaliador");
  await openEvaluations(page);
  await expect(operation).toHaveValue("8");
  await expect(documentation).toHaveValue("9");
  await finalize.click();
  await expect(panel.getByText("Avaliação finalizada.")).toBeVisible();

  await login(page, "professor");
  await page.getByRole("button", { name: "Consolidação de notas" }).click();
  await expect(group.getByText("8.40", { exact: true })).toBeVisible();
  await expect(release).toBeEnabled();
  await page.goto(projectPath);
  await configureRubric(page, 2);
  const delivery = page.getByRole("region", { name: "Entrega para avaliação" });
  await delivery.getByRole("button", { name: "Devolver para ajustes" }).click();
  await delivery.getByRole("button", { name: "Confirmar devolução" }).click();
  await expect(delivery.getByText(/Rodada 1 devolvida para ajustes/)).toBeVisible();

  await login(page, "aluno");
  await page.getByLabel("Arquivo para Manual de uso")
    .setInputFiles(pdf("manual-revisado.pdf", "Manual da segunda rodada"));
  await expect(delivery.getByText(/Manual de uso\s*Presente \(versão 2\)/)).toBeVisible();
  await submit(page, 2);
  await expect(result).toContainText("Resultado bloqueado. Aguardando liberação pelo professor.");

  await login(page, "avaliador");
  await openEvaluations(page);
  await expect(panel.getByRole("heading", { name: "Avaliação do protótipo revisado · Versão 2" })).toBeVisible();
  await expect(panel.getByLabel("Nota — Entrega final", { exact: true })).toHaveValue("");
  await panel.getByRole("combobox", { name: "Rodada de avaliação" }).selectOption({ label: "Rodada 1" });
  await expect(panel.getByRole("heading", { name: "Avaliação do protótipo inicial · Versão 1" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Manual de uso — versão 1" })).toBeVisible();
  await expect(panel.getByText(comment, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(finalize).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
