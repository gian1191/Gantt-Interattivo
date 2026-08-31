# Pianificatore di progetto — istruzioni per Claude Code

Applicazione a file singolo per pianificazione predittiva PMI: importa i
frammenti prodotti da un modello linguistico, calcola percorso critico e float,
disegna reticolo PDM e Gantt.

## Regole non negoziabili

Prima di modificare qualsiasi cosa, leggi `docs/specifica-applicazione.md`.
Queste sono le regole che il codice deve continuare a rispettare:

1. **File singolo, nessuna dipendenza esterna.** Niente npm, niente CDN, niente
   framework *dentro l'applicazione*. `pianificatore.html` deve aprirsi con
   doppio clic su una macchina senza rete e senza installazioni. Se una libreria
   sembra necessaria, quasi sempre non lo è. L'unica eccezione vive fuori
   dall'applicazione: `package.json` porta Playwright per i test grafici, che
   aprono l'HTML ma non ne fanno parte. Nulla di cio' che sta in `node_modules`
   puo' finire dentro `pianificatore.html`.
2. **Nessuna chiamata di rete.** L'applicazione non contiene chiavi e non manda
   nulla da nessuna parte. È un requisito di contesto, non una preferenza.
3. **Il modello non produce mai date né valori calcolati.** ES, EF, LS, LF,
   float, percorso critico e deviazione standard li calcola solo il codice. Il
   validatore rimuove i campi vietati con un avviso: non accettarli mai in
   silenzio e non ampliare mai ciò che il frammento può dichiarare.
4. **La disponibilità dei contributori vive solo nella configurazione.** Un
   vincolo esterno dichiara il contributore, mai il giorno. Se ti viene chiesto
   di metterla nel frammento, è la richiesta a essere sbagliata.
5. **Niente `localStorage` come unica fonte di verità.** Lo stato vive in
   memoria; lo storage è solo persistenza opportunistica con fallback. L'HTML
   esportato porta lo stato in `window.__SEED__` e deve aprirsi su una macchina
   dove non c'è nulla di salvato.
6. **L'archivio conserva i frammenti originali.** `state.fragments[n]` è una
   copia profonda approvata: non va mai rigenerato dallo stato corrente, o si
   perde la possibilità di confrontare ciò che il modello propose con ciò che il
   piano è diventato.
7. **Le riserve non stanno dentro le durate.** Sono attività a sé, generate solo
   dall'applicazione, in serie prima della milestone protetta.
8. **I filtri attivi si dichiarano sempre**, a schermo e in ogni esportazione.

## Struttura

```
pianificatore.html          l'applicazione, file unico
docs/                       specifica, guida per il modello, prompt operativi
esempi/passo-*.json         piano dimostrativo nei quattro frammenti
tests/                      suite in Node, nessuna dipendenza
```

Dentro `pianificatore.html`, in ordine:

| Blocco | Cosa contiene |
|---|---|
| `<style>` | design token, tema chiaro e scuro |
| `CPM CORE START/END` | calendario, topologia, forward e backward pass, float, Monte Carlo |
| `LAYOUT CORE START/END` | ranghi, baricentro, coordinate, percorsi delle frecce |
| STATO | `state`, cronologia, persistenza |
| PARSER | estrazione tollerante del JSON |
| VALIDATORI | uno per passaggio, con errori bloccanti e avvisi |
| FILTRI / RETICOLO / GANTT | rese delle viste |
| MODIFICA / MODALI / RISERVE | interazione |
| ESPORTAZIONI | JSON, HTML, SVG, relazione leggibile |
| AZIONI / AVVIO | cablaggio |

I due blocchi `CORE` vengono estratti in `tests/cpm.js` e `tests/layout.js` da
`sincronizza-core.sh`, così sono eseguibili da riga di comando senza introdurre
una fase di build nel progetto. Quei due file sono generati: non modificarli.

## Test

```bash
./sincronizza-core.sh     # riallinea i moduli e lancia tutta la suite
```

Lo script estrae i blocchi `CORE` dall'HTML in `tests/cpm.js` e
`tests/layout.js`, poi esegue le quattro suite. **Eseguilo dopo ogni modifica ai
blocchi CORE**: quei due file sono generati, non si modificano a mano.

235 verifiche, nessuna dipendenza. `test_app.js` e `test_e2e.js` caricano lo
script direttamente dall'HTML in una `vm` con un DOM finto, quindi testano il
codice che gira davvero, non una copia.

Le costanti dichiarate con `const` al livello superiore non finiscono
sull'oggetto contesto: vanno recuperate con `vm.runInContext('({ ... })')`.
Se aggiungi una costante da testare, aggiungila a quella riga.

### Test grafici

```bash
npm ci && npx playwright install chromium
npm test
```

`tests/e2e/` contiene la suite Playwright: apre `pianificatore.html` via
`file://`, come farebbe chi la usa con un doppio clic, quindi non serve alcun
server. Sta in una sottocartella per non mescolarsi con la suite Node, che
`playwright test` non deve raccogliere.

**Aggiungi un test prima di correggere un difetto.** Tre bug veri sono emersi
così: i campi vietati che non venivano rimossi da `project`, l'archivio che
seguiva le modifiche manuali, e la riserva che restava in parallelo senza
proteggere nulla.

## Cosa manca

In ordine di utilità:

1. **Verifica grafica.** Avviata: `tests/e2e/` apre l'applicazione in Chromium
   e verifica avvio senza errori e import del primo passaggio. Manca il resto:
   importare tutti e quattro gli esempi, catturare reticolo e Gantt alle tre
   scale, a 380px e a 1440px, in tema chiaro e scuro. Cercare nodi sovrapposti,
   frecce che attraversano le scatole, colonne che debordano.
2. **Esportazione PDF.** Oggi c'è solo SVG del reticolo. Serve `@media print`
   con impaginazione e riduzione di scala: mai ritaglio silenzioso.
3. **Esportazione immagine del Gantt.** Il reticolo esporta SVG, il Gantt no.
4. **Baseline.** `state.baseline` esiste e `setEditMode` la rispetta, ma manca
   il comando che la congela e il confronto con la revisione corrente.
5. **Compressione.** La specifica la descrive: proporre i legami discrezionali
   sul percorso critico per il fast-tracking e le attività critiche per il
   crashing, mostrando l'effetto senza applicare nulla da soli.
6. **Import parziale** per le risposte troncate, da fondere in due tranche.
7. **Work package iterativi**, estensione prevista nella specifica.

## Convenzioni

Interfaccia e commenti in italiano; nomi di variabili e funzioni in inglese.

I messaggi d'errore dicono cosa non va e dove, con identificatore e campo, così
da poter essere rimandati al modello come correzione puntuale. Non si scusano e
non sono vaghi.

Le conferme si chiedono solo per ciò che è distruttivo o irreversibile: uscire
dalla baseline, invalidare passaggi a valle, sovrascrivere modifiche manuali,
ripristinare. Una conferma che compare sempre diventa un riflesso e smette di
essere letta proprio quando serve.

Cambiare scala o filtro **non** incrementa la revisione: è visualizzazione, non
modifica del piano.
