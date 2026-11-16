import { test, expect } from "@playwright/test";
for (const role of ["aluno", "professor"]) {
  test(`Google: ${role}, retorno, perfil, recarga e logout`, async ({
    page,
    context,
  }) => {
    await page.goto("http://localhost:5181/");
    await expect(
      page.getByRole("link", { name: "Entrar com Google" }),
    ).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
    const logo = page
      .getByRole("link", { name: "Entrar com Google" })
      .locator("img");
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/google-login-${role}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "Entrar com Google" }).click();
    await expect(page).toHaveURL(/localhost:3005\/authorize/);
    await page
      .getByRole("link", { name: `Selecionar conta de ${role}` })
      .click();
    await expect(page).toHaveURL("http://localhost:5181/projetos");
    await expect(
      page.getByRole("heading", {
        name: role === "professor" ? "Olá, Helena." : "Olá, Marina.",
      }),
    ).toBeVisible();
    const me = await context.request.get("http://localhost:5181/api/auth/me");
    expect((await me.json()).data).toMatchObject({
      role: role.toUpperCase(),
      googleLinked: true,
    });
    const cookies = await context.cookies("http://localhost:5181/api/auth/me");
    const session = cookies.find((c) => c.name === "labrary_session")!;
    expect(session.httpOnly).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Meu perfil" }).click();
    await expect(page.getByText("Conta Google vinculada")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await expect(
      page.getByRole("link", { name: "Entrar com Google" }),
    ).toBeVisible();
    expect(
      (
        await context.request.get("http://localhost:5181/api/auth/me", {
          headers: { Cookie: `labrary_session=${session.value}` },
        })
      ).status(),
    ).toBe(401);
  });
}
for (const choice of ["Selecionar e-mail não verificado", "Cancelar"]) {
  test(`Google: erro recuperável em ${choice}`, async ({ page, context }) => {
    await page.goto("http://localhost:5181/");
    await page.getByRole("link", { name: "Entrar com Google" }).click();
    await page.getByRole("link", { name: choice, exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Não foi possível entrar com o Google",
    );
    await expect(
      page.getByRole("link", { name: "Entrar com Google" }),
    ).toBeVisible();
    expect(
      (await context.request.get("http://localhost:5181/api/auth/me")).status(),
    ).toBe(401);
  });
}
