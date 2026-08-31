# Pianificatore di progetto

Applicazione a file singolo per la pianificazione predittiva secondo la
metodologia PMI. Si apre con doppio clic, funziona senza rete, non manda dati da
nessuna parte.

## Come si usa

1. Apri `pianificatore.html`.
2. Dal pannello del passaggio corrente copia la richiesta e portala nell'assistente AI,
   nel workspace di progetto dove hai caricato metodologia, guida e documenti.
3. Incolla la risposta, premi **Verifica**, leggi le diagnostiche, premi
   **Approva passaggio**.
4. Ripeti per i quattro passaggi: WBS, attività, sequenza, stime.
5. Da lì in poi reticolo e Gantt sono navigabili, modificabili e ricalcolabili.

I testi da incollare nell'assistente AI, preset compreso, stanno in
`docs/prompt-da-copiare.md`.

## Per provarlo subito

I file in `esempi/` sono un piano dimostrativo già pronto. Incollali uno alla
volta nel campo della risposta, nell'ordine dei passaggi. In configurazione
imposta un avvio e, se vuoi vedere l'effetto di un vincolo esterno, una data di
disponibilità per Core Banking.

## Prima di usarlo su un progetto reale

Verifica con chi di dovere che scope e vincoli di progetto possano essere
caricati nello strumento di AI aziendale. È un vincolo di processo, non tecnico,
ma viene prima di tutto il resto.

## Documentazione

| File | A chi serve |
|---|---|
| `docs/guida-assistente-predittivo.md` | va nel Context del workspace dell'assistente AI |
| `docs/prompt-da-copiare.md` | a te: preset e richieste da incollare |
| `docs/specifica-applicazione.md` | a chi sviluppa: non caricarlo nell'assistente AI |
| `CLAUDE.md` | a Claude Code, per proseguire lo sviluppo |
