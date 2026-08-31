import { expect, test } from '@playwright/test';

import { caricaPianoCompleto, combinazioni } from './aiuto';

const SCALE = [
  { chiave: 'day', etichetta: 'Giorni' },
  { chiave: 'week', etichetta: 'Settimane' },
  { chiave: 'month', etichetta: 'Mesi' },
] as const;

/**
 * Verifica grafica del Gantt alle tre scale: le colonne possono essere piu'
 * larghe della finestra, ma devono scorrere dentro il proprio contenitore
 * senza trascinarsi dietro la pagina.
 */
for (const { larghezza, tema } of combinazioni) {
  test.describe(`Gantt a ${larghezza}px, tema ${tema}`, () => {
    test.use({ viewport: { width: larghezza, height: 900 }, colorScheme: tema });

    test.beforeEach(async ({ page }) => {
      await caricaPianoCompleto(page);
      await page.locator('#navGantt').click();
      await expect(page.locator('#ganttCanvas .gantt')).toBeVisible();
    });

    for (const { chiave, etichetta } of SCALE) {
      test(`scala ${etichetta}: le colonne restano nel contenitore`, async ({ page }, info) => {
        await page.locator(`#scaleSeg button[data-scale="${chiave}"]`).click();
        await expect(page.locator(`#scaleSeg button[data-scale="${chiave}"]`))
          .toHaveAttribute('aria-pressed', 'true');

        const misure = await page.evaluate(() => {
          const wrap = document.querySelector('#scrGantt .canvas-wrap');
          return {
            sbordoPagina:
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
            scorrimentoContenitore: wrap ? wrap.scrollWidth - wrap.clientWidth : -1,
          };
        });

        // La pagina non si allarga mai: se il Gantt e' piu' largo, scorre da solo.
        expect(misure.sbordoPagina).toBe(0);
        expect(misure.scorrimentoContenitore).toBeGreaterThanOrEqual(0);

        await info.attach(`gantt-${chiave}-${larghezza}-${tema}`, {
          body: await page.locator('#scrGantt').screenshot(),
          contentType: 'image/png',
        });
      });
    }

    test('mostra le date calcolate e il float minimo', async ({ page }) => {
      await expect(page.locator('#ganttKpi')).toContainText('fine calcolata');
      await expect(page.locator('#ganttKpi')).toContainText('float minimo');
      await expect(page.locator('#ganttKpi')).toContainText('giorni lavorativi');
    });

    test('ogni attivita del piano ha la sua riga', async ({ page }) => {
      // 14 elementi del piano, piu' le intestazioni di work package.
      const righe = page.locator('#ganttCanvas .glabel:not(.group)');
      await expect(righe).toHaveCount(14);
    });
  });
}
