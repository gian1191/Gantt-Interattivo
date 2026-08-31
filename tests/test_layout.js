const { assignRanks, countCrossings, layoutNetwork, edgePath } = require('./layout.js');
const { topoSort } = require('./cpm.js');

let pass = 0, fail = 0;
function eq(a, e, l) {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (ok) pass++; else { fail++;
    console.log('  FAIL ' + l + ' -> atteso ' + JSON.stringify(e) + ', ottenuto ' + JSON.stringify(a)); }
}
function section(t) { console.log('\n' + t); }

function build(tasks, links) {
  const t = tasks.map(id => ({ id }));
  const { order } = topoSort(t, links);
  return { tasks: t, links, order };
}
const L = (from, to) => ({ from, to, type: 'FS', lag: 0 });

/* ---------------------------------------------------------- */
section('1. Ranghi per cammino piu lungo');

let g = build(['START','A','B','C','END'],
  [L('START','A'), L('A','B'), L('B','C'), L('C','END'), L('START','C')]);
let r = assignRanks(g.tasks, g.links, g.order);
eq(r.START, 0, 'START al livello 0');
eq(r.A, 1, 'A al livello 1');
eq(r.C, 3, 'C usa il cammino lungo, non la scorciatoia da START');
eq(r.END, 4, 'END in coda');

// nessun nodo puo' stare a sinistra di un suo predecessore
for (const l of g.links)
  if (r[l.to] <= r[l.from]) { fail++; console.log('  FAIL ordine violato su ' + l.from + '->' + l.to); }
pass++;

/* ---------------------------------------------------------- */
section('2. END sempre sull ultimo livello');

g = build(['START','A','B','END'],
  [L('START','A'), L('A','B'), L('B','END'), L('START','END')]);
r = assignRanks(g.tasks, g.links, g.order);
eq(r.END, Math.max(...Object.values(r)), 'END all ultimo livello anche con ramo corto');

/* ---------------------------------------------------------- */
section('3. Riduzione degli incroci');

// grafo intenzionalmente incrociato: A->D, B->C con ordine iniziale A,B / C,D
g = build(['START','A','B','C','D','END'],
  [L('START','A'), L('START','B'), L('A','D'), L('B','C'),
   L('C','END'), L('D','END')]);
let out = layoutNetwork(g.tasks, g.links, g.order);
eq(out.crossingsAfter <= out.crossingsBefore, true,
   'incroci non aumentano (' + out.crossingsBefore + ' -> ' + out.crossingsAfter + ')');
eq(out.crossingsAfter, 0, 'incrocio risolto');

/* ---------------------------------------------------------- */
section('4. Nessuna sovrapposizione fra nodi');

g = build(['START','A','B','C','D','E','F','END'],
  [L('START','A'), L('START','B'), L('START','C'),
   L('A','D'), L('B','D'), L('C','E'), L('D','F'), L('E','F'),
   L('F','END')]);
out = layoutNetwork(g.tasks, g.links, g.order);

const ids = Object.keys(out.nodes);
let overlaps = 0;
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const a = out.nodes[ids[i]], b = out.nodes[ids[j]];
    const sep = !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                  a.y + a.h <= b.y || b.y + b.h <= a.y);
    if (sep) overlaps++;
  }
eq(overlaps, 0, 'nessuna coppia di nodi sovrapposta');

/* ---------------------------------------------------------- */
section('5. Coerenza delle dimensioni');

const maxRight = Math.max(...ids.map(id => out.nodes[id].x + out.nodes[id].w));
const maxBottom = Math.max(...ids.map(id => out.nodes[id].y + out.nodes[id].h));
eq(maxRight <= out.width, true, 'nessun nodo oltre la larghezza dichiarata');
eq(maxBottom <= out.height, true, 'nessun nodo oltre l altezza dichiarata');
eq(ids.every(id => out.nodes[id].x >= 0 && out.nodes[id].y >= 0), true,
   'nessuna coordinata negativa');

/* ---------------------------------------------------------- */
section('6. Ogni attivita compare una sola volta');

const flat = out.layers.flat();
eq(flat.length, g.tasks.length, 'tutti i nodi collocati');
eq(new Set(flat).size, flat.length, 'nessun duplicato fra i livelli');

/* ---------------------------------------------------------- */
section('7. Percorsi delle frecce');

const A = { x: 0, y: 0, w: 100, h: 60 };
const B = { x: 200, y: 0, w: 100, h: 60 };
let p = edgePath(A, B, { gapX: 60 }, 0);
eq(p.startsWith('M 100 30'), true, 'parte dal bordo destro, a meta altezza');
eq(p.endsWith('H 200'), true, 'arriva al bordo sinistro');

const C = { x: 200, y: 120, w: 100, h: 60 };
p = edgePath(A, C, { gapX: 60 }, 0);
eq(p.includes('V 150'), true, 'cambia quota verso il nodo piu basso');

// legame all indietro
p = edgePath(B, A, { gapX: 60 }, 0);
eq(p.includes('V'), true, 'legame retrogrado aggira');
eq(p.split('H').length > 3, true, 'percorso retrogrado a piu segmenti');

/* ---------------------------------------------------------- */
section('8. Grafo ampio: tenuta e prestazioni');

const wide = ['START'];
const wideLinks = [];
for (let i = 0; i < 60; i++) {
  wide.push('T' + i);
  wideLinks.push(L(i < 10 ? 'START' : 'T' + (i - 10), 'T' + i));
}
wide.push('END');
for (let i = 50; i < 60; i++) wideLinks.push(L('T' + i, 'END'));
g = build(wide, wideLinks);

const t0 = Date.now();
out = layoutNetwork(g.tasks, g.links, g.order);
const ms = Date.now() - t0;
eq(Object.keys(out.nodes).length, 62, '62 nodi collocati');
eq(ms < 500, true, 'layout sotto il mezzo secondo (' + ms + ' ms)');
eq(out.layers.length, 8, '8 livelli: START, sei ondate da dieci, END');

/* ---------------------------------------------------------- */
console.log('\n----------------------------------------');
console.log(pass + ' verifiche superate, ' + fail + ' fallite');
process.exit(fail ? 1 : 0);
