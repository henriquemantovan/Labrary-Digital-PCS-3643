import { test, expect, Page } from "@playwright/test";
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

test("login, erro genérico, isolamento do aluno, recarga e logout", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu próximo projeto começa aqui." }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/login-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("E-mail institucional").fill("aluno@labrary.local");
  await page.getByLabel("Senha", { exact: true }).fill("incorreta");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha inválidos.",
  );
  await login(page, "aluno");
  await expect(
    page.getByRole("heading", { name: "Olá, Marina." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Monitor de consumo energético",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Controlador de semáforo inteligente", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "+ Novo projeto" }),
  ).toHaveCount(0);
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/aluno-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Olá, Marina." }),
  ).toBeVisible();
  await page.goto("/projetos/1");
  await expect(page.getByRole("alert")).toHaveText("Projeto não encontrado.");
  const forbidden = await context.request.get("/api/projects/1/materials");
  expect(forbidden.status()).toBe(404);
  const cookies = await context.cookies(
    new URL("/api/auth/me", page.url()).href,
  );
  const session = cookies.find((cookie) => cookie.name === "labrary_session")!;
  expect(session.httpOnly).toBe(true);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar no meu espaço" }),
  ).toBeVisible();
  const replay = await context.request.get("/api/projects", {
    headers: { Cookie: `labrary_session=${session.value}` },
  });
  expect(replay.status()).toBe(401);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Entrar no meu espaço" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
});

test("avaliador acessa somente projeto atribuído", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await login(page, "avaliador");
  await expect(
    page.getByRole("heading", { name: "Olá, Rafael." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Controlador de semáforo inteligente",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Monitor de consumo energético", { exact: true }),
  ).toHaveCount(0);
  expect((await context.request.get("/api/projects/2")).status()).toBe(404);
  await page
    .getByRole("link", { name: "Abrir Controlador de semáforo inteligente" })
    .click();
  await expect(page.getByText(/Os materiais ficam bloqueados/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar arquivo" }),
  ).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test("professor consulta turma, filtra e cria projeto no grupo disponível", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, "professor");
  await expect(
    page.getByRole("heading", { name: "Olá, Helena." }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/professor-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Minhas turmas" }).click();
  await expect(
    page.getByRole("heading", { name: "Laboratório de Sistemas Digitais" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gerenciar projetos" }).click();
  await page.getByRole("textbox", { name: "Buscar projetos" }).fill("zzzzz");
  await expect(page.getByText("Nenhum resultado por aqui")).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar projetos" }).clear();
  await page.getByRole("button", { name: "+ Novo projeto" }).click();
  await page.getByRole("textbox", { name: "Título" }).fill("Contador síncrono");
  await page.getByRole("textbox", { name: "Categoria" }).fill("Lógica digital");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(
    page.getByRole("heading", { name: "Contador síncrono" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
