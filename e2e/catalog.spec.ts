import { test, expect } from "@playwright/test";

test("catálogo demonstrativo: filtros, detalhe, voltar e recarregar em desktop/mobile", async ({
  page,
}) => {
  await page.goto("/demo/acervo");
  await expect(page.getByLabel("Demonstração")).toContainText(
    "dados fictícios",
  );
  await expect(page.getByRole("status")).toHaveText(
    "3 projeto(s) encontrado(s)",
  );
  await page.getByLabel("Buscar por título").fill("SEMÁFORO");
  await page.getByRole("combobox", { name: "Ano", exact: true }).selectOption("2026");
  await page.getByRole("combobox", { name: "Turma", exact: true }).selectOption("3");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("Sistemas digitais");
  await expect(page.getByRole("status")).toHaveText(
    "1 projeto(s) encontrado(s)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/catalogo-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Controlador de semáforo inteligente" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Materiais autorizados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Relatório", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Manual", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Baixar/ })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/catalogo-detalhe-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goBack();
  await expect(page.getByLabel("Buscar por título")).toHaveValue("SEMÁFORO");
  await page.getByRole("combobox", { name: "Ano", exact: true }).selectOption("2025");
  await expect(
    page.getByRole("heading", { name: "Nenhum resultado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "3 projeto(s) encontrado(s)",
  );
  await page
    .getByRole("link", { name: "Monitor de energia", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Monitor de energia" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum material autorizado para consulta pública."),
  ).toBeVisible();
  await page.getByRole("button", { name: /Voltar ao acervo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Acervo de projetos" }),
  ).toBeVisible();
  await page.goto("/demo/acervo/999");
  await expect(
    page.getByRole("heading", { name: "Publicação não encontrada" }),
  ).toBeVisible();
});

test("catálogo HTTP anônimo mostra indisponibilidade real, sem substituir por fixture", async ({
  page,
  context,
}) => {
  expect((await context.request.get("/api/catalog")).status()).toBe(404);
  await page.goto("/acervo");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar o acervo",
  );
  await expect(page.getByLabel("Demonstração")).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar o acervo",
  );
  await page.goto("/acervo/17");
  await expect(
    page.getByRole("heading", { name: "Publicação não encontrada" }),
  ).toBeVisible();
  expect((await context.request.get("/api/projects/2/messages")).status()).toBe(
    401,
  );
});
