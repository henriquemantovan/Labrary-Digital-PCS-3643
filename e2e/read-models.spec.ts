import { test, expect } from '@playwright/test';
test('resultado próprio exige sessão e permanece bloqueado até a liberação', async ({ page, request }) => {
  expect((await request.get('/api/projects/2/result')).status()).toBe(401);
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill('aluno@labrary.local');
  await page.getByLabel('Senha', { exact: true }).fill('Labrary@2026');
  await page.getByRole('button', { name: 'Entrar no meu espaço' }).click();
  await page.getByRole('link', { name: 'Monitor de consumo energético', exact: true }).click();
  const result = page.getByRole('region', { name: 'Resultado do grupo' });
  await expect(result).toContainText('Resultado bloqueado. Aguardando liberação pelo professor.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await page.request.get('/api/projects/1/result')).status()).toBe(404);
});

test('navegação do professor mantém a largura do viewport com o link do acervo', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill('professor@labrary.local');
  await page.getByLabel('Senha', { exact: true }).fill('Labrary@2026');
  await page.getByRole('button', { name: 'Entrar no meu espaço' }).click();
  await expect(page.getByRole('button', { name: 'Minhas turmas' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole('button', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
});
