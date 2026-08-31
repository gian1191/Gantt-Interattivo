import { expect, test } from '@playwright/test';

/**
 * Smoke test: verifica che la toolchain Playwright funzioni.
 * Non dipende da un server perche' l'applicazione non esiste ancora;
 * sostituire con i test reali del Gantt quando ci sara' un'app da servire.
 */
test('la toolchain Playwright funziona', async ({ page }) => {
  await page.setContent(`
    <!doctype html>
    <html lang="it">
      <head><title>Gantt Interattivo</title></head>
      <body><h1>Gantt Interattivo</h1></body>
    </html>
  `);

  await expect(page).toHaveTitle('Gantt Interattivo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gantt Interattivo');
});
