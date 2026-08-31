import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Page } from '@playwright/test';

// I test del progetto sono CommonJS (package.json senza "type"), quindi
// __dirname e' disponibile e non serve import.meta.
export const radice = resolve(__dirname, '../..');

/** L'applicazione si apre via file://, come farebbe chi ci fa doppio clic. */
export const indirizzo = pathToFileURL(resolve(radice, 'pianificatore.html')).href;

export const frammento = (nome: string) =>
  readFileSync(resolve(radice, 'esempi', nome), 'utf8');

export const passaggi = [
  'passo-1-wbs.json',
  'passo-2-attivita.json',
  'passo-3-sequenza.json',
  'passo-4-stime.json',
] as const;

/**
 * Data di avvio fissa: senza, l'applicazione parte da oggi e la larghezza del
 * Gantt cambierebbe a ogni esecuzione.
 */
export const AVVIO = '2026-01-05';

/** Importa e approva i quattro frammenti, poi fissa la data di avvio. */
export async function caricaPianoCompleto(page: Page) {
  await page.goto(indirizzo);

  for (const passo of passaggi) {
    await page.locator('#pasteBox').fill(frammento(passo));
    await page.locator('#btnCheck').click();
    await page.locator('#btnApprove').click();
  }

  await page.locator('#btnConfig').click();
  await page.locator('#cfgStart').fill(AVVIO);
  await page.locator('#btnSaveCfg').click();
}

/** Le quattro combinazioni chieste dal CLAUDE.md: due larghezze, due temi. */
export const combinazioni = [
  { larghezza: 380, tema: 'light' },
  { larghezza: 380, tema: 'dark' },
  { larghezza: 1440, tema: 'light' },
  { larghezza: 1440, tema: 'dark' },
] as const;
