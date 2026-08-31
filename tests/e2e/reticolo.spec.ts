import { expect, test } from '@playwright/test';

import { caricaPianoCompleto, combinazioni } from './aiuto';

/**
 * Verifica grafica del reticolo PDM: nodi che non si sovrappongono, frecce che
 * non attraversano le scatole, nessuno sbordamento orizzontale della pagina.
 */
for (const { larghezza, tema } of combinazioni) {
  test.describe(`reticolo a ${larghezza}px, tema ${tema}`, () => {
    test.use({ viewport: { width: larghezza, height: 900 }, colorScheme: tema });

    test.beforeEach(async ({ page }) => {
      await caricaPianoCompleto(page);
      await page.locator('#navNet').click();
      await expect(page.locator('#netCanvas .node').first()).toBeVisible();
    });

    test('disegna tutti gli elementi del piano', async ({ page }) => {
      await expect(page.locator('#netCanvas .node')).toHaveCount(14);
      await expect(page.locator('#netSub')).toContainText('14 elementi');
    });

    test('nessun nodo si sovrappone a un altro', async ({ page }) => {
      const sovrapposti = await page.evaluate(() => {
        const nodi = [...document.querySelectorAll('#netCanvas .node')].map((el) => ({
          id: el.querySelector('.title')?.textContent?.trim() ?? '?',
          r: el.getBoundingClientRect(),
        }));
        const esiti: string[] = [];
        for (let i = 0; i < nodi.length; i++) {
          for (let j = i + 1; j < nodi.length; j++) {
            const a = nodi[i].r;
            const b = nodi[j].r;
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (x > 1 && y > 1) esiti.push(`${nodi[i].id} sovrapposto a ${nodi[j].id}`);
          }
        }
        return esiti;
      });

      expect(sovrapposti).toEqual([]);
    });

    test('la pagina non sborda in orizzontale', async ({ page }) => {
      const sbordo = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sbordo).toBe(0);
    });

    test('cattura del reticolo', async ({ page }, info) => {
      await info.attach(`reticolo-${larghezza}-${tema}`, {
        body: await page.locator('#scrNet').screenshot(),
        contentType: 'image/png',
      });
    });
  });
}

/**
 * I legami che saltano piu' di un rango devono aggirare i nodi che incontrano:
 * `edgeRoute` cerca una corsia libera fra gli ostacoli dei ranghi intermedi.
 * Questo test campiona ogni freccia e pretende che nessun punto cada dentro una
 * scatola.
 */
test.describe('reticolo, instradamento dei legami lunghi', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('nessuna freccia attraversa una scatola', async ({ page }) => {
    await caricaPianoCompleto(page);
    await page.locator('#navNet').click();
    await expect(page.locator('#netCanvas .node').first()).toBeVisible();

    const attraversamenti = await page.evaluate(() => {
      const svg = document.querySelector('#netCanvas svg');
      if (!svg) return ['nessun SVG nel reticolo'];
      const origine = svg.getBoundingClientRect();
      const nodi = [...document.querySelectorAll('#netCanvas .node')].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.querySelector('.title')?.textContent?.trim() ?? '?',
          x1: r.left - origine.left,
          y1: r.top - origine.top,
          x2: r.right - origine.left,
          y2: r.bottom - origine.top,
        };
      });

      // margine di 2px: sfiorare il bordo di una scatola e' l'attacco della
      // freccia, non un attraversamento.
      const dentro = (p: DOMPoint, n: (typeof nodi)[number]) =>
        p.x > n.x1 + 2 && p.x < n.x2 - 2 && p.y > n.y1 + 2 && p.y < n.y2 - 2;

      const esiti: string[] = [];
      for (const path of svg.querySelectorAll('path[marker-end]')) {
        const lunghezza = (path as SVGPathElement).getTotalLength();
        if (!lunghezza) continue;
        const colpiti = new Set<string>();
        for (let i = 0; i <= 200; i++) {
          const punto = (path as SVGPathElement).getPointAtLength((lunghezza * i) / 200);
          for (const n of nodi) if (dentro(punto, n)) colpiti.add(n.id);
        }
        if (colpiti.size) esiti.push(`${path.getAttribute('d')} attraversa ${[...colpiti].join(', ')}`);
      }
      return esiti;
    });

    expect(attraversamenti).toEqual([]);
  });
});
