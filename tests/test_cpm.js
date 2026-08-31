const { makeCalendar, topoSort, computeCPM, simulate } = require('./cpm.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else { fail++; console.log('  FAIL ' + label + ' -> atteso ' +
    JSON.stringify(expected) + ', ottenuto ' + JSON.stringify(actual)); }
}
function section(t) { console.log('\n' + t); }

/* ---------------------------------------------------------- */
section('1. Calendario');

// 2026-08-29 e' un sabato: il giorno 0 deve slittare a lunedi 31
let cal = makeCalendar('2026-08-29', []);
eq(cal.originISO, '2026-08-31', 'avvio di sabato slitta a lunedi');
eq(cal.dateOfIndex(0).toISOString().slice(0,10), '2026-08-31', 'giorno 0');
eq(cal.dateOfIndex(4).toISOString().slice(0,10), '2026-09-04', 'giorno 4 = venerdi');
eq(cal.dateOfIndex(5).toISOString().slice(0,10), '2026-09-07', 'giorno 5 salta il weekend');

// con festivita' del 1 settembre
cal = makeCalendar('2026-08-31', ['2026-09-01']);
eq(cal.dateOfIndex(1).toISOString().slice(0,10), '2026-09-02', 'festivita saltata');

/* ---------------------------------------------------------- */
section('2. Cicli e ordinamento');

let r = topoSort(
  [{id:'A'},{id:'B'},{id:'C'}],
  [{from:'A',to:'B'},{from:'B',to:'C'},{from:'C',to:'A'}]);
eq(r.cycle !== null, true, 'ciclo rilevato');

r = topoSort([{id:'A'},{id:'B'}], [{from:'A',to:'B'}]);
eq(r.cycle, null, 'nessun ciclo');
eq(r.order, ['A','B'], 'ordine topologico');

/* ---------------------------------------------------------- */
section('3. Catena semplice FS');
/*  START -> A(5) -> B(3) -> END
    ES A=0 EF=5 ; ES B=5 EF=8 ; fine = 8 ; tutto critico  */

let plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'A',to:'B',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:5, B:3, END:0 }
};
let c = computeCPM(plan, {});
eq(c.ok, true, 'calcolo riuscito');
eq(c.ES.A, 0, 'ES A');
eq(c.EF.A, 5, 'EF A');
eq(c.ES.B, 5, 'ES B');
eq(c.EF.B, 8, 'EF B');
eq(c.calculatedEndDay, 8, 'fine progetto');
eq(c.TF.A, 0, 'TF A');
eq(c.TF.B, 0, 'TF B');
eq(c.critical.A && c.critical.B, true, 'catena critica');

/* ---------------------------------------------------------- */
section('4. Ramo parallelo con float');
/*  START -> A(10) -> END
    START -> B(4)  -> END
    fine = 10 ; A critica TF=0 ; B TF=6 ; free float B = 6   */

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'START',to:'B',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:10, B:4, END:0 }
};
c = computeCPM(plan, {});
eq(c.calculatedEndDay, 10, 'fine determinata dal ramo lungo');
eq(c.TF.A, 0, 'TF A');
eq(c.TF.B, 6, 'TF B');
eq(c.FF.B, 6, 'free float B');
eq(c.critical.B, false, 'B non critica');

/* ---------------------------------------------------------- */
section('5. Free float distinto dal total float');
/*  START -> A(5) -> B(5) -> END
    START -> C(2) -> B
    C ha TF=3 ma FF=3 (puo' slittare senza toccare B che parte a 5)  */

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'C'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'START',to:'C',type:'FS',lag:0},
    {from:'A',to:'B',type:'FS',lag:0},
    {from:'C',to:'B',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:5, B:5, C:2, END:0 }
};
c = computeCPM(plan, {});
eq(c.ES.B, 5, 'B parte dopo A');
eq(c.TF.C, 3, 'TF C');
eq(c.FF.C, 3, 'FF C');
eq(c.FF.A, 0, 'FF A nullo');

/* ---------------------------------------------------------- */
section('6. Lag e lead');

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'A',to:'B',type:'FS',lag:3},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:5, B:2, END:0 }
};
c = computeCPM(plan, {});
eq(c.ES.B, 8, 'lag di 3 giorni');
eq(c.calculatedEndDay, 10, 'fine con lag');

plan.links[1].lag = -2;   // lead
c = computeCPM(plan, {});
eq(c.ES.B, 3, 'lead di 2 giorni');

/* ---------------------------------------------------------- */
section('7. Tipi di legame SS, FF, SF');

// SS con lag 2: B inizia 2 giorni dopo l'inizio di A
plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'A',to:'B',type:'SS',lag:2},
    {from:'A',to:'END',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:10, B:4, END:0 }
};
c = computeCPM(plan, {});
eq(c.ES.B, 2, 'SS lag 2');
eq(c.calculatedEndDay, 10, 'fine invariata: B finisce a 6');

// FF: B non puo' finire prima della fine di A
plan.links[1] = {from:'A',to:'B',type:'FF',lag:0};
c = computeCPM(plan, {});
eq(c.EF.B, 10, 'FF: B finisce con A');
eq(c.ES.B, 6, 'FF: ES derivato a ritroso');

// SF: B non puo' finire prima dell'inizio di A + lag
plan.links[1] = {from:'A',to:'B',type:'SF',lag:8};
c = computeCPM(plan, {});
eq(c.EF.B, 8, 'SF: fine di B vincolata');

/* ---------------------------------------------------------- */
section('8. Vincolo esterno Start No Earlier Than');
/*  X1 disponibile al giorno 20 ; A(5) dipende da X1
    la fine e' 25 anche se il progetto potrebbe partire subito  */

plan = {
  tasks: [{id:'START'},{id:'X1'},{id:'A'},{id:'END'}],
  links: [
    {from:'START',to:'X1',type:'FS',lag:0},
    {from:'X1',to:'A',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, X1:0, A:5, END:0 },
  constraints: { X1: 20 }
};
c = computeCPM(plan, {});
eq(c.ES.X1, 20, 'vincolo applicato');
eq(c.calculatedEndDay, 25, 'fine guidata dal vincolo');
eq(c.TF.START, 20, 'START ha float: si puo partire piu tardi');

/* ---------------------------------------------------------- */
section('9. Float negativo con data imposta');

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:20, END:0 }
};
c = computeCPM(plan, { imposedEndDay: 15 });
eq(c.calculatedEndDay, 20, 'fine calcolata');
eq(c.TF.A, -5, 'float negativo');
eq(c.hypercritical.A, true, 'attivita ipercritica');

/* ---------------------------------------------------------- */
section('10. Percorsi quasi critici');

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'C'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'START',to:'B',type:'FS',lag:0},
    {from:'START',to:'C',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0},
    {from:'C',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:10, B:8, C:2, END:0 }
};
c = computeCPM(plan, { nearCriticalThreshold: 3 });
eq(c.critical.A, true, 'A critica');
eq(c.TF.B, 2, 'TF B');
eq(c.nearCritical.B, true, 'B quasi critica');
eq(c.nearCritical.C, false, 'C non quasi critica (TF 8)');

/* ---------------------------------------------------------- */
section('11. Percorsi critici multipli');

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'START',to:'B',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:7, B:7, END:0 }
};
c = computeCPM(plan, {});
eq(c.critical.A && c.critical.B, true, 'entrambi i rami critici');

/* ---------------------------------------------------------- */
section('12. Simulazione Monte Carlo');

plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'A',to:'B',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:10, B:10, END:0 },
  threePoint: {
    A: { optimistic: 8, mostLikely: 10, pessimistic: 20 },
    B: { optimistic: 8, mostLikely: 10, pessimistic: 20 }
  }
};
let sim = simulate(plan, {}, 1000);
eq(sim.iterations, 1000, 'iterazioni completate');
eq(sim.p50 >= 20 && sim.p50 <= 26, true, 'P50 plausibile (' + sim.p50 + ')');
eq(sim.p80 >= sim.p50, true, 'P80 >= P50 (' + sim.p80 + ')');
eq(sim.p90 >= sim.p80, true, 'P90 >= P80 (' + sim.p90 + ')');
eq(sim.criticalityIndex.A, 1, 'A sempre critica in catena');

// indice di criticita' su rami concorrenti quasi pari
plan = {
  tasks: [{id:'START'},{id:'A'},{id:'B'},{id:'END'}],
  links: [
    {from:'START',to:'A',type:'FS',lag:0},
    {from:'START',to:'B',type:'FS',lag:0},
    {from:'A',to:'END',type:'FS',lag:0},
    {from:'B',to:'END',type:'FS',lag:0}
  ],
  durations: { START:0, A:10, B:9, END:0 },
  threePoint: {
    A: { optimistic: 8, mostLikely: 10, pessimistic: 14 },
    B: { optimistic: 7, mostLikely: 9,  pessimistic: 16 }
  }
};
sim = simulate(plan, {}, 2000);
const both = sim.criticalityIndex.A + sim.criticalityIndex.B;
eq(both > 1.0, true, 'indici sommano oltre 1: entrambi talvolta critici (' +
   sim.criticalityIndex.A.toFixed(2) + ' / ' + sim.criticalityIndex.B.toFixed(2) + ')');
eq(sim.criticalityIndex.B > 0.15, true,
   'B critica in una quota rilevante di scenari, pur avendo float nel CPM');

/* ---------------------------------------------------------- */
console.log('\n----------------------------------------');
console.log(pass + ' verifiche superate, ' + fail + ' fallite');
process.exit(fail ? 1 : 0);
