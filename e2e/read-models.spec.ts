import { test, expect } from '@playwright/test';
test('resultado próprio exige sessão e informa provedor pendente', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail institucional').fill('aluno@labrary.local');
  await page.getByLabel('Senha', { exact: true }).fill('Labrary@2026');
  await page.getByRole('button', { name: 'Entrar no meu espaço' }).click();
  await page.getByRole('link', { name: 'Monitor de consumo energético', exact: true }).click();
  const result = page.getByRole('region', { name: 'Resultado do grupo' });
  await expect(result.getByRole('alert')).toContainText('Consolidação indisponível');
  await result.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(result.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await page.request.get('/api/projects/1/result')).status()).toBe(404);
});
