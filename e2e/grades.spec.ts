import { expect, Page, test } from "@playwright/test";
async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
}
test("consolidação indica projetos sem submissão e restringe aluno", async ({ page, context }) => {
  await page.goto("/login"); await login(page, "professor");
  await page.getByRole("button", { name: "Consolidação de notas" }).click();
  await expect(page.getByRole("heading", { name: "Consolidação de notas" })).toBeVisible();
  const group = page.getByRole("row").filter({ hasText: "Grupo 02" });
  await expect(group).toContainText("Sem submissão");
  await expect(group.getByRole("button", { name: "Liberar resultado de Grupo 02" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
  await page.getByRole("button", { name: "Sair da conta" }).click(); await login(page, "aluno");
  await expect(page.getByRole("button", { name: "Consolidação de notas" })).toHaveCount(0);
  expect((await context.request.get("/api/classes/1/grades?format=csv")).status()).toBe(403);
  await page.goto("/notas");
  await expect(page.getByRole("table")).toHaveCount(0);
});
