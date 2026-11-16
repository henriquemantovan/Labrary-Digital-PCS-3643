import { test, expect } from "@playwright/test";
test("administrador gerencia perfis, preserva último admin e alterna visualização", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:5181/");
  await page.getByRole("link", { name: "Entrar com Google" }).click();
  await page
    .getByRole("link", { name: "Selecionar conta de administrador" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Olá, Administrador." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Administrar usuários" }).click();
  await expect(
    page.getByRole("combobox", {
      name: "Perfil de Marina Google",
      exact: true,
    }),
  ).toHaveValue("ALUNO");
  // Try removing the only admin before granting anyone else access.
  await page
    .getByRole("combobox", {
      name: "Perfil de Administrador Google",
      exact: true,
    })
    .selectOption("ALUNO");
  await page
    .getByRole("button", { name: "Salvar perfil de Administrador Google" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "último administrador ativo",
  );
  await page
    .getByRole("combobox", {
      name: "Perfil de Administrador Google",
      exact: true,
    })
    .selectOption("ADMIN");
  await page
    .getByRole("combobox", { name: "Perfil de Marina Google", exact: true })
    .selectOption("ADMIN");
  await page
    .getByRole("button", { name: "Salvar perfil de Marina Google" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Perfil de Marina Google atualizado para Administrador.",
  );
  // Restore the fixture role so the independent student login scenarios remain valid.
  await page
    .getByRole("combobox", { name: "Perfil de Marina Google", exact: true })
    .selectOption("ALUNO");
  await page
    .getByRole("button", { name: "Salvar perfil de Marina Google" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Perfil de Marina Google atualizado para Aluno.",
  );
  await page.getByLabel("Buscar usuários").fill("inexistente");
  await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  await page.getByLabel("Buscar usuários").fill("");
  await page.screenshot({
    path: `test-results/admin-users-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  for (const role of ["ALUNO", "AVALIADOR", "PROFESSOR"]) {
    await page.getByLabel("Visualizar como").selectOption(role);
    await expect(
      page.getByText(/Sua conta continua sendo Administrador/),
    ).toBeVisible();
    const me = await context.request.get("http://localhost:5181/api/auth/me");
    expect((await me.json()).data).toMatchObject({
      id: 40,
      role: "ADMIN",
      viewRole: role,
    });
    await expect(
      page.getByRole("button", { name: "Administrar usuários" }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(page.getByLabel("Visualizar como")).toHaveValue("PROFESSOR");
  await page.getByLabel("Visualizar como").selectOption("ADMIN");
  await expect(
    page.getByRole("button", { name: "+ Novo projeto" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("link", { name: "Entrar com Google" }),
  ).toBeVisible();
});
test("usuário comum não vê administração nem consegue se promover pela API", async ({
  page,
  context,
}) => {
  await page.goto("http://localhost:5181/");
  await page.getByRole("link", { name: "Entrar com Google" }).click();
  await page.getByRole("link", { name: "Selecionar conta de aluno" }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Marina." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Administrar usuários" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Visualizar como")).toHaveCount(0);
  expect(
    (
      await context.request.get("http://localhost:5181/api/admin/users")
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.patch(
        "http://localhost:5181/api/admin/users/30/role",
        { headers: { "X-CSRF-Protection": "1" }, data: { role: "ADMIN" } },
      )
    ).status(),
  ).toBe(403);
});
