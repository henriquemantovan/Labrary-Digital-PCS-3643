import { test, expect } from "@playwright/test";
const password = "LabraryTeste@2026";

test("conta fictícia usa senha junto ao Google e perde a sessão quando a exceção é desligada", async ({ page, baseURL }) => {
  const enabled = baseURL!;
  const other = new URL(enabled); other.port = String(Number(other.port) + 1);
  const disabled = other.origin;
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Entrar com Google" })).toBeVisible();
  await expect(page.getByText(/Contas de teste do desenvolvimento/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("E-mail da conta de teste").fill("aluno@labrary.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Marina." })).toBeVisible();
  expect((await page.request.get(`${enabled}/api/auth/me`)).status()).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${disabled}/projetos/2`);
  await expect(page.getByRole("link", { name: "Entrar com Google" })).toBeVisible();
  await expect(page.getByLabel("E-mail da conta de teste")).toHaveCount(0);
  expect((await page.request.get(`${disabled}/api/auth/me`)).status()).toBe(401);
  expect((await page.request.get(`${enabled}/api/auth/me`)).status()).toBe(401);
  expect((await page.request.post(`${disabled}/api/auth/login`, {
    headers: { "X-CSRF-Protection": "1" }, data: { email: "aluno@labrary.test", password },
  })).status()).toBe(403);
});

test("contas comuns continuam no Google e apenas a identidade de teste atribuída entra por senha", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("E-mail da conta de teste");
  await email.fill("pessoa@usp.br");
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos.");
  const unknown = await page.request.post("/api/auth/login", {
    headers: { "X-CSRF-Protection": "1" },
    data: { email: "nao-cadastrada@labrary.test", password },
  });
  expect(unknown.status()).toBe(401);
  expect((await unknown.json()).error.code).toBe("INVALID_CREDENTIALS");
  await email.fill("avaliador@labrary.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Monitor de consumo energético", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Administrar usuários", exact: true })).toHaveCount(0);
});

test("conta de primeiro acesso conclui o cadastro fictício e conserva os dados no perfil", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail da conta de teste").fill("cadastro@labrary.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("heading", { name: "Complete seu cadastro" })).toBeVisible();
  await expect(page.getByText(/não valida uma identidade USP/)).toBeVisible();
  expect((await page.request.get("/api/projects")).status()).toBe(403);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Nome completo").fill("Aluno Fictício Desenvolvimento");
  await page.getByLabel("NUSP").fill("90000002");
  await page.getByLabel("Ano de ingresso").fill("2024");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Aluno." })).toBeVisible();
  await page.goto("/perfil");
  await expect(page.getByText("90000002", { exact: true })).toBeVisible();
  await expect(page.getByText("Conta de teste", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("90000002", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).data.googleLinked).not.toBe(true);
});

test("administrador revoga o convidado fictício e autoriza novamente pela interface", async ({ page, playwright, baseURL }) => {
  const guest = await playwright.request.newContext({ baseURL });
  try {
    expect((await guest.post("/api/auth/login", { headers: { "X-CSRF-Protection": "1" }, data: { email: "convidado@labrary.test", password } })).status()).toBe(200);
    await page.goto("/login");
    await page.getByLabel("E-mail da conta de teste").fill("admin@labrary.test");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
    await expect(page.getByRole("heading", { name: "Olá, Renata." })).toBeVisible();
    await page.goto("/administracao");
    const panel = page.getByRole("region", { name: "Convidados externos" });
    await panel.getByRole("button", { name: "Revogar acesso de convidado@labrary.test", exact: true }).click();
    await panel.getByRole("button", { name: "Confirmar revogação", exact: true }).click();
    await expect(panel.getByText("Acesso de convidado revogado.", { exact: true })).toBeVisible();
    expect((await guest.get("/api/auth/me")).status()).toBe(401);
    expect((await guest.post("/api/auth/login", { headers: { "X-CSRF-Protection": "1" }, data: { email: "convidado@labrary.test", password } })).status()).toBe(401);
    await panel.getByLabel("E-mail Google do convidado").fill("convidado@labrary.test");
    await panel.getByRole("button", { name: "Autorizar convidado", exact: true }).click();
    await expect(panel.getByText("Acesso de convidado autorizado para convidado@labrary.test.", { exact: true })).toBeVisible();
    const signed = await guest.post("/api/auth/login", { headers: { "X-CSRF-Protection": "1" }, data: { email: "convidado@labrary.test", password } });
    expect(signed.status()).toBe(200);
    expect((await signed.json()).data).toMatchObject({ guest: true, requiresAcademicProfile: false, developmentTest: true });
  } finally { await guest.dispose(); }
});
