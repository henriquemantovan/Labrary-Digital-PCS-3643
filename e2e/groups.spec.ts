import { test, expect } from "@playwright/test";

test("HU02 cadastra grupo e projeto e altera acesso de integrantes e avaliadores", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await page.getByLabel("E-mail institucional").fill("professor@labrary.local");
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await page.getByRole("button", { name: "Minhas turmas" }).click();
  await page.getByLabel("Nome do novo grupo").fill("Grupo Semana 5");
  await page.getByRole("button", { name: "Cadastrar grupo" }).click();
  await expect(
    page.getByRole("heading", { name: "Grupo Semana 5", exact: true }),
  ).toBeVisible();
  const members = page.getByRole("group", {
    name: "Integrantes de Grupo Semana 5",
    exact: true,
  });
  await members.getByLabel("Marina Oliveira").check();
  await members
    .getByRole("button", { name: "Salvar integrantes de Grupo Semana 5" })
    .click();
  await expect(page.getByText("Integrantes atualizados.")).toBeVisible();
  await page.reload();
  await expect(members.getByLabel("Marina Oliveira")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/grupos-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Gerenciar projetos" }).click();
  await page.getByRole("button", { name: "+ Novo projeto" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Projeto da Semana 5");
  await page
    .getByRole("combobox", { name: "Grupo", exact: true })
    .selectOption({
      label: "Grupo Semana 5 · Laboratório de Sistemas Digitais",
    });
  await page.getByLabel("Categoria", { exact: true }).fill("Sistemas digitais");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(
    page.getByRole("heading", { name: "Projeto da Semana 5", exact: true }),
  ).toBeVisible();
  const projectId = page.url().split("/").at(-1);
  const evaluators = page.getByRole("region", {
    name: "Gestão de avaliadores",
  });
  await evaluators.getByLabel("Rafael Costa").check();
  await evaluators.getByRole("button", { name: "Salvar avaliadores" }).click();
  await expect(evaluators.getByText("Avaliadores atualizados.")).toBeVisible();
  await page.reload();
  await expect(evaluators.getByLabel("Rafael Costa")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const student = await browser.newContext({ baseURL }),
    evaluator = await browser.newContext({ baseURL });
  try {
    for (const [session, role] of [
      [student, "aluno"],
      [evaluator, "avaliador"],
    ] as const) {
      expect(
        (
          await session.request.post("/api/auth/login", {
            headers: { "X-CSRF-Protection": "1" },
            data: { email: `${role}@labrary.local`, password: "Labrary@2026" },
          })
        ).status(),
      ).toBe(200);
      expect(
        (await session.request.get(`/api/projects/${projectId}`)).status(),
      ).toBe(200);
    }
    await evaluators.getByLabel("Rafael Costa").uncheck();
    await evaluators
      .getByRole("button", { name: "Salvar avaliadores" })
      .click();
    await expect(
      evaluators.getByText("Avaliadores atualizados."),
    ).toBeVisible();
    expect(
      (await evaluator.request.get(`/api/projects/${projectId}`)).status(),
    ).toBe(404);
    await page.getByRole("button", { name: "Minhas turmas" }).click();
    await members.getByLabel("Marina Oliveira").uncheck();
    await members
      .getByRole("button", { name: "Salvar integrantes de Grupo Semana 5" })
      .click();
    await expect(page.getByText("Integrantes atualizados.")).toBeVisible();
    expect(
      (await student.request.get(`/api/projects/${projectId}`)).status(),
    ).toBe(404);
    const section = page
      .getByRole("heading", { name: "Grupo Semana 5", exact: true })
      .locator("..");
    await section.getByText("Histórico de vínculos (2)").click();
    await expect(section.getByText(/Conta 3:/)).toHaveCount(2);
    await page.reload();
    await expect(members.getByLabel("Marina Oliveira")).not.toBeChecked();
  } finally {
    await student.close();
    await evaluator.close();
  }
});
