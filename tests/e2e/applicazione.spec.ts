import { expect, test } from '@playwright/test';

import { frammento, indirizzo } from './aiuto';

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

    await page.goto(indirizzo);

    await expect(page).toHaveTitle('Pianificazione di progetto');
    await expect(page.locator('#stepTitle')).not.toBeEmpty();
    expect(errori).toEqual([]);
  });

  test('importa il passaggio 1 e abilita l\'approvazione', async ({ page }) => {
    await page.goto(indirizzo);

    await page.locator('#pasteBox').fill(frammento('passo-1-wbs.json'));
    await page.locator('#btnCheck').click();

    await expect(page.locator('#btnApprove')).toBeEnabled();
    await expect(page.locator('#diag')).toContainText(/./);
  });
});
