import { expect, Page, test } from "@playwright/test";
async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
}
test("consolidação indisponível explica integração pendente e restringe aluno", async ({ page, context }) => {
  await page.goto("/"); await login(page, "professor");
  await page.getByRole("button", { name: "Consolidação de notas" }).click();
  await expect(page.getByRole("heading", { name: "Consolidação de notas" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("integração de avaliações ainda não está configurada");
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  await page.getByRole("button", { name: "Sair da conta" }).click(); await login(page, "aluno");
  await expect(page.getByRole("button", { name: "Consolidação de notas" })).toHaveCount(0);
  expect((await context.request.get("/api/classes/1/grades?format=csv")).status()).toBe(403);
  await page.goto("/notas");
  await expect(page.getByRole("table")).toHaveCount(0);
});
