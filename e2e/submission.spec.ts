import { test, expect, Page } from "@playwright/test";

// Os servidores E2E são compartilhados pelos arquivos, em ordem alfabética: este
// arquivo roda depois de materials.spec.ts e funciona com ou sem materiais prévios.
// Submeter bloqueia o projeto 2; specs futuras que enviem materiais nele devem rodar antes.

async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("button", { name: "Sair da conta", exact: true })).toBeVisible();
}
async function switchTo(page: Page, role: string) {
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
  await page.goto("/projetos/2");
  await login(page, role);
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
const pdf = (name: string, text: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.7\n${text}\n%%EOF\n`),
});
const mp4 = {
  name: "apresentacao.mp4",
  mimeType: "video/mp4",
  buffer: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(24, 1)]),
};
const requirement = (kind: string, label: string, allowedMimeTypes: string[]) => ({
  kind, label, required: true, allowedMimeTypes, maxSizeBytes: 20 * 1024 * 1024, dueAt: "2099-11-25T23:59:00-03:00",
});

test("HU05 submete, bloqueia, devolve para ajustes e cria nova rodada", async ({ page }) => {
  await page.goto("/projetos/2");
  await login(page, "professor");
  // Requisitos (C0) pela API real; a interface da rubrica é coberta em assessment.spec.ts.
  const current = (await (await page.request.get("/api/projects/2/configuration")).json()).data;
  const configured = await page.request.post("/api/projects/2/configuration/versions", {
    headers: { "X-CSRF-Protection": "1" },
    data: {
      baseVersionId: current?.id ?? 0,
      title: "Entrega final E2E",
      requirements: [
        requirement("VIDEO", "Vídeo de apresentação", ["video/mp4", "video/webm"]),
        requirement("RELATORIO", "Relatório do projeto", ["application/pdf"]),
        requirement("MANUAL", "Manual de uso", ["application/pdf"]),
      ],
      criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
    },
  });
  expect(configured.status()).toBe(201);

  await switchTo(page, "aluno");
  const panel = page.getByRole("region", { name: "Entrega para avaliação" });
  await expect(panel).toBeVisible();
  await page.getByLabel("Arquivo para Vídeo de apresentação").setInputFiles(mp4);
  await page.getByLabel("Arquivo para Manual de uso").setInputFiles(pdf("manual.pdf", "manual v1"));
  await page.getByLabel("Arquivo para Relatório do projeto").setInputFiles(pdf("relatorio-final.pdf", "relatório final"));
  await expect(panel.getByText("3 de 3 obrigatórios prontos")).toBeVisible();

  await panel.getByRole("button", { name: "Submeter para avaliação" }).click();
  await expect(panel.getByRole("group", { name: "Confirmar submissão" })).toContainText("os materiais ficam bloqueados");
  await noHorizontalOverflow(page);
  await panel.getByRole("button", { name: "Confirmar submissão" }).click();
  await expect(panel.getByText("Projeto submetido. A rodada 1 está em avaliação.")).toBeVisible();
  await expect(page.locator(".status-pill")).toHaveText("Em avaliação");
  await expect(page.getByText(/Os materiais ficam bloqueados enquanto/)).toBeVisible();
  await expect(page.getByLabel("Arquivo para Manual de uso")).toHaveCount(0);
  await expect(panel.getByText(/Projeto submetido e em avaliação/)).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `test-results/submissao-aluno-${test.info().project.name}.png`, fullPage: true });

  await switchTo(page, "professor");
  await expect(panel.getByText(/Rodada 1/)).toBeVisible();
  await panel.getByRole("button", { name: "Devolver para ajustes" }).click();
  await panel.getByRole("button", { name: "Confirmar devolução" }).click();
  await expect(panel.getByText(/Rodada 1 devolvida para ajustes/)).toBeVisible();
  await expect(page.locator(".status-pill")).toHaveText("Em ajustes");

  await switchTo(page, "aluno");
  await page.getByLabel("Arquivo para Manual de uso").setInputFiles(pdf("manual-v2.pdf", "manual v2"));
  await expect(panel.getByText(/Manual de uso\s*Presente \(versão 2\)/)).toBeVisible();
  await panel.getByRole("button", { name: "Submeter para avaliação" }).click();
  await panel.getByRole("button", { name: "Confirmar submissão" }).click();
  await expect(panel.getByText("Projeto submetido. A rodada 2 está em avaliação.")).toBeVisible();

  // Após recarregar, o histórico vem da API: a rodada 1 continua com o manual v1.
  await page.reload();
  const rounds = panel.locator(".submission-rounds > li");
  await expect(rounds).toHaveCount(2);
  await expect(rounds.nth(0)).toContainText("Rodada 2 · Em avaliação");
  await expect(rounds.nth(0)).toContainText("Manual de uso — versão 2");
  await expect(rounds.nth(1)).toContainText("Rodada 1 · Devolvida para ajustes");
  await expect(rounds.nth(1)).toContainText("Manual de uso — versão 1");
  await noHorizontalOverflow(page);
});
