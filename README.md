# Gantt Interattivo — pianificatore di progetto

Applicazione a **file singolo** per la pianificazione predittiva secondo la
metodologia PMI: importa i frammenti di piano prodotti da un assistente AI,
calcola percorso critico e float, disegna reticolo PDM e Gantt.

Si apre con doppio clic su `pianificatore.html`. Nessuna dipendenza, nessuna
installazione, nessuna chiamata di rete.

Istruzioni d'uso complete: **[LEGGIMI.md](LEGGIMI.md)**.

## Documentazione

| File | A chi serve |
|---|---|
| [`LEGGIMI.md`](LEGGIMI.md) | a chi usa l'applicazione |
| [`docs/guida-assistente-predittivo.md`](docs/guida-assistente-predittivo.md) | va nel Context del workspace dell'assistente AI |
| [`docs/prompt-da-copiare.md`](docs/prompt-da-copiare.md) | preset e richieste da incollare |
| [`docs/specifica-applicazione.md`](docs/specifica-applicazione.md) | a chi sviluppa |
| [`CLAUDE.md`](CLAUDE.md) | a Claude Code, per proseguire lo sviluppo |

I file in `esempi/` sono un piano dimostrativo di fantasia, non un progetto
reale.

## Sviluppo e test

L'applicazione resta senza dipendenze: npm serve **solo** agli strumenti di
verifica, che non finiscono dentro `pianificatore.html`.

```bash
./sincronizza-core.sh    # suite Node: riallinea i moduli CORE e lancia 235 verifiche
npm ci                   # dipendenze di sviluppo (solo per i test grafici)
npx playwright install chromium
npm test                 # suite Playwright: apre l'applicazione in un browser
npm run test:ui          # gli stessi test in modalita' interattiva
npm run test:report      # apre l'ultimo report HTML
npm run typecheck        # controllo dei tipi sui test Playwright
```

| Suite | Dove | Cosa copre |
|---|---|---|
| Node, senza dipendenze | `tests/test_*.js` | CPM, layout, validatori, flusso end to end |
| Playwright | `tests/e2e/` | resa grafica reale in Chromium |
