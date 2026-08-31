/* Percorso completo sul piano di esempio: importa i quattro frammenti,
   li valida come farebbe l'interfaccia, e verifica il piano risultante. */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'pianificatore.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function stubEl() {
  return { value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    dataset: {}, style: {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelectorAll: () => [], appendChild() {}, cloneNode() { return stubEl(); },
    querySelector: () => stubEl() };
}
const els = {};
const sandbox = {
  document: { getElementById: id => els[id] || (els[id] = stubEl()), querySelectorAll: () => [] },
  window: { scrollTo() {}, addEventListener() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  Blob: function(){}, URL: { createObjectURL(){return 'x';}, revokeObjectURL(){} },
  localStorage: { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=v;} },
  setTimeout() {}, console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
Object.assign(sandbox, vm.runInContext('({ state, VALIDATORS, SCALE, history })', sandbox));
const S = sandbox;

let pass = 0, fail = 0;
function eq(a, e, l) {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (ok) pass++; else { fail++;
    console.log('  FAIL ' + l + ' -> atteso ' + JSON.stringify(e) + ', ottenuto ' + JSON.stringify(a)); }
}
function section(t) { console.log('\n' + t); }

function load(f) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'esempi', f), 'utf8'));
}

/* simula il percorso reale: incolla, verifica, approva */
function importAndApprove(frag, step) {
  const wrapped = 'Ecco il risultato:\n```json\n' + JSON.stringify(frag, null, 2) +
                  '\n```\nFammi sapere se va bene.';
  const parsed = S.extractJSON(wrapped);
  if (parsed.error) { fail++; console.log('  FAIL parsing step ' + step + ': ' + parsed.error); return null; }
  const res = S.VALIDATORS[step](parsed.value);
  if (res.errors.length) {
    fail++; console.log('  FAIL validazione step ' + step + ':');
    res.errors.forEach(e => console.log('        ' + e.replace(/<[^>]+>/g, '')));
    return null;
  }
  const d = res.data;
  if (step === 1) { S.state.project = d.project; S.state.wbs = d.wbs; }
  if (step === 2) { S.state.tasks = d.tasks; S.state.contributors = d.contributors;
    d.contributors.forEach(c => { S.state.config.availability[c.id] = ''; }); }
  if (step === 3) S.state.links = d.links;
  if (step === 4) S.state.estimates = d.estimates;
  S.state.fragments[step] = JSON.parse(JSON.stringify(parsed.value));
  S.state.openQuestions[step] = parsed.value.openQuestions || [];
  S.state.approved[step] = { at: new Date().toISOString(), user: 'prova', revision: S.state.revision };
  S.state.revision++;
  pass++;
  return res;
}

/* ---------------------------------------------------------- */
section('1. Import dei quattro passaggi');

S.state.config.start = '2026-09-07';
S.state.config.holidays = ['2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26', '2027-01-01'];
S.state.config.availability = {};

let res = importAndApprove(load('passo-1-wbs.json'), 1);
eq(S.state.wbs.length, 9, 'nove elementi WBS');
eq(S.currentStep(), 2, 'si avanza al passaggio 2');

res = importAndApprove(load('passo-2-attivita.json'), 2);
eq(S.state.tasks.length, 14, 'quattordici fra attività, milestone e vincoli');
eq(res.warnings.length, 0, 'nessun work package rimasto senza attività');
eq(S.state.openQuestions[2].length, 1, 'una questione aperta registrata');

res = importAndApprove(load('passo-3-sequenza.json'), 3);
eq(S.state.links.length, 18, 'diciotto legami');

res = importAndApprove(load('passo-4-stime.json'), 4);
eq(S.state.estimates.length, 8, 'otto attività stimate');
eq(S.currentStep(), 5, 'piano completo');

/* ---------------------------------------------------------- */
section('2. Schedulazione senza vincoli esterni datati');

let cpm = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(cpm.ok, true, 'piano calcolabile');
eq(cpm.ES.A1, 0, 'si parte subito');
eq(cpm.ES.A2, 5, 'A2 in sovrapposizione con A1 (SS +5)');
eq(cpm.EF.A2, 13, 'A2 finisce prima di A1');
eq(cpm.ES.M1, 15, 'la milestone attende entrambe le analisi');
eq(cpm.TF.A2 > 0, true, 'A2 ha float: non è sul cammino lungo (' + cpm.TF.A2 + ')');

// il ramo lungo passa da A4 (30 gg), non da A5 (25 gg)
eq(cpm.critical.A4, true, 'A4 è critica');
eq(cpm.critical.A5, false, 'A5 non è critica');
eq(cpm.TF.A5, 5, 'A5 ha 5 giorni di float');

const durataTotale = cpm.calculatedEndDay;
eq(durataTotale, 15 + 12 + 30 + 15 + 5, 'fine = A1 + A3 + A4 + A6 + A8');

/* ---------------------------------------------------------- */
section('3. Effetto di un vincolo esterno');

S.state.config.availability.CORE = '2027-02-01';
cpm = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
const calX = S.calendar();
const idxCore = calX.indexOfDate('2027-02-01');
eq(cpm.ES.X1, idxCore, 'il vincolo fissa la disponibilità (giorno ' + idxCore + ')');
eq(cpm.ES.A4, idxCore, 'lo sviluppo attende Core');
eq(cpm.calculatedEndDay > durataTotale, true, 'il piano si allunga');
eq(cpm.critical.X1, true, 'il vincolo esterno diventa critico');
eq(cpm.TF.A1 > 0, true, 'le analisi acquistano float (' + cpm.TF.A1 + ')');

/* una sola modifica in configurazione propaga a tutto il piano */
S.state.config.availability.CORE = '2026-11-02';
const cpmB = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(cpmB.calculatedEndDay < cpm.calculatedEndDay, true,
   'anticipare la disponibilità accorcia il piano');
S.state.config.availability.CORE = '';

/* ---------------------------------------------------------- */
section('4. Festività e calendario');

const cal = S.calendar();
eq(cal.originISO, '2026-09-07', 'avvio di lunedì');
// il 1 novembre 2026 è domenica: la festività non sposta nulla di suo,
// ma 8 e 25 dicembre sono giorni feriali festivi
const d = cal.dateOfIndex(0).toISOString().slice(0,10);
eq(d, '2026-09-07', 'giorno lavorativo 0');
let trovato = false;
for (let i = 0; i < 120; i++) {
  const iso = cal.dateOfIndex(i).toISOString().slice(0,10);
  if (iso === '2026-12-08' || iso === '2026-12-25') trovato = true;
}
eq(trovato, false, 'le festività non compaiono fra i giorni lavorativi');

/* ---------------------------------------------------------- */
section('5. Data imposta e float negativo');

S.state.config.imposedEnd = '2026-11-30';   // anteriore alla fine calcolata
cpm = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(cpm.minTotalFloat < 0, true, 'la data imposta genera float negativo (' + cpm.minTotalFloat + ')');
eq(cpm.hypercritical.A4, true, 'A4 diventa ipercritica');
eq(cpm.calculatedEndDay, durataTotale, 'la fine calcolata non cambia: cambia il giudizio su di essa');
S.state.config.imposedEnd = '';

/* ---------------------------------------------------------- */
section('6. Reticolo');

const tasks = S.allTasks(), links = S.allLinks();
const lay = S.layoutNetwork(tasks, links, S.topoSort(tasks, links).order);
eq(Object.keys(lay.nodes).length, 14, 'quattordici nodi collocati');
eq(lay.rank.START, 0, 'START a sinistra');
eq(lay.rank.END, Math.max(...Object.values(lay.rank)), 'END a destra');
eq(lay.crossingsAfter <= lay.crossingsBefore, true,
   'incroci ridotti o invariati (' + lay.crossingsBefore + ' -> ' + lay.crossingsAfter + ')');

let sovrapposti = 0;
const ids = Object.keys(lay.nodes);
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const a = lay.nodes[ids[i]], b = lay.nodes[ids[j]];
    if (!(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)) sovrapposti++;
  }
eq(sovrapposti, 0, 'nessuna sovrapposizione fra nodi');

/* ---------------------------------------------------------- */
section('7. Filtri e scale');

S.state.view = { scale: 'week', netFilter: 'all', ganttFilter: 'all', owner: '' };
cpm = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(S.visibleIds(cpm, 'net').size, 14, 'senza filtri tutto visibile');

S.state.view.netFilter = 'crit';
const soloCrit = S.visibleIds(cpm, 'net');
eq(soloCrit.has('A5'), false, 'A5 esclusa dal filtro critico');
eq(soloCrit.has('A4'), true, 'A4 inclusa');
S.state.view.netFilter = 'all';

S.state.view.ganttFilter = 'all';
S.state.view.owner = 'SEC';
const soloSec = S.visibleIds(cpm, 'gantt');
eq(soloSec.has('A7'), true, 'il collaudo di sicurezza resta');
eq(soloSec.has('A4'), false, 'lo sviluppo è escluso');
S.state.view.owner = '';

const ticks = S.ganttTicks(cal, cpm.calculatedEndDay, 'month');
eq(ticks.length >= 3, true, 'più mesi coperti');
eq(ticks.reduce((a,t)=>a+t.w,0), (cpm.calculatedEndDay + 1) * S.SCALE.month.px,
   'le colonne mensili coprono esattamente il piano');

/* ---------------------------------------------------------- */
section('8. Riserva di schedulazione');

const primaDellaRiserva = cpm.calculatedEndDay;
S.state.buffers = [{ id: 'BUF1', name: 'Riserva prima della chiusura', duration: 10,
  rationale: 'Scarto fra fine calcolata e P80', after: 'A8', before: 'END' }];
const conRiserva = S.computeCPM(S.buildPlanForCPM(), S.cpmOptions());
eq(conRiserva.ok, true, 'piano con riserva calcolabile');
eq(conRiserva.calculatedEndDay, primaDellaRiserva + 10,
   'la riserva estende la fine di dieci giorni, in modo visibile');
eq(S.allTasks().length, 15, 'la riserva compare come elemento a sé');
S.state.buffers = [];

/* ---------------------------------------------------------- */
section('9. Simulazione probabilistica');

const sim = S.simulate(S.buildPlanForCPM(), S.cpmOptions(), 1500);
eq(sim.iterations, 1500, 'iterazioni completate');
eq(sim.p50 <= sim.p80 && sim.p80 <= sim.p90, true,
   'percentili ordinati (' + sim.p50 + ' / ' + sim.p80 + ' / ' + sim.p90 + ')');
eq(sim.p80 >= primaDellaRiserva, true, 'il P80 non è più ottimista della stima deterministica');
eq(sim.criticalityIndex.A4 > 0.5, true,
   'A4 critica nella maggioranza degli scenari (' + sim.criticalityIndex.A4.toFixed(2) + ')');
eq(sim.criticalityIndex.A5 > 0, true,
   'A5 critica in alcuni scenari pur avendo float nel CPM (' +
   sim.criticalityIndex.A5.toFixed(2) + ')');

/* ---------------------------------------------------------- */
section('10. Relazione leggibile');

const rel1 = S.readableStep(1), rel3 = S.readableStep(3), rel4 = S.readableStep(4);
eq(rel1.includes('planning package'), true, 'il planning package è dichiarato');
eq(rel3.includes('sovrapposizione'), false, 'nessun lead in questo esempio');
eq(rel3.includes('Discrezionale'), true, 'i legami discrezionali sono distinti');
eq(rel3.includes('non può iniziare finché non è iniziata'), true, 'legame SS in prosa');
eq(rel4.includes('tre punti: 22 / 28 / 44'), true, 'stima a tre punti di A4');
eq(rel4.includes('{'), false, 'nessun JSON nella relazione');

/* ---------------------------------------------------------- */
section('11. Ripristino');

S.state.manual = {};
const durOrig = S.state.estimates.find(e => e.id === 'A4').duration;
S.state.estimates.find(e => e.id === 'A4').duration = 60;
S.state.manual['A4'] = S.state.revision;
eq(S.state.fragments[4].estimates.find(e => e.id === 'A4').duration, durOrig,
   'il frammento archiviato conserva la stima originale');

S.state.estimates = JSON.parse(JSON.stringify(S.state.fragments[4].estimates));
S.state.manual = {};
eq(S.state.estimates.find(e => e.id === 'A4').duration, durOrig,
   'il ripristino riporta la stima originale');

/* ---------------------------------------------------------- */
console.log('\n----------------------------------------');
console.log(pass + ' verifiche superate, ' + fail + ' fallite');
process.exit(fail ? 1 : 0);
