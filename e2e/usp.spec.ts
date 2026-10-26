import { test, expect } from "@playwright/test";
for (const role of ["aluno", "professor"]) {
  test(`Senha Única: ${role}, retorno, recarga e logout`, async ({
    page,
    context,
  }) => {
    await page.goto("http://localhost:5181/");
    await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: `test-results/usp-login-${role}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Entrar com Senha Única USP" })
      .click();
    await expect(page).toHaveURL(/localhost:3005\/authorize/);
    await page.getByRole("link", { name: `Autorizar ${role}` }).click();
    await expect(page).toHaveURL("http://localhost:5181/projetos");
    await expect(
      page.getByRole("heading", {
        name: role === "professor" ? "Olá, Helena." : "Olá, Marina.",
      }),
    ).toBeVisible();
    const me = await context.request.get("http://localhost:5181/api/auth/me");
    expect((await me.json()).data.role).toBe(role.toUpperCase());
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Meu perfil" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Meu perfil" }).click();
    await expect(
      page.getByText(role === "professor" ? "9999999" : "1234567", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await expect(
      page.getByRole("link", { name: "Entrar com Senha Única USP" }),
    ).toBeVisible();
    expect(
      (await context.request.get("http://localhost:5181/api/auth/me")).status(),
    ).toBe(401);
  });
}
test("Senha Única: vínculo sem acesso retorna erro e permite tentar novamente", async ({
  page,
}) => {
  await page.goto("http://localhost:5181/");
  await page.getByRole("link", { name: "Entrar com Senha Única USP" }).click();
  await page.getByRole("link", { name: "Autorizar servidor" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível entrar com a USP",
  );
  await expect(
    page.getByRole("link", { name: "Entrar com Senha Única USP" }),
  ).toBeVisible();
});
