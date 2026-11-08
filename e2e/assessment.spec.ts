import { test, expect, Page } from "@playwright/test";

test.use({ video: "on" });

async function login(page: Page, role: string) {
  await page.goto("/");
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta", exact: true })).toBeVisible();
  await page.goto("/projetos/1");
}

test("HU03 configura requisitos pela API real e preserva versões", async ({ page }) => {
  await login(page, "professor");
  await page.getByRole("button", { name: "Requisitos e rubrica", exact: true }).click();
  await page.getByRole("button", { name: "Criar nova versão da rubrica" }).click();
  for (const kind of ["Vídeo", "Relatório", "Manual"]) {
    await page.getByLabel(`Prazo de ${kind}`, { exact: true }).fill("2099-11-25T23:59");
  }
  await page.getByLabel("Título da rubrica").fill("Rubrica inicial E2E");
  await page.getByRole("button", { name: "Salvar nova versão", exact: true }).click();
  await expect(page.getByText("Versão 1 salva. As versões anteriores foram preservadas.")).toBeVisible();
  await page.getByRole("button", { name: "Criar nova versão da rubrica" }).click();
  await page.getByLabel("Título da rubrica").fill("Rubrica revisada E2E");
  await page.getByRole("button", { name: "Salvar nova versão", exact: true }).click();
  await expect(page.getByText("Versão 2 salva. As versões anteriores foram preservadas.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Requisitos e rubrica", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rubrica revisada E2E · Versão 2" })).toBeVisible();
  await page.getByText("Versões anteriores (1)", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rubrica inicial E2E · Versão 1" })).toBeVisible();
  const response = await page.request.get("/api/projects/1/material-rules");
  expect(response.ok()).toBe(true);
  const rules = (await response.json()).data.rules;
  expect(rules.filter((rule: { required: boolean }) => rule.required)).toHaveLength(3);
  expect(rules[0].dueAt).toMatch(/^2099-11-/);
  await expect(page.getByRole("button", { name: "Avaliações por rubrica" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/rubricas-${test.info().project.name}.png`, fullPage: true });
});

