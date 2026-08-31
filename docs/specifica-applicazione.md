# Specifica dell'applicazione di pianificazione

Versione 1.0. Documento di sviluppo: **non va caricato nell'assistente AI**.

Definisce cosa l'applicazione HTML deve fare. La parte rivolta al modello
linguistico — schemi dei frammenti, divieti, regole di scomposizione, prompt —
vive in `guida-assistente-predittivo.md`, che è l'unica fonte di verità per gli
schemi: questa specifica li referenzia e non li ripete.

Il documento è diviso in due: il **core** (§1–§7), indipendente dalla
metodologia, e il **profilo predittivo** (§8–§12). Un'eventuale metodologia
diversa aggiunge un profilo e una guida, senza toccare il core.

---

# CORE

## 1. Separazione delle responsabilità

**Il modello** produce ciò che richiede giudizio. **L'applicazione** produce
ciò che è calcolo. **L'utente** approva ogni passaggio.

Il criterio: se due esecuzioni sugli stessi dati possono dare risultati
diversi, la cosa sta nel modello; se devono dare lo stesso risultato, sta
nell'applicazione.

Corollario architetturale: l'applicazione non chiama alcuna API e non contiene
segreti. Funziona aperta da disco, senza rete.

## 2. Frammenti

Un piano si costruisce da una sequenza di frammenti JSON, ognuno importato,
validato, visualizzato e approvato prima del successivo.

Ogni frammento porta `coreVersion`, `methodology`, `profileVersion`, `step`. Il
validatore rifiuta un frammento con `methodology` diverso da quello del piano
in corso o con `step` fuori sequenza: è la difesa contro l'incollaggio del
frammento sbagliato, che altrimenti passerebbe in silenzio.

## 3. Import

Il parser estrae il primo oggetto JSON valido dal testo incollato, ignorando
preamboli, code e delimitatori markdown: i modelli incorniciano quasi sempre
l'output.

Deve essere possibile l'**import parziale**, in più tranche che si fondono,
per le risposte troncate dal limite di output.

Controlli comuni: intestazione coerente, step atteso, campi vietati rimossi con
segnalazione e mai accettati in silenzio, unicità degli identificatori,
integrità referenziale verso gli step congelati.

Ogni diagnostica distingue **errori bloccanti** da **avvisi** e indica
identificatore e percorso del campo, così da poter essere rimandata al modello
come correzione puntuale invece di richiedere una rigenerazione completa.

## 4. Stato e congelamento

Uno step approvato è congelato, con utente, momento e numero di revisione.

Tornare indietro invalida tutto ciò che sta a valle: l'applicazione elenca cosa
verrà perso e richiede conferma esplicita. Nessuna modifica silenziosa di uno
step congelato.

L'applicazione è il custode dello stato, non la conversazione: ogni prompt di
step porta con sé i dati approvati a monte, quindi il modello non ha bisogno di
memoria dei passaggi precedenti.

## 5. Generazione dei prompt di step

Per ogni step l'applicazione genera un prompt da usare in una **chat nuova**.
Il prompt non allega documenti e non ripete il metodo — entrambi sono nel
Context del workspace — e incorpora i dati congelati a monte.

Struttura: richiamo al Context, blocco dei dati approvati, richiesta puntuale
dello step, istruzione di discutere prima ed emettere il JSON solo dopo
approvazione.

## 6. Interfaccia

Router a hash su `<section hidden>`, nessuna libreria esterna. Uno stato unico
in memoria è la sola fonte di verità; persistenza locale con fallback in
memoria quando lo storage non è disponibile.

Tre schermi, alimentati dallo stesso stato:

- **Piano** — cresce passaggio dopo passaggio. Un pannello fornisce il prompt
  del passaggio corrente e il campo per incollare la risposta; sotto compare il
  risultato approvato, prima l'albero della WBS, poi le attività. Man mano che
  si approva, il pannello si ritira e il piano occupa lo spazio. Non è una
  "pagina di import" con quattro slot vuoti in attesa: è lo schermo di lavoro
  che si comporta secondo il punto in cui ci si trova.
- **Reticolo** — il PDM.
- **Gantt** — la schedulazione nel tempo.

Reticolo e Gantt restano **separati**: sono due letture diverse dello stesso
piano, la logica e il tempo, e affiancarle su un unico schermo le comprime
entrambe. Passare dall'una all'altra non ricarica nulla, cambia solo la vista.

La **configurazione** — data di avvio, calendario e festività, disponibilità
dei contributori, data imposta, soglie — sta in un pannello a parte,
raggiungibile da ogni schermo: non è un passaggio del processo ma un parametro
modificabile in qualsiasi momento.

Avanzamento bloccato finché lo step precedente non è approvato.

## 7. Ciclo di vita

Costruzione per step → calcolo e visualizzazione → decisioni di aggiustamento,
dove l'applicazione propone opzioni e ne mostra le conseguenze ma non applica
nulla da sola → **baseline**, che congela il piano approvato; da lì ogni
modifica richiede una motivazione, incrementa la revisione e resta confrontabile
con la baseline precedente.

Ogni decisione accettata viene registrata con la sua motivazione.

---

# PROFILO PREDITTIVO

## 8. Configurazione

Dati che il modello non produce mai e che vivono solo qui, ciascuno in un unico
punto:

- data di avvio del progetto;
- calendario lavorativo e festività;
- **disponibilità dei contributori**: la data associata a ciascun contributore
  citato dai vincoli esterni. Il vincolo dichiara il contributore, la data si
  deriva a runtime da qui. Cambiarla propaga a tutto il piano;
- data di fine imposta, facoltativa, che abilita il float negativo;
- soglia dei percorsi quasi critici;
- numero di iterazioni della simulazione.

Modificare la configurazione è sempre un'operazione puntuale: ricalcola, non
invalida.

## 9. Regole di invalidazione

| Modifica | Effetto |
|---|---|
| durata, base o confidenza di una stima | puntuale: ricalcolo |
| lag di un legame esistente | puntuale: ricalcolo |
| aggiunta o rimozione di un legame | invalida lo step 4 |
| aggiunta, rimozione o riassegnazione di un'attività | invalida gli step 3 e 4 |
| qualunque modifica alla WBS | invalida gli step 2, 3 e 4 |
| configurazione | puntuale: ricalcolo |

## 10. Sequenza e visualizzazione

| Step | Il modello produce | L'applicazione mostra |
|---|---|---|
| 1 | WBS | albero dei deliverable |
| 2 | attività e milestone | elenco per work package |
| 3 | legami di precedenza | **reticolo puro, senza durate** |
| 4 | stime di durata | CPM, float, percorso critico, Gantt |

Il reticolo dello step 3 è deliberatamente privo di durate: è il diagramma di
precedenza puro. Guardarlo prima che le durate lo trasformino in uno strumento
di calcolo è ciò che fa emergere i rami paralleli dimenticati.

**PDM.** Nodo a sei celle (`ES | Dur | EF` / nome / `LS | TF | LF`) come CSS
Grid; layout a livelli con rango topologico per la colonna, euristica del
baricentro per ridurre gli incroci, frecce ortogonali in SVG su un layer
assoluto, con etichette di tipo e lag. Allo step 3 le celle dei valori restano
vuote.

**Gantt.** Riusa l'implementazione esistente, alimentata dallo stesso stato.

## 11. Calcolo

Metodo del percorso critico secondo PMI: forward pass per ES ed EF, backward
pass per LS ed LF, total float come `LS − ES` ovvero `LF − EF`, criticità
derivata da float nullo. Tutti i tipi di legame (FS, SS, FF, SF) con lag e lead,
su calendario lavorativo.

Oltre a questo:

- **Free float**, minimo degli ES dei successori meno l'EF dell'attività.
- **Percorsi quasi critici**, con soglia configurabile, resi diversamente dal
  percorso critico.
- **Float negativo**, solo se è dichiarata una data di fine imposta anteriore
  alla fine calcolata: il backward pass parte da lì e le attività ipercritiche
  vengono segnalate.
- **Percorsi critici multipli**, senza assumerne uno solo.
- **Deviazione standard PERT** `(P − O) / 6` per le attività a tre punti, e
  deviazione del percorso critico come radice della somma delle varianze.
- **Avviso di divergenza PERT**: se `duration` non coincide con `(O + 4M + P) / 6`
  arrotondato, mostrare entrambi i valori senza correggere d'ufficio.

I vincoli esterni si modellano come Start No Earlier Than sulla data derivata
dalla disponibilità del contributore.

## 12. Analisi e decisioni

### Simulazione

Monte Carlo sulle durate, usando i tre valori delle attività stimate a tre punti
e trattando le altre come deterministiche. Nessun dato aggiuntivo: l'input è già
nello step 4.

Produce distribuzione della data di fine, percentili P50, P80 e P90, e **indice
di criticità** per attività, cioè la percentuale di simulazioni in cui
quell'attività cade sul percorso critico. È l'informazione che il CPM
deterministico non può dare: un'attività con float basso ma indice alto è più
pericolosa di una critica in un solo scenario.

Il risultato non modifica il piano: si mostra accanto alla data calcolata, non
al suo posto.

### Riserve di schedulazione

Le riserve non stanno dentro le durate — il modello ha il divieto esplicito di
inserirvi margini — ma sono **buffer dichiarati**: attività a sé, generate qui e
mai dal modello, collocate prima delle milestone contrattuali o di fine
progetto.

Ciascuna ha durata decisa dall'utente con il P80 come riferimento suggerito,
motivazione obbligatoria, resa grafica distinta dal lavoro reale e consumo
tracciato man mano che i ritardi la erodono.

Le milestone con `milestoneSource` uguale a `charter` o `contract` sono i
candidati proposti per default.

### Compressione

Se la fine calcolata non soddisfa la data desiderata, l'applicazione propone i
candidati — legami `discretionary` sul percorso critico per il fast-tracking,
attività critiche per il crashing — mostrando l'effetto di ciascuna opzione. Non
applica nulla da sola: la scelta e l'accettazione del rischio di rilavorazione o
di costo sono dell'utente.

---

## 12-bis. Modifica interattiva

Entrambe le viste sono modificabili con lo stesso meccanismo del Gantt di
riferimento: modalità modifica esplicita, ricalcolo CPM completo a ogni
cambiamento, cronologia con annulla e ripristina, contatore di revisione e
autore della modifica.

Ogni vista espone ciò che ha senso toccare da lì:

| Dove | Cosa si modifica |
|---|---|
| Reticolo | legami: aggiunta, rimozione, tipo, lag, natura, origine |
| Gantt | durate e parametri della stima |
| Entrambe | attività e milestone, che toccano tutte e due le viste |
| Pannello configurazione | avvio, festività, disponibilità, data imposta, soglie |

Una modifica ricalcola sempre l'intero piano e aggiorna **entrambe** le viste.
Non deve esistere uno stato in cui il reticolo dice una cosa e il Gantt
un'altra.

### Tracciamento delle modifiche manuali

Una modifica manuale rompe l'allineamento con il frammento approvato. Ogni
elemento toccato a mano viene marcato `origin: "manual"` con la revisione in
cui è avvenuta, e reso con un segno visibile nelle viste.

Quando si reimporta un frammento che sovrascriverebbe elementi marcati, si
elencano prima le modifiche manuali a rischio e si chiede conferma. Cancellarle
in silenzio significa perdere lavoro senza che nessuno se ne accorga.

### Conferme

Richiedono conferma esplicita, con l'elenco delle conseguenze:

- entrare in modalità modifica dopo che la baseline è stata congelata;
- ogni operazione che invalida passaggi a valle (§9), con l'elenco di cosa
  verrà perso;
- un import che sovrascrive modifiche manuali;
- l'applicazione di una compressione;
- il ripristino del piano originario.

Le modifiche puntuali reversibili con annulla non richiedono conferma: chiederla
ogni volta rende la conferma un riflesso e le toglie valore proprio dove serve.

### Ripristino

**Ripristina piano originario** riporta lo stato ai frammenti approvati, cioè
al piano come uscito dall'assistente AI, scartando tutte le modifiche manuali. È
distruttivo e non annullabile: richiede conferma con il conteggio delle
modifiche che verranno perse.

Va tenuto distinto dall'annulla, che torna indietro di un passo, e dalla
baseline, che è un punto di riferimento e non uno stato a cui tornare.

---

## 12-ter. Scala temporale ed export

### Scala del Gantt

Tre livelli di dettaglio: **giornaliera**, **settimanale**, **mensile**. La
scala cambia soltanto la resa, mai il calcolo: il CPM lavora sempre in giorni
lavorativi, e le scale aggregate raggruppano visivamente senza arrotondare le
durate.

Regole per ciascuna:

- **Giornaliera** — bande del fine settimana e festività visibili, etichette
  dei giorni.
- **Settimanale** — colonne per settimana con numero e data di inizio; le
  milestone restano posizionate sul giorno esatto, non spostate a inizio
  settimana.
- **Mensile** — colonne per mese; a questa scala i vincoli esterni e le
  milestone contrattuali restano sempre etichettati, perché sono l'unica
  informazione che a colpo d'occhio giustifica la vista.

Il cambio di scala **non incrementa la revisione**: è una preferenza di
visualizzazione, non una modifica del piano. Vale anche per il collasso e
l'espansione delle sezioni.

### Filtri

Applicabili a entrambe le viste e riflessi negli export: per work package, per
responsabile, per contributore esterno, solo percorso critico, solo critico e
quasi critico, solo milestone.

Un filtro attivo deve essere sempre visibile e dichiarato negli export: un
Gantt filtrato che sembra completo è un modo efficace per prendere una
decisione sbagliata in riunione.

### Export

| Formato | A cosa serve |
|---|---|
| HTML | condividere: file autonomo, apribile con doppio clic senza rete |
| JSON | conservare e riprendere: stato completo, reimportabile |
| Immagine | incollare in slide e documenti: la vista corrente |
| PDF | stampare e allegare: la vista corrente, impaginata |

**Perché servono sia HTML sia JSON.** L'HTML esportato congela anche
l'applicazione, non solo i dati: se in seguito il calcolo viene corretto o
esteso, i file già distribuiti restano alla versione vecchia per sempre. Il
JSON riapre il piano nell'applicazione aggiornata e ne recupera i miglioramenti.
È inoltre leggibile da altri strumenti e confrontabile fra versioni riga per
riga, cosa che due HTML non consentono.

**Vista di apertura dell'HTML.** Il file esportato si apre sullo schermo, sulla
scala, sui filtri e sullo stato di collasso in cui era al momento
dell'esportazione. È una vista **di apertura**, non un vincolo: chi riceve il
file naviga liberamente. Se un filtro è attivo, l'apertura lo dichiara in modo
evidente — un piano che si apre filtrato senza dirlo è peggio di uno che si apre
completo.

Regole comuni a tutti gli export grafici:

- **Metadati sempre presenti**: nome del progetto, revisione, autore, momento
  di generazione, scala, filtri attivi, stato baseline.
- **Nessun ritaglio silenzioso**: se la vista eccede la pagina, si impagina o si
  riduce la scala, non si taglia.
- La resa segue il tema chiaro anche quando l'interfaccia è in tema scuro.
- L'export HTML deve aprirsi correttamente su un'altra macchina e senza
  archiviazione locale, mostrando piano e metadati corretti.

---

## 12-quater. Archivio dei passaggi

I frammenti approvati restano nello stato del piano e vanno esposti in una
**cronologia consultabile**, non solo usati per il calcolo. È tracciabilità:
serve a sapere da dove viene ciò che il piano afferma.

Per ogni passaggio la cronologia mostra: numero e nome dello step, momento
dell'approvazione, utente, revisione al momento dell'approvazione, eventuali
`openQuestions` dichiarate dal modello, e l'elenco delle modifiche manuali
intervenute dopo.

Da ciascun passaggio, due download.

**Frammento JSON** — l'originale così come approvato, non rigenerato dallo
stato corrente. Serve a rifare un passaggio a valle senza ripartire da zero, e
a confrontare ciò che il modello aveva proposto con ciò che il piano è
diventato.

**Versione leggibile** — lo stesso contenuto reso in testo, per chi non deve
leggere JSON. Le rese:

| Step | Resa |
|---|---|
| 1 | albero della WBS indentato, con codice, nome e tipo di elemento |
| 2 | tabella delle attività per work package: id, nome, tipo, responsabile, criterio di completamento; contributori esterni in coda |
| 3 | elenco dei legami in prosa — "A2 non può iniziare finché A1 non è iniziata da 5 giorni" — con natura, origine e motivazione |
| 4 | tabella delle stime: attività, durata, tecnica, valori a tre punti, confidenza, basi, documento di origine |

La versione leggibile porta la stessa intestazione degli altri export — progetto,
revisione, autore, momento — ed è ciò che finisce negli allegati di un
documento di progetto. Deve essere anche esportabile in un unico documento che
raccoglie i quattro passaggi in sequenza: è, di fatto, la relazione di come il
piano è stato costruito.

---

## 13. Fuori perimetro

**Livellamento e smoothing.** Fuori per mancanza di dati, non di codice:
richiedono un modello delle risorse — persone, ore, disponibilità, carichi su
altri progetti — che qui non esiste, dove `owner` è una sigla di struttura e non
un calendario. Aggiungerlo cambierebbe la natura dello strumento: le date
smetterebbero di essere funzione del solo reticolo.

**Riserve di gestione e baseline dei costi.** Lo strumento schedula, non
gestisce il budget.

**Scenari alternativi.** Confrontare versioni diverse del piano richiede la
gestione di più piani in parallelo.

## 14. Estensione prevista

**Work package iterativi.** Impianto predittivo con una fase consegnata a
iterazioni: un work package dichiarato iterativo, con durata derivata da numero
di iterazioni per lunghezza dell'iterazione. Sta dentro questo profilo come
variante e richiede un campo in più nella guida, non un profilo separato.

## 15. Regole per aggiungere un profilo

Un profilo dichiara: identificatore e versione, sequenza degli step, schemi dei
frammenti (nella sua guida), validazioni bloccanti e avvisi, campi vietati al
modello, regole di invalidazione, e cosa l'applicazione calcola e disegna.

Vincoli:

- Un profilo **non ridefinisce il core**. Se ne ha bisogno, è il core a essere
  sbagliato.
- Un profilo **non riusa uno step di un altro profilo per analogia**: nomi
  uguali con semantiche diverse sono la via più rapida al disastro.
- **Nessuna astrazione speculativa.** Il core contiene solo ciò che è
  effettivamente comune ai profili esistenti. Se un secondo profilo rivela
  qualcosa di comune, quel qualcosa sale nel core allora, non prima.
