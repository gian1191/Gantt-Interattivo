import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

// I test del progetto sono CommonJS (package.json senza "type"), quindi
// __dirname e' disponibile e non serve import.meta.
const radice = resolve(__dirname, '../..');
const applicazione = pathToFileURL(resolve(radice, 'pianificatore.html')).href;
const esempio = (nome: string) =>
  readFileSync(resolve(radice, 'esempi', nome), 'utf8');

/**
 * Verifica grafica dell'applicazione: si apre da file://, senza rete
 * e senza server, come farebbe chi la usa con un doppio clic.
 */
test.describe('pianificatore.html', () => {
  test('si apre senza errori in console', async ({ page }) => {
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errori.push(m.text());
    });

    await page.goto(applicazione);

    await expect(page).toHaveTitle('Pianificazione di progetto');
    await expect(page.locator('#stepTitle')).not.toBeEmpty();
    expect(errori).toEqual([]);
  });

  test('importa il passaggio 1 e abilita l\'approvazione', async ({ page }) => {
    await page.goto(applicazione);

    await page.locator('#pasteBox').fill(esempio('passo-1-wbs.json'));
    await page.locator('#btnCheck').click();

    await expect(page.locator('#btnApprove')).toBeEnabled();
    await expect(page.locator('#diag')).toContainText(/./);
  });
});
