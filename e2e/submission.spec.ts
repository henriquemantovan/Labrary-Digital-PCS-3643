import { test, expect, Page } from "@playwright/test";

// A configuração de submissão usa servidores novos por execução e por perfil.
// O cenário prepara os próprios materiais e não depende da ordem de outras specs.

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
const openDueAt = "2099-11-25T23:59:00-03:00";
const requirement = (kind: string, label: string, allowedMimeTypes: string[], dueAt: string) => ({
  kind, label, required: true, allowedMimeTypes, maxSizeBytes: 20 * 1024 * 1024, dueAt,
});
// Requisitos (C0) pela API real, com a sessão do professor; a interface da rubrica é coberta em assessment.spec.ts.
async function configure(page: Page, dueAt: string) {
  const current = (await (await page.request.get("/api/projects/2/configuration")).json()).data;
  const configured = await page.request.post("/api/projects/2/configuration/versions", {
    headers: { "X-CSRF-Protection": "1" },
    data: {
      baseVersionId: current?.id ?? 0,
      title: "Entrega final E2E",
      requirements: [
        requirement("VIDEO", "Vídeo de apresentação", ["video/mp4", "video/webm"], dueAt),
        requirement("RELATORIO", "Relatório do projeto", ["application/pdf"], dueAt),
        requirement("MANUAL", "Manual de uso", ["application/pdf"], dueAt),
      ],
      criteria: [{ id: "funcionamento", title: "Funcionamento", description: "", weight: 100, minScore: 0, maxScore: 10 }],
    },
  });
  expect(configured.status()).toBe(201);
}

// Os cenários compartilham o projeto 2 do aluno de demonstração: a ordem importa.
test.describe.configure({ mode: "serial" });

test("HU04/HU05 bloqueiam formato inválido, entrega incompleta e prazo vencido", async ({ page }) => {
  await page.goto("/projetos/2");
  await login(page, "professor");
  await configure(page, openDueAt);

  await switchTo(page, "aluno");
  const panel = page.getByRole("region", { name: "Entrega para avaliação" });
  const checklist = panel.getByRole("list", { name: "Checklist da entrega" });
  await expect(checklist).toBeVisible();

  // Extensão aceita, mas bytes de vídeo: só o servidor detecta pela assinatura do arquivo.
  // Nada é gravado e é possível tentar de novo. O manual fica sem versões para não
  // alterar a numeração verificada no próximo cenário.
  const manualCard = page.locator(".material-card").filter({ hasText: "Manual de uso" });
  await page.getByLabel("Arquivo para Manual de uso").setInputFiles({ ...mp4, name: "manual.pdf", mimeType: "application/pdf" });
  await expect(manualCard.getByRole("alert")).toContainText("Formato não aceito. Envie PDF.");
  await expect(manualCard.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(checklist.getByRole("listitem").filter({ hasText: "Manual de uso" })).toContainText("Ausente");

  await page.getByLabel("Arquivo para Vídeo de apresentação").setInputFiles(mp4);
  await page.getByLabel("Arquivo para Relatório do projeto").setInputFiles(pdf("relatorio.pdf", "relatório"));
  await expect(panel.getByText("2 de 3 obrigatórios prontos")).toBeVisible();
  await expect(checklist.getByRole("listitem").filter({ hasText: "Relatório do projeto" })).toContainText("Presente (versão 1)");
  await expect(checklist.getByRole("listitem").filter({ hasText: "Manual de uso" })).toContainText("Ausente");
  await expect(panel.getByText("Envie todos os materiais obrigatórios no formato e tamanho exigidos para submeter.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Submeter para avaliação" })).toHaveCount(0);
  await noHorizontalOverflow(page);

  // Prazo vencido bloqueia a submissão e novos envios até o professor reabrir.
  await switchTo(page, "professor");
  await configure(page, "2020-11-25T23:59:00-03:00");
  await switchTo(page, "aluno");
  await expect(panel.getByText("O prazo de entrega terminou. Só o professor pode reabrir a entrega para ajustes.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Submeter para avaliação" })).toHaveCount(0);
  await expect(manualCard.getByText("Prazo deste material encerrado.")).toBeVisible();
  await expect(page.locator(".status-pill")).toHaveText("Em preparação");
  await noHorizontalOverflow(page);
});

test("HU05 submete, bloqueia, devolve para ajustes e cria nova rodada", async ({ page }) => {
  await page.goto("/projetos/2");
  await login(page, "professor");
  await configure(page, openDueAt);

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
