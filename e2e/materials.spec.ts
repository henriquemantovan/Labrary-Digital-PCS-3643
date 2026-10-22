import { test, expect, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
const pdf = (name: string, text: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.7\n${text}\n%%EOF\n`),
});

test("aluno envia, substitui e baixa materiais; professor só consulta", async ({
  page,
  context,
}) => {
  await page.goto("/projetos/2");
  await login(page, "aluno");
  await expect(
    page.getByRole("heading", { name: "Materiais do projeto" }),
  ).toBeVisible();
  await expect(page.getByText(/0 de 3 obrigatórios enviados/)).toBeVisible();
  const report = page.getByLabel("Arquivo para Relatório do projeto");

  await report.setInputFiles({
    name: "relatorio.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("isto não é um PDF"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Formato não aceito. Envie PDF.",
  );
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();

  await report.setInputFiles(pdf("relatório técnico.pdf", "primeira versão"));
  await expect(page.getByText(/Enviado · versão 1 · Marina/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(/1 de 3 obrigatórios enviados/)).toBeVisible();

  await page
    .getByLabel("Arquivo para Relatório do projeto")
    .setInputFiles(pdf("relatório técnico v2.pdf", "segunda versão"));
  await expect(page.getByText(/Enviado · versão 2 · Marina/)).toBeVisible();
  await page.getByRole("button", { name: "Histórico (2)" }).click();
  const history = page.getByRole("list", {
    name: "Versões de Relatório do projeto",
  });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Baixar versão 1 de Relatório do projeto" })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("relatório técnico.pdf");
  expect(await readFile(await download.path(), "utf8")).toContain(
    "primeira versão",
  );
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/materiais-aluno-${test.info().project.name}.png`,
    fullPage: true,
  });

  const files = await context.request.get("/api/projects/2/materials");
  const [material] = (await files.json()).data;
  const downloadUrl = material.currentVersion.downloadUrl;
  expect((await context.request.get(downloadUrl)).status()).toBe(200);

  await page.getByRole("button", { name: "Sair da conta" }).click();
  expect((await context.request.get(downloadUrl)).status()).toBe(401);
  await page.goto("/projetos/2");
  await login(page, "professor");
  await expect(page.getByText(/Enviado · versão 2 · Marina/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Substituir" })).toHaveCount(0);
  await expect(page.getByText("Adicionar material complementar")).toHaveCount(
    0,
  );
  expect((await context.request.get(downloadUrl)).status()).toBe(200);
  await noHorizontalOverflow(page);

  await page.getByRole("button", { name: "Sair da conta" }).click();
  await page.goto("/");
  await login(page, "avaliador");
  await expect(
    page.getByRole("heading", { name: "Olá, Rafael." }),
  ).toBeVisible();
  expect((await context.request.get(downloadUrl)).status()).toBe(404);
});
