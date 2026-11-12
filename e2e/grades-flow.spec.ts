import { expect, Page, test } from "@playwright/test";
// TODO(S6 #41 / Yuhang #39): acrescentar fluxo com C1/C2 persistidos reais,
// incluindo reinício da API, reabertura, refinalização e nova rodada. Manter
// este cenário de contrato; o fixture atual não comprova integração da HU08.
async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
}
test("tabela, CSV e confirmação de liberação com C2 injetado somente no servidor de testes", async ({ page, context }, info) => {
  const origin = "http://localhost:5182";
  await page.goto(`${origin}/`); await login(page, "aluno");
  const before = await context.request.get(`${origin}/api/projects/1/result`);
  expect(before.status()).toBe(200);
  expect(await before.json()).toEqual({ data: { projectId: 1, resultReleased: false } });
  expect((await context.request.get(`${origin}/api/projects/2/result`)).status()).toBe(404);
  await page.getByRole("button", { name: "Sair da conta" }).click(); await login(page, "professor");
  await page.getByRole("button", { name: "Consolidação de notas" }).click();
  const table = page.getByRole("table");
  await expect(table.getByText("8.40", { exact: true })).toBeVisible();
  await expect(table.getByText("Sem submissão", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await download).suggestedFilename()).toBe("notas-turma-1.csv");
  const csv = await context.request.get(`${origin}/api/classes/1/grades?format=csv`);
  expect(await csv.text()).toContain('"8.40","Final"');
  const release = table.getByRole("button", { name: "Liberar resultado de Grupo 01" });
  await release.click();
  await expect(page.getByRole("region", { name: "Confirmar liberação" })).toContainText("8.40");
  await page.getByRole("button", { name: "Confirmar liberação" }).click();
  await expect(page.getByText("Resultado liberado para o grupo.")).toBeVisible();
  await expect(table.getByText("Liberado", { exact: true })).toBeVisible();
  await page.reload(); await expect(table.getByText("Liberado", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/notas-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Sair da conta" }).click(); await login(page, "aluno");
  const result = await context.request.get(`${origin}/api/projects/1/result`);
  expect((await result.json()).data).toMatchObject({ resultReleased: true, finalGrade: 8.4, allEvaluationsCompleted: true });
});
