import { test, expect, Page } from "@playwright/test";
async function login(page: Page, role: string) {
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("button", { name: "Sair da conta" }),
  ).toBeVisible();
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
  await page.getByLabel("Filtrar por grupo").selectOption("1");
  await page.getByLabel("Filtrar por estado").selectOption("EM_AVALIACAO");
  await page.getByLabel("Filtrar por pendências").selectOption("true");
  await expect(
    page.getByText("Pendentes: Vídeo, Relatório, Manual"),
  ).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/acompanhamento-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("Filtrar por pendências").selectOption("false");
  await expect(page.getByText("Nenhum resultado por aqui")).toBeVisible();
  await page.getByLabel("Filtrar por pendências").selectOption("");
  await page.getByLabel("Filtrar por estado").selectOption("PREPARACAO");
  await expect(page.getByText("Nenhum resultado por aqui")).toBeVisible();
  await page.getByLabel("Filtrar por estado").selectOption("");
  expect(
    (
      await context.request.get("/api/projects?groupId=2&pending=true")
    ).status(),
  ).toBe(200);
  expect(
    await (
      await context.request.get("/api/projects?groupId=2&pending=true")
    ).json(),
  ).toEqual({ data: [] });
  await page
    .getByRole("link", { name: "Abrir Controlador de semáforo inteligente" })
    .click();
  await expect(page.getByText("Uma ideia em construção")).toBeVisible();
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

test("HU07 conserva feedback privado e versão após recarga e falha de resposta", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await login(page, "aluno");
  const materialInput = {
    kind: "RELATORIO",
    title: "Relatório de feedback",
    originalFilename: "feedback.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1200,
  };
  const first = await context.request.post("/api/projects/2/materials", {
    headers: { "X-CSRF-Protection": "1" },
    data: materialInput,
  });
  expect(first.status()).toBe(201);
  const version = (await first.json()).data;
  await page.goto("/projetos/2");
  await expect(
    page.getByText("Nenhuma mensagem ainda. Comece a conversa."),
  ).toBeVisible();
  await page
    .getByLabel("Contexto da mensagem")
    .selectOption(String(version.id));
  expect(
    (
      await context.request.post("/api/projects/2/materials", {
        headers: { "X-CSRF-Protection": "1" },
        data: materialInput,
      })
    ).status(),
  ).toBe(201);
  const text = '<script>alert("feedback")</script> Podemos revisar o circuito?';
  await page.getByLabel("Mensagem", { exact: true }).fill(text);
  await page.route(
    "**/api/projects/2/messages",
    async (route) => {
      if (route.request().method() === "POST") {
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.abort("failed");
      } else await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByRole("region", { name: "Feedback do projeto" }).getByRole("alert")).toContainText("Seu texto foi mantido");
  await expect(page.getByLabel("Mensagem", { exact: true })).toHaveValue(text);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Mensagem enviada.")).toBeVisible();
  const conversation = page.getByRole("list", { name: "Mensagens do projeto" });
  await expect(conversation.getByRole("listitem")).toHaveCount(1);
  await expect(conversation.getByText(text)).toBeVisible();
  await expect(conversation.locator("script")).toHaveCount(0);
  await expect(
    conversation.getByText("Relatório de feedback · v1"),
  ).toBeVisible();
  await page.reload();
  await expect(conversation.getByText(text)).toBeVisible();
  await noHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/feedback-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await login(page, "professor");
  await page.goto("/projetos/2");
  await expect(conversation.getByText(text)).toBeVisible();
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Vamos revisar na próxima aula.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Mensagem enviada.")).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await login(page, "aluno");
  await page.goto("/projetos/2");
  await page.getByRole("button", { name: "Atualizar conversa" }).click();
  await expect(conversation.getByRole("listitem")).toHaveCount(2);
  await expect(conversation.getByRole("listitem").nth(1)).toContainText(
    "Helena Almeida",
  );
  await expect(conversation.getByRole("listitem").nth(1)).toContainText(
    "Vamos revisar na próxima aula.",
  );
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await login(page, "avaliador");
  expect((await context.request.get("/api/projects/2/messages")).status()).toBe(
    404,
  );
  await page.goto("/projetos/1");
  await page
    .getByLabel("Mensagem", { exact: true })
    .fill("Sugiro revisar a temporização.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Mensagem enviada.")).toBeVisible();
  await expect(conversation.getByText("Rafael Costa")).toBeVisible();
  await noHorizontalOverflow(page);
});
