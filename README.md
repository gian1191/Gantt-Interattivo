# Gantt-Interattivo

## Test E2E (Playwright)

I test end-to-end usano [Playwright](https://playwright.dev/) (TypeScript).

```bash
npm ci                              # installa le dipendenze
npx playwright install chromium     # scarica il browser (solo la prima volta)
npm test                            # esegue i test
npm run test:ui                     # esegue i test in modalita' interattiva
npm run test:report                 # apre l'ultimo report HTML
npm run typecheck                   # controllo dei tipi
```

I test si trovano in `tests/`, la configurazione in `playwright.config.ts`.
Imposta `BASE_URL` per puntare i test a un'istanza diversa da `http://localhost:3000`.
