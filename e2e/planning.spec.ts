import { test, expect } from "@playwright/test";

test("docente configura grupo, vínculos, requisitos e versões; aluno consulta somente seu projeto", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("E-mail institucional").fill("professor@labrary.local");
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.getByRole("button", { name: "Minhas turmas" }).click();
  await page
    .getByRole("button", {
      name: "Gerenciar grupos de Laboratório de Sistemas Digitais",
    })
    .click();
  await page.getByLabel("Nome do novo grupo").fill("Grupo Sprint 3");
  await page.getByRole("button", { name: "Cadastrar grupo" }).click();
  await expect(
    page.getByRole("heading", { name: "Grupo Sprint 3" }),
  ).toBeVisible();
  const members = page.getByRole("group", {
    name: "Integrantes de Grupo 02",
    exact: true,
  });
  await members.getByLabel("Marina Oliveira").uncheck();
  await members
    .getByRole("button", { name: "Salvar integrantes de Grupo 02" })
    .click();
  await expect(
    page.getByText("Histórico de vínculos (1)", { exact: true }),
  ).toBeVisible();
  await members.getByLabel("Marina Oliveira").check();
  await members
    .getByRole("button", { name: "Salvar integrantes de Grupo 02" })
    .click();
  await expect(
    page.getByText("Histórico de vínculos (2)", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/grupos-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Gerenciar projetos", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Monitor de consumo energético", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Requisitos e rubricas", exact: true })
    .click();
  for (const label of ["Vídeo", "Relatório", "Manual"]) {
    await page
      .getByLabel(`Formatos de ${label} (MIME, separados por vírgula)`)
      .fill(label === "Vídeo" ? "video/mp4" : "application/pdf");
    await page.getByLabel(`Tamanho máximo de ${label} (bytes)`).fill("5000000");
    await page
      .getByLabel(`Prazo de ${label}`, { exact: true })
      .fill("2026-10-28T23:59");
  }
  await page.getByRole("button", { name: "Salvar requisitos" }).click();
  await expect(
    page.getByText("Configuração salva.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Título da rubrica", { exact: true }).fill("Sprint 3");
  await page.getByLabel("Critério 1", { exact: true }).fill("Funcionamento");
  await page.getByRole("button", { name: "Adicionar critério" }).click();
  await expect(
    page.getByRole("button", { name: "Criar nova versão" }),
  ).toBeDisabled();
  await page.getByLabel("Critério 2", { exact: true }).fill("Documentação");
  await page.getByLabel("Peso do critério 1 (%)", { exact: true }).fill("70");
  await page.getByLabel("Peso do critério 2 (%)", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Criar nova versão" }).click();
  await expect(page.getByText("v1 · Sprint 3", { exact: true })).toBeVisible();
  await page
    .getByLabel("Título da rubrica", { exact: true })
    .fill("Sprint 3 revisada");
  await page.getByRole("button", { name: "Criar nova versão" }).click();
  await expect(
    page.getByText("v2 · Sprint 3 revisada", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("v1 · Sprint 3", { exact: true })).toBeVisible();
  await page.getByLabel("Rafael Costa").check();
  await page.getByRole("button", { name: "Salvar avaliadores" }).click();
  await expect(
    page.getByText("Histórico de vínculos (1)", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/configuracao-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Requisitos e rubricas", exact: true })
    .click();
  await expect(page.getByLabel("Tamanho máximo de Manual (bytes)")).toHaveValue(
    "5000000",
  );
  await expect(page.getByText("v1 · Sprint 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await page.getByLabel("E-mail institucional").fill("aluno@labrary.local");
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page
    .getByRole("link", { name: "Monitor de consumo energético", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Requisitos e rubricas", exact: true })
    .click();
  await expect(page.getByText(/Vídeo · video\/mp4/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Criar nova versão" }),
  ).toHaveCount(0);
  const other = await page.request.get("/api/projects/1/rubrics");
  expect(other.status()).toBe(404);
});
