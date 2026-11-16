import { test, expect } from "@playwright/test";
import type { Page, Browser } from "@playwright/test";
const fixtureOrigin = () =>
  `http://localhost:${test.info().project.name === "mobile" ? 5183 : 5182}`;
const authorization = "Autorização do grupo registrada na ata da apresentação.";
async function login(page: Page, origin: string) {
  await page.goto(`${origin}/projetos/1`);
  await page.getByLabel("E-mail institucional").fill("professor@labrary.local");
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
}
async function ensurePublished(browser: Browser, origin: string) {
  const teacher = await browser.newContext({ baseURL: origin });
  try {
    expect(
      (
        await teacher.request.post("/api/auth/login", {
          headers: { "X-CSRF-Protection": "1" },
          data: { email: "professor@labrary.local", password: "Labrary@2026" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await teacher.request.post("/api/projects/1/finalization", {
          headers: { "X-CSRF-Protection": "1" },
          data: { submissionId: 11 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await teacher.request.post("/api/projects/1/publication", {
          headers: { "X-CSRF-Protection": "1" },
          data: {
            submissionId: 11,
            materialVersionIds: [1, 2],
            groupAuthorization: { confirmed: true, reference: authorization },
          },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await teacher.close();
  }
}

test("HU11 professor finaliza e publica somente os materiais autorizados", async ({
  page,
  browser,
}) => {
  const origin = fixtureOrigin();
  await login(page, origin);
  const panel = page.getByRole("region", { name: "Finalização e publicação" });
  await panel.getByLabel("Confirmo a finalização desta rodada.").check();
  await panel.getByRole("button", { name: "Finalizar projeto" }).click();
  await expect(
    panel.getByText("Projeto finalizado. O conteúdo continua privado."),
  ).toBeVisible();
  const visitor = await browser.newContext({ baseURL: origin });
  try {
    expect((await visitor.request.get("/api/catalog/1")).status()).toBe(404);
  } finally {
    await visitor.close();
  }
  await panel.getByLabel("Vídeo de apresentação · v1").check();
  await panel.getByLabel("Relatório do projeto · v1").check();
  await panel
    .getByLabel("O grupo autorizou a divulgação dos materiais selecionados.")
    .check();
  await panel
    .getByLabel("Registro da autorização do grupo")
    .fill(authorization);
  await panel.getByRole("button", { name: "Publicar no acervo" }).click();
  await expect(
    panel.getByText("Projeto publicado com os materiais autorizados."),
  ).toBeVisible();
  await page.reload();
  await expect(
    panel.getByRole("link", { name: "Abrir projeto no acervo" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: `test-results/publicacao-${test.info().project.name}.png`,
  });
});

test("HU11 visitante consulta C4, reproduz vídeo e baixa somente documentos autorizados", async ({
  page,
  browser,
}) => {
  const origin = fixtureOrigin();
  await ensurePublished(browser, origin);
  await page.goto(`${origin}/acervo`);
  await page
    .getByRole("link", {
      name: "Controlador de semáforo inteligente",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Materiais autorizados" }),
  ).toBeVisible();
  const video = page.getByLabel("Vídeo de apresentação");
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await video.evaluate((element: HTMLVideoElement) => element.play());
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("link", { name: "Baixar Relatório do projeto" }),
  ).toBeVisible();
  await expect(page.getByText("Manual de uso", { exact: true })).toHaveCount(0);
  expect(
    (
      await page.request.get(`${origin}/api/catalog/1/materials/3/file`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(`${origin}/api/catalog/1/materials/1/file`, {
        headers: { Range: "bytes=0-15" },
      })
    ).status(),
  ).toBe(206);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/acervo-real-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("HU11 retirada bloqueia catálogo, documentos, HEAD e novas requisições Range", async ({
  page,
  browser,
}) => {
  const origin = fixtureOrigin();
  await ensurePublished(browser, origin);
  await login(page, origin);
  const panel = page.getByRole("region", { name: "Finalização e publicação" });
  await panel.getByLabel("Confirmo a retirada do acervo.").check();
  await panel.getByRole("button", { name: "Retirar publicação" }).click();
  await expect(
    panel.getByText("Publicação retirada. O conteúdo privado foi preservado."),
  ).toBeVisible();
  const visitor = await browser.newContext({ baseURL: origin });
  try {
    const videoUrl = "/api/catalog/1/materials/1/file";
    for (const url of [
      "/api/catalog/1",
      videoUrl,
      "/api/catalog/1/materials/2/file",
    ])
      expect((await visitor.request.get(url)).status()).toBe(404);
    expect(
      (
        await visitor.request.get(videoUrl, {
          headers: { Range: "bytes=0-15" },
        })
      ).status(),
    ).toBe(404);
    expect((await visitor.request.head(videoUrl)).status()).toBe(404);
    const publicPage = await visitor.newPage();
    await publicPage.goto(`${origin}/acervo/1`);
    await expect(
      publicPage.getByRole("heading", { name: "Publicação não encontrada" }),
    ).toBeVisible();
    await publicPage.goto(`${origin}/acervo`);
    await expect(
      publicPage.getByRole("heading", { name: "Nenhum projeto publicado" }),
    ).toBeVisible();
  } finally {
    await visitor.close();
  }
  await page.reload();
  await panel.getByText("Histórico de publicação (3)").click();
  await expect(
    panel.getByText(/Autorização: Autorização do grupo/),
  ).toBeVisible();
});

test("HU11 mantém a finalização indisponível sem os provedores reais", async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL!);
  const panel = page.getByRole("region", { name: "Finalização e publicação" });
  await expect(
    panel.getByText(/Finalização e publicação indisponíveis/),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Finalizar projeto" }),
  ).toBeDisabled();
});
