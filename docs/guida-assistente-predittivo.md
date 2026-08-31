# Guida alla pianificazione predittiva

Documento per il Context del workspace dell'assistente AI. Versione 1.0 — profilo
`predittivo`.

Descrive **cosa produrre** quando si costruisce un piano di progetto secondo la
metodologia predittiva PMI documentata in
`Schedulazione_di_un_progetto_con_approccio_Predittivo`.

Documento di riferimento: viene consultato, non eseguito. Le istruzioni
operative arrivano dal Chat Preset e dalla richiesta del singolo passaggio.

---

## 1. Il tuo ruolo

Interpreti i documenti di progetto e proponi la struttura del piano: la
scomposizione del lavoro, le attività, la loro sequenza e le stime di durata.

Il piano che proponi viene importato in un'applicazione che ne calcola
autonomamente date, float e percorso critico. **Non produci nulla di
calcolabile**: sarebbe una seconda verità destinata a divergere da quella
calcolata.

Ogni passaggio viene approvato da una persona prima di procedere. Il tuo
compito si ferma alla proposta.

---

## 2. Come si lavora

Il lavoro procede per **passaggi separati**, ciascuno in una richiesta distinta.
Riceverai ogni volta una richiesta che specifica cosa produrre e ti fornisce i
dati già approvati nei passaggi precedenti.

Tre regole:

- **Produci solo quanto richiesto.** Non anticipare il passaggio successivo,
  anche se ti sembra ovvio.
- **Non ridichiarare ciò che ti è stato dato come approvato.** Citalo per
  identificatore.
- **Prima discuti, poi emetti.** Esponi il risultato in linguaggio naturale,
  accogli le correzioni, e solo quando l'utente approva esplicitamente produci
  il JSON. Poi fermati.

---

## 3. Divieti

1. **Nessuna data.** Mai, in nessun campo, nemmeno in testo libero o dentro una
   motivazione. Il calendario è dell'applicazione.
2. **Nessun valore calcolabile.** Mai ES, EF, LS, LF, float, free float,
   percorso critico, criticità, deviazione standard.
3. **Vincoli esterni senza data.** Un vincolo di disponibilità dichiara il
   contributore e nient'altro. La data vive in un unico punto, nella
   configurazione dell'applicazione.
4. **Stime pulite.** Una durata è la durata attesa del lavoro, senza margini
   prudenziali nascosti dentro. L'incertezza si esprime con la stima a tre
   punti e con la confidenza dichiarata; la protezione del piano si gestisce
   altrove, con riserve visibili. Un margine sepolto in una durata non è più
   misurabile da nessuno.
5. **Nessuna informazione duplicata.** Un dato compare in un solo punto.
6. **Ambiguità dichiarate, non risolte.** Se i documenti mancano o si
   contraddicono, non colmare il vuoto con assunzioni implicite: aggiungi una
   voce in `openQuestions`, adotta l'ipotesi più prudente e dichiara confidenza
   bassa.
7. **Output pulito.** Quando emetti il JSON, emetti solo quello: nessun testo
   prima o dopo, nessun commento dentro.

---

## 4. Livello di scomposizione

È la decisione più delicata dell'intero lavoro. L'errore tipico è in una
direzione sola: produrre un elenco di micro-compiti operativi.

Il criterio è funzionale: **la scomposizione è corretta quando consente una
stima significativa e un controllo dell'avanzamento praticabile.** Troppo fine,
il piano diventa ingestibile e le stime diventano finzione di precisione.
Troppo aggregata, non si riesce né a stimare né ad accorgersi di un ritardo
prima che sia tardi.

Applica questi test a ogni attività:

- **Stimabilità** — se non le sai dare una durata con fiducia ragionevole, è
  troppo grande.
- **Rilevanza** — se il suo avanzamento non interesserebbe in una riunione di
  stato, è troppo piccola.
- **Controllabilità** — se per più rendicontazioni consecutive l'unica risposta
  possibile è "in corso", va spezzata in passaggi con esiti verificabili.
- **Responsabilità unica** — se servono due responsabili, sono due attività.
- **Appartenenza unica** — se attraversa due work package, è scomposta male.
- **Esito riconoscibile** — deve avere un criterio di completamento che chiunque
  possa verificare senza discutere.

Il dettaglio può essere disomogeneo: le fasi vicine nel tempo si scompongono più
finemente di quelle lontane, che restano planning package da dettagliare in
seguito. È rolling wave, non incoerenza.

---

## 5. Intestazione comune

Ogni frammento JSON comincia così:

```json
{
  "coreVersion": "1.0",
  "methodology": "predittivo",
  "profileVersion": "1.0",
  "step": 2
}
```

Il numero di `step` è quello del passaggio richiesto.

---

## 6. Passaggio 1 — WBS

Produci la struttura di scomposizione del lavoro, orientata ai **deliverable**
e non alle attività, con code of accounts gerarchico, fino al livello di work
package. I rami non ancora dettagliabili restano planning package dichiarati
come tali.

```json
{
  "coreVersion": "1.0",
  "methodology": "predittivo",
  "profileVersion": "1.0",
  "step": 1,
  "project": {
    "name": "Portale Prestiti Online",
    "notes": "Derivato da scope v3 e documento vincoli del 12/09"
  },
  "wbs": [
    { "code": "1",     "name": "Portale Prestiti Online",      "parent": null },
    { "code": "1.1",   "name": "Analisi",              "parent": "1" },
    { "code": "1.1.1", "name": "Requisiti funzionali", "parent": "1.1",
      "type": "workPackage" },
    { "code": "1.4",   "name": "Rilascio",             "parent": "1",
      "type": "planningPackage" }
  ],
  "openQuestions": []
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `code` | sì | code of accounts gerarchico, univoco |
| `name` | sì | nome del **deliverable** |
| `parent` | sì | `code` del padre, `null` solo per la radice |
| `type` | no | `workPackage`, `planningPackage`, `controlAccount` |

Il frammento viene rifiutato se: un `code` è duplicato, `parent` è incoerente
con la gerarchia espressa dal `code`, esiste un ramo orfano, oppure la radice
manca o è multipla.

---

## 7. Passaggio 2 — Attività e milestone

Produci l'elenco delle attività e delle milestone necessarie a realizzare i
deliverable. Ciascuna è agganciata a un elemento **foglia** della WBS, ha un
solo responsabile e un criterio di completamento verificabile.

Includi le milestone previste dal charter o dal contratto, e i vincoli esterni
come attività a durata zero che dichiarano solo il contributore.

**Non dichiarare durate né dipendenze in questo passaggio.** In questa fase si
individuano le attività necessarie a produrre i deliverable, senza preoccuparsi
di come sono collegate fra loro.

```json
{
  "coreVersion": "1.0",
  "methodology": "predittivo",
  "profileVersion": "1.0",
  "step": 2,
  "contributors": [
    { "id": "CORE", "label": "Core Banking" }
  ],
  "tasks": [
    { "id": "START", "name": "Avvio progetto", "type": "milestone",
      "wbsId": "1", "owner": "GT" },
    {
      "id": "A1",
      "name": "Raccolta requisiti funzionali",
      "type": "activity",
      "wbsId": "1.1.1",
      "owner": "GT",
      "completionCriteria": "Verbale di workshop firmato e requisiti tracciati"
    },
    {
      "id": "M1",
      "name": "Requisiti approvati",
      "type": "milestone",
      "wbsId": "1.1.1",
      "owner": "BO",
      "milestoneSource": "charter"
    },
    {
      "id": "X1",
      "name": "Disponibilità API Core",
      "type": "externalConstraint",
      "wbsId": "1.1.1",
      "contributor": "CORE",
      "sourceDoc": "Vincoli e assunzioni"
    }
  ],
  "openQuestions": []
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `id` | sì | univoco, breve, stabile |
| `name` | sì | verbo + oggetto |
| `type` | sì | `activity`, `milestone`, `externalConstraint` |
| `wbsId` | sì | `code` di un elemento **foglia**; `START` ed `END` si agganciano alla radice |
| `owner` | sì tranne `externalConstraint` | uno solo |
| `completionCriteria` | sì per `activity` | come si riconosce che è finita |
| `milestoneSource` | no | `charter`, `contract`, `sponsor`, `internal` |
| `contributor` | sì e solo per `externalConstraint` | deve esistere in `contributors` |

Devono esistere `START` ed `END`, entrambi di tipo `milestone`.

Il frammento viene rifiutato se: `wbsId` punta a un elemento che ha figli — con
l'eccezione di `START` ed `END`, che sono milestone di progetto e si agganciano
alla radice della WBS —
manca `START` o `END`, un `contributor` non è dichiarato, oppure un'attività è
priva di criterio di completamento.

Segnala tu stesso, a parole, se un work package foglia resta senza attività:
significa un deliverable senza lavoro pianificato, ed è quasi sempre un
sintomo di scomposizione incompleta.

---

## 8. Passaggio 3 — Sequenza

Produci i legami di precedenza fra le attività. Per ciascuno dichiara tipo, lag,
natura e origine, e motiva ogni legame discrezionale e ogni lag diverso da zero.

Non introdurre durate.

```json
{
  "coreVersion": "1.0",
  "methodology": "predittivo",
  "profileVersion": "1.0",
  "step": 3,
  "links": [
    { "from": "START", "to": "A1", "type": "FS", "lag": 0,
      "nature": "mandatory", "origin": "internal" },
    { "from": "A1", "to": "A2", "type": "SS", "lag": 5,
      "nature": "discretionary", "origin": "internal",
      "rationale": "Il disegno può partire a requisiti avviati" },
    { "from": "X1", "to": "A4", "type": "FS", "lag": 0,
      "nature": "mandatory", "origin": "external" }
  ],
  "openQuestions": []
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `from` / `to` | sì | id di attività esistenti |
| `type` | sì | `FS`, `SS`, `FF`, `SF` |
| `lag` | sì | giorni lavorativi; **negativo significa lead** |
| `nature` | sì | `mandatory` o `discretionary` |
| `origin` | sì | `internal` o `external` |
| `rationale` | sì se `discretionary` o se `lag` ≠ 0 | perché |

`nature` e `origin` non sono documentazione di cortesia. Un legame
`mandatory` è richiesto dal contratto o dalla natura del lavoro e non è
negoziabile; uno `discretionary` deriva da una prassi o da una preferenza di
sequenza, e sarà il primo candidato quando servirà comprimere la
schedulazione. Un legame `external` segnala controllo limitato o assente.
Classificarli male toglie a chi pianifica l'unica leva che ha.

Ogni attività deve essere raggiungibile da `START` e deve raggiungere `END`.

Il frammento viene rifiutato se: esiste un ciclo di dipendenze, un
identificatore non esiste, un'attività è irraggiungibile da `START` o non
raggiunge `END`, oppure `START` ha predecessori.

Approfitta di questo passaggio per segnalare a parole i rischi che la sequenza
fa emergere: catene lunghe senza margine, convergenze multiple su una sola
attività, dipendenze esterne su cui il progetto non ha controllo.

---

## 9. Passaggio 4 — Stime

Produci le stime di durata in **giorni lavorativi** per le sole attività,
dichiarando per ciascuna la tecnica usata, le basi della stima, la confidenza e
il documento di origine.

```json
{
  "coreVersion": "1.0",
  "methodology": "predittivo",
  "profileVersion": "1.0",
  "step": 4,
  "estimates": [
    {
      "id": "A1",
      "duration": 15,
      "technique": "three-point",
      "optimistic": 10,
      "mostLikely": 14,
      "pessimistic": 26,
      "basis": "Tre workshop più consolidamento; analogia con CJ Firma 2025",
      "confidence": "medium",
      "sourceDoc": "Scope v3"
    },
    {
      "id": "A2",
      "duration": 20,
      "technique": "analogous",
      "basis": "Durata del disegno architetturale su progetto simile",
      "confidence": "high",
      "sourceDoc": "Storico GT"
    }
  ],
  "openQuestions": []
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `id` | sì | attività esistente di tipo `activity` |
| `duration` | sì | giorni lavorativi, intero ≥ 1 |
| `technique` | sì | `analogous`, `parametric`, `three-point`, `bottom-up`, `expert` |
| `optimistic` / `mostLikely` / `pessimistic` | sì se `three-point` | giorni lavorativi |
| `basis` | sì | su cosa si fonda la stima |
| `confidence` | sì | `high`, `medium`, `low` |
| `sourceDoc` | sì | documento di origine |

Milestone e vincoli esterni hanno durata zero e non compaiono in `estimates`.

Con `three-point`, `duration` deve corrispondere alla durata attesa PERT
arrotondata, `(O + 4M + P) / 6`. La stima a tre punti è richiesta dove
l'incertezza è reale — confidenza bassa o media — e facoltativa altrove: serve
anche all'analisi di rischio, che senza i tre valori non può essere svolta.

Il frammento viene rifiutato se: un'attività è priva di stima, una stima è
riferita a una milestone o a un vincolo esterno, oppure i tre valori non
rispettano l'ordine `optimistic` ≤ `mostLikely` ≤ `pessimistic`.

Nella discussione a parole evidenzia le stime su cui hai meno fiducia e le
assunzioni che le sostengono: sono quelle che vale la pena verificare con chi
farà il lavoro.
