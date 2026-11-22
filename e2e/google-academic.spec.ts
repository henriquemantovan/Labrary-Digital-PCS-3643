import { test, expect, type Page } from "@playwright/test";
const origin = "http://localhost:5181";
const csrf = { "X-CSRF-Protection": "1" };
async function login(page: Page, choice: string) {
  await page.goto(origin);
  await expect(page.getByText(/Entre com seu e-mail USP/)).toBeVisible();
  await page.getByRole("link", { name: "Entrar com Google" }).click();
  await page.getByRole("link", { name: choice, exact: true }).click();
}

test("conta USP precisa concluir o cadastro e conta externa sem convite não entra", async ({
  page,
}, info) => {
  await login(page, "Selecionar conta externa não convidada");
  await expect(page.getByRole("alert")).toContainText("Use seu e-mail USP");
  expect((await page.request.get(`${origin}/api/auth/me`)).status()).toBe(401);
  await login(page, `Selecionar nova conta de aluno ${info.project.name}`);
  await expect(
    page.getByRole("heading", { name: "Complete seu cadastro" }),
  ).toBeVisible();
  const blocked = await page.request.get(`${origin}/api/projects`);
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error.code).toBe("ACADEMIC_PROFILE_REQUIRED");
  await page.goto(`${origin}/projetos/1`);
  await expect(
    page.getByRole("heading", { name: "Complete seu cadastro" }),
  ).toBeVisible();
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill(`Pessoa Cadastro ${info.project.name}`);
  await page
    .getByLabel("NUSP", { exact: true })
    .fill(info.project.name === "desktop" ? "90123451" : "90123452");
  await page.getByLabel("Ano de ingresso", { exact: true }).fill("2024");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("cadastro-academico.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Meu perfil", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `Pessoa Cadastro ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("2024", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await login(page, `Selecionar nova conta de aluno ${info.project.name}`);
  await expect(
    page.getByRole("heading", { name: "Olá, Pessoa." }),
  ).toBeVisible();
  const me = (await (await page.request.get(`${origin}/api/auth/me`)).json())
    .data;
  expect(me).toMatchObject({
    fullName: `Pessoa Cadastro ${info.project.name}`,
    entryYear: 2024,
    requiresAcademicProfile: false,
  });
});

test("administrador autoriza convidado externo e revogação encerra seu acesso", async ({
  page,
  browser,
}, info) => {
  await login(page, "Selecionar conta de administrador");
  await page
    .getByRole("button", { name: "Administrar usuários", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Convidados externos" });
  const email = `guest-${info.project.name}@gmail.com`;
  await panel.getByLabel("E-mail Google do convidado").fill(email);
  await panel
    .getByRole("button", { name: "Autorizar convidado", exact: true })
    .click();
  await expect(
    panel.getByText(`Acesso de convidado autorizado para ${email}.`),
  ).toBeVisible();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await login(guest, `Selecionar convidado ${info.project.name}`);
    await expect(
      guest.getByRole("heading", { name: "Olá, Pessoa." }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Complete seu cadastro" }),
    ).toHaveCount(0);
    const me = (await (await guest.request.get(`${origin}/api/auth/me`)).json())
      .data;
    expect(me).toMatchObject({
      guest: true,
      requiresAcademicProfile: false,
      role: "ALUNO",
    });
    expect(
      (
        await guest.request.post(`${origin}/api/admin/guests`, {
          headers: csrf,
          data: { email: "outro@gmail.com" },
        })
      ).status(),
    ).toBe(403);
    await panel
      .getByRole("button", { name: `Revogar acesso de ${email}` })
      .click();
    await panel.getByRole("button", { name: "Confirmar revogação" }).click();
    await expect(
      panel.getByText("Acesso de convidado revogado."),
    ).toBeVisible();
    expect((await guest.request.get(`${origin}/api/auth/me`)).status()).toBe(
      401,
    );
    await login(guest, `Selecionar convidado ${info.project.name}`);
    await expect(guest.getByRole("alert")).toContainText("Use seu e-mail USP");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.screenshot({ path: info.outputPath("convidados.png") });
  } finally {
    await guestContext.close();
  }
});
