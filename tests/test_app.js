const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/../pianificatore.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* stub minimo del DOM: ogni elemento accetta tutto senza fare nulla */
function stubEl() {
  const el = {
    value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, style: {},
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelectorAll: () => [], appendChild() {}, cloneNode() { return stubEl(); },
    querySelector: () => stubEl()
  };
  return el;
}
const els = {};
const documentStub = {
  getElementById(id) { return els[id] || (els[id] = stubEl()); },
  querySelectorAll() { return []; }
};

const sandbox = {
  document: documentStub,
  window: { scrollTo() {}, addEventListener() {} },
  Blob: function(){}, URL: { createObjectURL(){return 'x';}, revokeObjectURL(){} },
  navigator: { clipboard: { writeText: async () => {} } },
  localStorage: {
    _d: {},
    getItem(k) { return this._d[k] || null; },
    setItem(k, v) { this._d[k] = v; }
  },
  setTimeout() {},
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
/* le dichiarazioni const non finiscono sull'oggetto contesto: le recupero a mano */
Object.assign(sandbox, vm.runInContext(
  '({ state, STORAGE_KEY, VALIDATORS, FORBIDDEN_FIELDS, history, SCALE })', sandbox));

let pass = 0, fail = 0;
function eq(a, e, label) {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (ok) pass++;
  else { fail++; console.log('  FAIL ' + label + ' -> atteso ' + JSON.stringify(e) +
    ', ottenuto ' + JSON.stringify(a)); }
}
function section(t) { console.log('\n' + t); }
const S = sandbox;

/* ---------------------------------------------------------- */
section('1. Parser tollerante');

eq(S.extractJSON('ecco il risultato:\n```json\n{"a":1}\n```\nfammi sapere').value,
   { a: 1 }, 'estrae da preambolo e code fence');

eq(S.extractJSON('{"testo":"contiene } una graffa","b":2}').value,
   { testo: 'contiene } una graffa', b: 2 }, 'graffa dentro stringa non chiude');

eq(S.extractJSON('{"s":"virgoletta \\" interna","x":1}').value,
   { s: 'virgoletta " interna', x: 1 }, 'escape dentro stringa');

eq(typeof S.extractJSON('{"a":1').error, 'string', 'JSON troncato segnalato');
eq(S.extractJSON('nessun oggetto qui').error.includes('Non ho trovato'), true, 'nessun JSON');
eq(S.extractJSON('{"a":}').error.includes('non è valido'), true, 'JSON malformato');

/* ---------------------------------------------------------- */
section('2. Validazione step 1 — WBS');

const wbsOK = {
  methodology: 'predittivo', step: 1,
  project: { name: 'Prova' },
  wbs: [
    { code: '1', name: 'Progetto', parent: null },
    { code: '1.1', name: 'Analisi', parent: '1' },
    { code: '1.1.1', name: 'Requisiti', parent: '1.1', type: 'workPackage' },
    { code: '1.2', name: 'Sviluppo', parent: '1', type: 'workPackage' }
  ],
  openQuestions: []
};
let r = S.validateStep1(wbsOK);
eq(r.errors, [], 'WBS valida');

r = S.validateStep1(Object.assign({}, wbsOK, { step: 2 }));
eq(r.errors.some(e => e.includes('step')), true, 'step sbagliato bloccato');

r = S.validateStep1(Object.assign({}, wbsOK, {
  wbs: wbsOK.wbs.concat([{ code: '1.1', name: 'Doppione', parent: '1' }]) }));
eq(r.errors.some(e => e.includes('duplicato')), true, 'codice duplicato');

r = S.validateStep1(Object.assign({}, wbsOK, {
  wbs: [{ code: '1', name: 'A', parent: null }, { code: '2', name: 'B', parent: null }] }));
eq(r.errors.some(e => e.includes('Radici multiple')), true, 'radici multiple');

r = S.validateStep1(Object.assign({}, wbsOK, {
  wbs: wbsOK.wbs.concat([{ code: '9.1', name: 'Orfano', parent: '9' }]) }));
eq(r.errors.some(e => e.includes('non esiste')), true, 'ramo orfano');

// campo vietato: avviso, non blocco
r = S.validateStep1(Object.assign({}, wbsOK, {
  project: { name: 'Prova', start: '2026-09-01' } }));
eq(r.errors, [], 'campo vietato non blocca');
eq(r.warnings.some(w => w.includes('Campo vietato')), true, 'campo vietato segnalato');
eq(JSON.stringify(r.data).includes('2026-09-01'), false, 'campo vietato rimosso dai dati');

// data in testo libero
r = S.validateStep1(Object.assign({}, wbsOK, {
  project: { name: 'Prova', notes: 'consegna entro il 2027-03-01' } }));
eq(r.warnings.some(w => w.includes('testo libero')), true, 'data in prosa segnalata');

S.state.project = wbsOK.project;
S.state.wbs = wbsOK.wbs;

/* ---------------------------------------------------------- */
section('3. Validazione step 2 — Attività');

const tasksOK = {
  methodology: 'predittivo', step: 2,
  contributors: [{ id: 'CORE', label: 'Core Banking' }],
  tasks: [
    { id: 'START', name: 'Avvio', type: 'milestone', wbsId: '1', owner: 'GT' },
    { id: 'A1', name: 'Raccolta requisiti', type: 'activity', wbsId: '1.1.1',
      owner: 'GT', completionCriteria: 'Verbale firmato' },
    { id: 'A2', name: 'Sviluppo', type: 'activity', wbsId: '1.2',
      owner: 'GT', completionCriteria: 'Codice in test' },
    { id: 'X1', name: 'API Core disponibili', type: 'externalConstraint',
      wbsId: '1.2', contributor: 'CORE' },
    { id: 'END', name: 'Chiusura', type: 'milestone', wbsId: '1', owner: 'GT' }
  ],
  openQuestions: []
};
r = S.validateStep2(tasksOK);
eq(r.errors, [], 'attività valide');

r = S.validateStep2(Object.assign({}, tasksOK, {
  tasks: tasksOK.tasks.map(t => t.id === 'A1' ? Object.assign({}, t, { wbsId: '1.1' }) : t) }));
eq(r.errors.some(e => e.includes('foglia')), true, 'aggancio a nodo non foglia bloccato');

r = S.validateStep2(Object.assign({}, tasksOK, {
  tasks: tasksOK.tasks.filter(t => t.id !== 'END') }));
eq(r.errors.some(e => e.includes('END')), true, 'END mancante');

r = S.validateStep2(Object.assign({}, tasksOK, {
  tasks: tasksOK.tasks.map(t => t.id === 'A1'
    ? { id: 'A1', name: 'X', type: 'activity', wbsId: '1.1.1', owner: 'GT' } : t) }));
eq(r.errors.some(e => e.includes('criterio di completamento')), true, 'criterio mancante');

r = S.validateStep2(Object.assign({}, tasksOK, { contributors: [] }));
eq(r.errors.some(e => e.includes('non dichiarato')), true, 'contributore non dichiarato');

// work package senza attività -> avviso
const wbsPiu = wbsOK.wbs.concat([{ code: '1.3', name: 'Collaudo', parent: '1', type: 'workPackage' }]);
S.state.wbs = wbsPiu;
r = S.validateStep2(tasksOK);
eq(r.errors, [], 'nessun errore');
eq(r.warnings.some(w => w.includes('non ha attività')), true, 'work package vuoto segnalato');
S.state.wbs = wbsOK.wbs;

S.state.tasks = tasksOK.tasks;
S.state.contributors = tasksOK.contributors;

/* ---------------------------------------------------------- */
section('4. Validazione step 3 — Sequenza');

const linksOK = {
  methodology: 'predittivo', step: 3,
  links: [
    { from: 'START', to: 'A1', type: 'FS', lag: 0, nature: 'mandatory', origin: 'internal' },
    { from: 'START', to: 'X1', type: 'FS', lag: 0, nature: 'mandatory', origin: 'external' },
    { from: 'A1', to: 'A2', type: 'FS', lag: 0, nature: 'mandatory', origin: 'internal' },
    { from: 'X1', to: 'A2', type: 'FS', lag: 0, nature: 'mandatory', origin: 'external' },
    { from: 'A2', to: 'END', type: 'FS', lag: 0, nature: 'mandatory', origin: 'internal' }
  ],
  openQuestions: []
};
r = S.validateStep3(linksOK);
eq(r.errors, [], 'sequenza valida');

r = S.validateStep3(Object.assign({}, linksOK, {
  links: linksOK.links.concat([
    { from: 'A2', to: 'A1', type: 'FS', lag: 0, nature: 'mandatory', origin: 'internal' }]) }));
eq(r.errors.some(e => e.includes('circolare')), true, 'ciclo rilevato');

r = S.validateStep3(Object.assign({}, linksOK, {
  links: linksOK.links.filter(l => l.to !== 'A1') }));
eq(r.errors.some(e => e.includes('raggiungibile da START')), true, 'attività scollegata');

r = S.validateStep3(Object.assign({}, linksOK, {
  links: linksOK.links.map(l => l.to === 'A2' && l.from === 'A1'
    ? Object.assign({}, l, { nature: 'discretionary' }) : l) }));
eq(r.errors, [], 'discrezionale senza motivazione non blocca');
eq(r.warnings.some(w => w.includes('senza motivazione')), true, 'motivazione mancante segnalata');

r = S.validateStep3(Object.assign({}, linksOK, {
  links: linksOK.links.map(l => Object.assign({}, l, { nature: 'obbligatorio' })) }));
eq(r.errors.some(e => e.includes('nature')), true, 'nature non valida');

S.state.links = linksOK.links;

/* ---------------------------------------------------------- */
section('5. Validazione step 4 — Stime');

const estOK = {
  methodology: 'predittivo', step: 4,
  estimates: [
    { id: 'A1', duration: 15, technique: 'three-point', optimistic: 10,
      mostLikely: 14, pessimistic: 26, basis: 'workshop', confidence: 'medium',
      sourceDoc: 'Scope' },
    { id: 'A2', duration: 20, technique: 'analogous', basis: 'storico',
      confidence: 'high', sourceDoc: 'Storico' }
  ],
  openQuestions: []
};
r = S.validateStep4(estOK);
eq(r.errors, [], 'stime valide');

r = S.validateStep4(Object.assign({}, estOK, {
  estimates: estOK.estimates.filter(e => e.id !== 'A2') }));
eq(r.errors.some(e => e.includes('senza stima')), true, 'attività non stimata');

r = S.validateStep4(Object.assign({}, estOK, {
  estimates: estOK.estimates.concat([{ id: 'X1', duration: 3, technique: 'expert',
    basis: 'x', confidence: 'high', sourceDoc: 'x' }]) }));
eq(r.errors.some(e => e.includes('durata zero')), true, 'stima su vincolo esterno bloccata');

r = S.validateStep4(Object.assign({}, estOK, {
  estimates: [Object.assign({}, estOK.estimates[0], { optimistic: 20, mostLikely: 14 }),
              estOK.estimates[1]] }));
eq(r.errors.some(e => e.includes('ottimistico')), true, 'tre punti fuori ordine');

// divergenza PERT: avviso, non blocco. (10 + 56 + 26)/6 = 15.33 -> 15
r = S.validateStep4(Object.assign({}, estOK, {
  estimates: [Object.assign({}, estOK.estimates[0], { duration: 25 }), estOK.estimates[1]] }));
eq(r.errors, [], 'divergenza PERT non blocca');
eq(r.warnings.some(w => w.includes('PERT')), true, 'divergenza PERT segnalata');

S.state.estimates = estOK.estimates;

/* ---------------------------------------------------------- */
section('6. Calcolo end-to-end sul piano montato');

S.state.config.start = '2026-09-07';   // lunedi
S.state.config.holidays = [];
S.state.config.availability = { CORE: '' };

let plan = S.buildPlanForCPM();
let c = S.computeCPM(plan, S.cpmOptions());
eq(c.ok, true, 'calcolo riuscito');
eq(c.ES.A1, 0, 'A1 parte subito');
eq(c.EF.A1, 15, 'A1 finisce a 15');
eq(c.ES.A2, 15, 'A2 dopo A1');
eq(c.calculatedEndDay, 35, 'fine a 35 giorni lavorativi');

// con vincolo esterno al 2026-12-01 il piano slitta
S.state.config.availability = { CORE: '2026-12-01' };
plan = S.buildPlanForCPM();
const cal = S.makeCalendar('2026-09-07', []);
const idx = cal.indexOfDate('2026-12-01');
c = S.computeCPM(plan, S.cpmOptions());
eq(c.ES.X1, idx, 'vincolo esterno applicato (giorno ' + idx + ')');
eq(c.ES.A2, idx, 'A2 attende il vincolo');
eq(c.calculatedEndDay, idx + 20, 'fine guidata dal vincolo');
eq(c.critical.A1, false, 'A1 non è più critica');
eq(c.TF.A1 > 0, true, 'A1 ha float (' + c.TF.A1 + ')');

// data imposta anteriore: float negativo
S.state.config.imposedEnd = '2026-12-15';
c = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(c.minTotalFloat < 0, true, 'float negativo (' + c.minTotalFloat + ')');
eq(c.hypercritical.A2, true, 'A2 ipercritica');
S.state.config.imposedEnd = '';

/* ---------------------------------------------------------- */
section('7. Costruzione delle richieste');

const p1 = S.buildPrompt(1);
eq(p1.includes('WBS orientata ai deliverable'), true, 'richiesta step 1');
eq(p1.includes('{'), false, 'step 1 non incorpora dati');

const p3 = S.buildPrompt(3);
eq(p3.includes('"A1"'), true, 'step 3 incorpora le attività approvate');
eq(p3.includes('legami di precedenza'), true, 'step 3 chiede la sequenza');

const p4 = S.buildPrompt(4);
eq(p4.includes('"links"'), true, 'step 4 incorpora la sequenza');
eq(p4.includes('nessun margine prudenziale'), true, 'step 4 vieta i margini nascosti');

/* ---------------------------------------------------------- */
section('8. Stato dei passaggi');

S.state.approved = {};
eq(S.currentStep(), 1, 'si parte dal passaggio 1');
S.state.approved[1] = { at: 'x' };
eq(S.currentStep(), 2, 'avanza al 2');
S.state.approved[2] = { at: 'x' }; S.state.approved[3] = { at: 'x' };
S.state.approved[4] = { at: 'x' };
eq(S.currentStep(), 5, 'piano completo');


/* ---------------------------------------------------------- */
section('9. Riserve, filtri e attivita complessive');

S.state.approved = { 1:{at:'x',revision:0}, 2:{at:'x',revision:1},
                     3:{at:'x',revision:2}, 4:{at:'x',revision:3} };
const deep = o => JSON.parse(JSON.stringify(o));
S.state.fragments = { 1: deep(wbsOK), 2: deep(tasksOK), 3: deep(linksOK), 4: deep(estOK) };
S.state.openQuestions = { 1: [], 2: [], 3: [], 4: ['Il collaudo è nel perimetro?'] };
S.state.manual = {}; S.state.buffers = [];
S.state.config.availability = { CORE: '' };
S.state.config.imposedEnd = '';

eq(S.allTasks().length, 5, 'nessuna riserva: cinque elementi');
S.state.buffers = [{ id:'BUF1', name:'Riserva prima di END', duration:5,
                     rationale:'scarto P80', after:'A2', before:'END' }];
eq(S.allTasks().length, 6, 'la riserva compare fra le attività');
eq(S.allLinks().length, linksOK.links.length + 1,
   'la riserva aggiunge due legami e ne sospende uno');
eq(S.allLinks().some(l => l.from === 'A2' && l.to === 'END' && !l.isBuffer), false,
   'il legame diretto scavalcato viene sospeso: la riserva sta in serie');

// la riserva e' un percorso parallelo: non allunga da sola il progetto
let c2 = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(c2.ok, true, 'piano con riserva calcolabile');
S.state.buffers = [];

/* filtri */
c2 = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
S.state.view = { scale:'week', netFilter:'all', ganttFilter:'all', owner:'' };
eq(S.visibleIds(c2,'net').size, 5, 'filtro assente: tutto visibile');

S.state.view.netFilter = 'crit';
let vis = S.visibleIds(c2,'net');
eq(vis.has('START') && vis.has('END'), true, 'START ed END sempre visibili');
eq([...vis].every(id => id==='START'||id==='END'||c2.critical[id]||c2.hypercritical[id]),
   true, 'solo elementi critici');

S.state.view.ganttFilter = 'ms';
vis = S.visibleIds(c2,'gantt');
eq(vis.has('A1'), false, 'filtro milestone esclude le attività');
eq(vis.has('X1'), true, 'i vincoli esterni restano');

S.state.view.ganttFilter = 'all';
S.state.view.owner = 'GT';
eq(S.visibleIds(c2,'gantt').has('X1'), false, 'filtro responsabile esclude i vincoli senza owner');
S.state.view.owner = '';
S.state.view.netFilter = 'all';

eq(S.activeFilterLabel('net'), '', 'nessun filtro: etichetta vuota');
S.state.view.netFilter = 'critnear';
eq(S.activeFilterLabel('net').includes('quasi critico'), true, 'etichetta del filtro');
S.state.view.netFilter = 'all';

/* ---------------------------------------------------------- */
section('10. Scale temporali del Gantt');

const cal2 = S.makeCalendar('2026-09-07', []);   // lunedi
let ticks = S.ganttTicks(cal2, 9, 'day');
eq(ticks.length, 10, 'dieci tacche giornaliere');
eq(ticks[0].x, 0, 'prima tacca a zero');

ticks = S.ganttTicks(cal2, 9, 'week');
eq(ticks.length, 2, 'due settimane per dieci giorni lavorativi');
eq(ticks[0].w, 5 * S.SCALE.week.px, 'prima settimana piena');
eq(ticks[1].x, 5 * S.SCALE.week.px, 'seconda settimana attaccata');

// avvio di mercoledi: la prima settimana e' parziale
const cal3 = S.makeCalendar('2026-09-09', []);
ticks = S.ganttTicks(cal3, 9, 'week');
eq(ticks[0].w, 3 * S.SCALE.week.px, 'settimana parziale se si parte a meta');

ticks = S.ganttTicks(cal2, 60, 'month');
eq(ticks.length >= 3, true, 'almeno tre mesi su 61 giorni lavorativi');
eq(ticks.every(t => t.w > 0), true, 'nessuna colonna a larghezza nulla');
const somma = ticks.reduce((a,t) => a + t.w, 0);
eq(somma, 61 * S.SCALE.month.px, 'le colonne mensili coprono esattamente il periodo');

/* ---------------------------------------------------------- */
section('11. Cronologia');

S.history.past.length = 0; S.history.future.length = 0;
const durPrima = S.state.estimates[0].duration;
S.pushHistory();
S.state.estimates[0].duration = 99;
eq(S.history.past.length, 1, 'istantanea registrata');
S.undo();
eq(S.state.estimates[0].duration, durPrima, 'annulla ripristina la durata');
eq(S.history.future.length, 1, 'il futuro si popola');
S.redo();
eq(S.state.estimates[0].duration, 99, 'ripristina riapplica');
S.undo();

/* ---------------------------------------------------------- */
section('12. Relazione leggibile');

const r1 = S.readableStep(1);
eq(r1.includes('1.1.1'), true, 'la WBS compare con i codici');
eq(r1.includes('work package'), true, 'il tipo di elemento è indicato');
eq(r1.includes('{'), false, 'nessun JSON nella versione leggibile');

const r2 = S.readableStep(2);
eq(r2.includes('completa quando'), true, 'criterio di completamento reso in prosa');
eq(r2.includes('Verbale firmato'), true, 'contenuto del criterio presente');

const r3 = S.readableStep(3);
eq(r3.includes('non può iniziare finché non è finita'), true, 'legame FS in prosa');
eq(r3.includes('Mandatorio'), true, 'natura del legame dichiarata');

const r4 = S.readableStep(4);
eq(r4.includes('tre punti: 10 / 14 / 26'), true, 'stima a tre punti riportata');
eq(r4.includes('Il collaudo è nel perimetro?'), true, 'questioni aperte in coda');

/* il frammento archiviato resta l originale, non lo stato corrente */
S.pushHistory();
S.state.estimates[0].duration = 77;
eq(S.state.fragments[4].estimates[0].duration, 15,
   'il frammento archiviato non segue le modifiche manuali');
S.undo();

/* ---------------------------------------------------------- */
section('13. Metadati di esportazione');

const meta = S.exportMeta();
eq(meta.progetto, 'Prova', 'nome del progetto');
eq(typeof meta.revisione, 'number', 'revisione presente');
eq(meta.baseline, 'non congelata', 'stato baseline dichiarato');
S.state.view.ganttFilter = 'crit';
eq(S.exportMeta().filtri.includes('critico'), true, 'i filtri finiscono nei metadati');
S.state.view.ganttFilter = 'all';

/* ---------------------------------------------------------- */
section('14. Layout del reticolo sul piano reale');

const lay = S.layoutNetwork(S.allTasks(), S.allLinks(),
  S.topoSort(S.allTasks(), S.allLinks()).order);
eq(Object.keys(lay.nodes).length, 5, 'tutti gli elementi collocati');
eq(lay.rank.START, 0, 'START a sinistra');
eq(lay.rank.END, Math.max(...Object.values(lay.rank)), 'END a destra');
eq(lay.width > 0 && lay.height > 0, true, 'dimensioni positive');

/* ---------------------------------------------------------- */
console.log('\n----------------------------------------');
console.log(pass + ' verifiche superate, ' + fail + ' fallite');
process.exit(fail ? 1 : 0);
