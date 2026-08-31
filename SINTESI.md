# Sintesi dei lavori

Stato del repository al 31 agosto 2026. Questo documento racconta che cosa è
stato fatto finora e che cosa resta in attesa, così da poter riprendere il
lavoro in una sessione successiva senza doverlo ricostruire.

Tutto quanto è descritto qui è già unito nel ramo `main`: l'ultima cosa a
entrarci è stata la correzione dell'instradamento dei legami lunghi, con il
commit di merge `63130bf`. Non ci sono lavori in sospeso su altri rami.

## Che cos'è questo repository

Contiene il **pianificatore di progetto**: un'applicazione a file singolo per la
pianificazione predittiva secondo la metodologia PMI. Importa i frammenti di
piano prodotti da un assistente AI, li valida, calcola il percorso critico e il
float, e disegna il reticolo PDM e il diagramma di Gantt.

Si apre con doppio clic su `pianificatore.html`. Non ha dipendenze, non richiede
installazioni e non fa chiamate di rete.

## Che cosa è stato fatto

### 1. Importazione del progetto, anonimizzata

I file arrivavano da un progetto sviluppato altrove. Prima di entrare nel
repository sono stati ripuliti dai riferimenti interni.

Nei file non c'erano indirizzi di posta, nomi di persona, indirizzi web,
matricole o percorsi locali. Gli unici elementi riconoscibili erano tre nomi
propri, sostituiti in modo coerente in tutti i file:

| Originale | Sostituito con |
|---|---|
| nome dello strumento di AI aziendale | «l'assistente AI», e la guida è diventata `docs/guida-assistente-predittivo.md` |
| nome del progetto di esempio | «Portale Prestiti Online» |
| canale digitale usato come contributore di esempio | «Canale Digitale Imprese», sigla `CANBIZ` |

Sono stati invece mantenuti, perché generici e non riconducibili a nessuno:
`Core Banking`, le sigle di responsabile `GT`, `BO` e `SEC`, e il titolo del
documento di metodologia citato dalla guida.

Il piano contenuto in `esempi/` è dimostrativo e inventato: durate, sequenza e
vincoli non corrispondono ad alcun progetto reale.

### 2. Strumentazione di test

Il repository ha ora due suite, che coprono cose diverse.

| Suite | Dove | Che cosa verifica |
|---|---|---|
| Node, senza dipendenze | `tests/test_*.js` | percorso critico, layout, validatori, flusso completo |
| Playwright | `tests/e2e/` | come l'applicazione appare davvero in un browser |

La suite Node conta **248 verifiche**, tredici delle quali aggiunte qui per
l'instradamento delle frecce; il resto era già parte del progetto. Si lancia
con `./sincronizza-core.sh`, che prima riallinea `tests/cpm.js` e
`tests/layout.js` ai blocchi `CORE` dentro l'HTML, così il codice messo alla
prova è quello che gira davvero.

La suite Playwright è nuova. Conta **39 test** e apre `pianificatore.html` con
un indirizzo `file://`, esattamente come fa chi ci clicca sopra due volte:
nessun server, nessuna configurazione.

### 3. Prima verifica grafica dell'applicazione

Fino a ora nessuno aveva mai aperto `pianificatore.html` in un browser: era il
primo punto della lista delle cose mancanti. Adesso la suite Playwright importa
tutti e quattro i frammenti di esempio e controlla il risultato in **quattro
combinazioni**: larghezza 380 pixel e 1440 pixel, tema chiaro e tema scuro.

Che cosa risulta a posto:

- l'applicazione si apre senza errori in console;
- nel reticolo nessun nodo si sovrappone a un altro;
- la pagina non sborda mai in orizzontale;
- il Gantt, alle tre scale (giorni, settimane, mesi), scorre dentro il proprio
  contenitore senza trascinarsi dietro la pagina. A 380 pixel di larghezza il
  disegno arriva a 2328 pixel e la pagina resta comunque ferma, che è il
  comportamento corretto.

Le immagini del reticolo e del Gantt vengono allegate al report: si guardano con
`npm run test:report`.

### 4. Instradamento dei legami lunghi, corretto

Era l'unico difetto vero trovato dalla verifica grafica: i legami che saltano
più di un rango correvano alla quota verticale del nodo di arrivo e tagliavano
le scatole che incontravano per strada. Sul piano di esempio due frecce
attraversavano un nodo.

La correzione sta in `LAYOUT CORE`, in tre pezzi:

- `layoutNetwork` riserva una banda libera sopra e sotto i nodi, dimensionata
  sui legami lunghi presenti. Quando i ranghi intermedi sono fitti può non
  restare alcun varco interno, e la via di fuga deve stare dentro il disegno;
- `crossedNodes` raccoglie gli ostacoli di un legame, cioè i soli nodi dei
  ranghi intermedi: partenza e arrivo non lo sono, perché la freccia ne tocca i
  bordi;
- `freeLane` sceglie la quota di traversata: il varco percorribile più vicino
  alla quota di arrivo, così la deviazione resta minima. Se quella quota è già
  libera la restituisce invariata, e il disegno non cambia.

`edgeRoute` compone il percorso e restituisce anche l'ancoraggio
dell'etichetta, che prima stava al punto medio geometrico e con una traversata
poteva finire lontano dalla freccia. `edgePath` resta come prima, riduttore al
solo tracciato.

Il test che era rimasto in `test.fixme` è ora attivo e passa. Le verifiche
Node su LAYOUT CORE sono salite da 22 a 35.

### 5. Integrazione continua

`.github/workflows/test.yml` esegue a ogni push e a ogni pull request prima la
suite Node e poi quella Playwright, e conserva il report come allegato. Entrambe
passano anche sul runner di GitHub.

## Che cosa resta in attesa

L'elenco completo, in ordine di utilità, vive in [`CLAUDE.md`](CLAUDE.md). Il
difetto che stava in cima è stato corretto; quel che resta sono estensioni
previste dalla specifica, non correzioni.

1. esportazione in PDF, oggi assente: serve `@media print` con impaginazione e
   riduzione di scala, senza mai ritagliare in silenzio;
2. esportazione dell'immagine del Gantt, che oggi solo il reticolo offre;
3. baseline: lo stato esiste, manca il comando che la congela e il confronto con
   la revisione corrente;
4. compressione del piano, cioè proporre i legami discrezionali e le attività
   critiche su cui intervenire, mostrando l'effetto senza applicare nulla da
   soli;
5. importazione parziale, per le risposte troncate da unire in due tranche;
6. work package iterativi, estensione già prevista dalla specifica.

## Come riprendere

```bash
./sincronizza-core.sh    # suite Node: 248 verifiche
npm ci                   # dipendenze di sviluppo, solo per i test grafici
npx playwright install chromium
npm test                 # suite Playwright: 39 test
npm run test:report      # report con le immagini di reticolo e Gantt
npx tsc --noEmit         # controllo dei tipi
```

Una nota importante: npm serve **soltanto** agli strumenti di verifica.
`pianificatore.html` resta senza dipendenze, e nulla di quanto sta in
`node_modules` può finirci dentro. Le regole da rispettare stanno tutte in
[`CLAUDE.md`](CLAUDE.md), da leggere prima di modificare qualsiasi cosa.
