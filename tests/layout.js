/* ============================================================
   LAYOUT CORE START
   Layout a livelli per il diagramma di precedenza (AON).
   Sugiyama semplificato: rango per cammino piu' lungo,
   ordinamento per baricentro, coordinate su griglia.
   Nessuna dipendenza dal DOM.
   ============================================================ */

/* Rango = lunghezza del cammino piu' lungo da START.
   Usa il cammino lungo e non la profondita' minima perche' altrimenti
   un'attivita' finirebbe a sinistra di un suo predecessore. */
function assignRanks(tasks, links, order) {
  const rank = {};
  tasks.forEach(t => { rank[t.id] = 0; });
  const preds = new Map(tasks.map(t => [t.id, []]));
  for (const l of links) if (preds.has(l.to)) preds.get(l.to).push(l.from);
  for (const id of order) {
    let r = 0;
    for (const p of preds.get(id) || []) r = Math.max(r, (rank[p] || 0) + 1);
    rank[id] = r;
  }
  // END sempre all'ultimo livello, anche se ha rami corti
  if (rank['END'] !== undefined) {
    const maxR = Math.max(...Object.values(rank));
    rank['END'] = maxR;
  }
  return rank;
}

/* Ordinamento dentro ciascun livello con euristica del baricentro.
   Alterna passate avanti e indietro finche' gli incroci non calano. */
function orderWithinLayers(layers, links, iterations) {
  iterations = iterations || 6;
  const preds = {}, succs = {};
  for (const l of links) {
    (succs[l.from] = succs[l.from] || []).push(l.to);
    (preds[l.to] = preds[l.to] || []).push(l.from);
  }

  const posOf = () => {
    const p = {};
    layers.forEach(layer => layer.forEach((id, i) => { p[id] = i; }));
    return p;
  };

  function barycenter(id, neighbours, pos) {
    const ns = (neighbours[id] || []).filter(n => pos[n] !== undefined);
    if (ns.length === 0) return null;
    return ns.reduce((a, n) => a + pos[n], 0) / ns.length;
  }

  for (let it = 0; it < iterations; it++) {
    const down = it % 2 === 0;
    const pos = posOf();
    const range = down ? layers.map((_, i) => i) : layers.map((_, i) => layers.length - 1 - i);
    for (const li of range) {
      const layer = layers[li];
      const neigh = down ? preds : succs;
      const keyed = layer.map((id, i) => {
        const b = barycenter(id, neigh, pos);
        return { id, key: b === null ? i : b, i };
      });
      keyed.sort((a, b) => a.key - b.key || a.i - b.i);
      layers[li] = keyed.map(k => k.id);
    }
  }
  return layers;
}

function countCrossings(layers, links) {
  const pos = {};
  layers.forEach(layer => layer.forEach((id, i) => { pos[id] = i; }));
  const layerOf = {};
  layers.forEach((layer, li) => layer.forEach(id => { layerOf[id] = li; }));

  let crossings = 0;
  for (let li = 0; li < layers.length - 1; li++) {
    const segs = links
      .filter(l => layerOf[l.from] === li && layerOf[l.to] === li + 1)
      .map(l => [pos[l.from], pos[l.to]]);
    for (let a = 0; a < segs.length; a++)
      for (let b = a + 1; b < segs.length; b++)
        if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) crossings++;
  }
  return crossings;
}

/* Layout completo.
   metrics = { nodeW, nodeH, gapX, gapY, padding } */
function layoutNetwork(tasks, links, order, metrics) {
  const m = Object.assign({ nodeW: 168, nodeH: 78, gapX: 68, gapY: 26, padding: 24 }, metrics || {});

  const rank = assignRanks(tasks, links, order);
  const maxRank = Math.max(0, ...Object.values(rank));

  /* Corsie riservate all'instradamento: un legame che salta piu' di un rango
     deve poter passare sopra o sotto la banda dei nodi, perche' fra i ranghi
     intermedi puo' non restare alcun varco. Senza legami lunghi la banda e'
     nulla e il disegno resta compatto come prima. */
  const spans = {};
  let laneCount = 0;
  for (const l of links) {
    const a = rank[l.from], b = rank[l.to];
    if (a === undefined || b === undefined || Math.abs(b - a) < 2) continue;
    const key = a + ':' + b;
    spans[key] = (spans[key] || 0) + 1;
    laneCount = Math.max(laneCount, Math.min(3, spans[key]));
  }
  const band = laneCount ? laneCount * 9 + 6 : 0;

  let layers = [];
  for (let i = 0; i <= maxRank; i++) layers.push([]);
  // ordine iniziale stabile: quello topologico
  for (const id of order) layers[rank[id]].push(id);

  const before = countCrossings(layers, links);
  layers = orderWithinLayers(layers, links, 8);
  const after = countCrossings(layers, links);

  const nodes = {};
  layers.forEach((layer, li) => {
    layer.forEach((id, i) => {
      nodes[id] = {
        id,
        rank: li,
        index: i,
        x: m.padding + li * (m.nodeW + m.gapX),
        y: m.padding + band + i * (m.nodeH + m.gapY),
        w: m.nodeW,
        h: m.nodeH
      };
    });
  });

  // centra verticalmente ogni livello rispetto al piu' alto
  const tallest = Math.max(...layers.map(l => l.length));
  layers.forEach((layer, li) => {
    const offset = ((tallest - layer.length) * (m.nodeH + m.gapY)) / 2;
    layer.forEach(id => { nodes[id].y += offset; });
  });

  const width = m.padding * 2 + (maxRank + 1) * m.nodeW + maxRank * m.gapX;
  const height = m.padding * 2 + band * 2 + tallest * m.nodeH +
                 Math.max(0, tallest - 1) * m.gapY;

  // limiti entro cui le frecce possono correre senza uscire dal disegno
  m.band = band;
  m.laneTop = 6;
  m.laneBottom = height - 6;

  return { nodes, layers, width, height, rank,
           crossingsBefore: before, crossingsAfter: after, metrics: m };
}

/* Nodi che un legame incontra per strada: quelli dei ranghi intermedi.
   Il rango di partenza e quello di arrivo non sono ostacoli, perche' la freccia
   esce dal bordo destro dell'uno ed entra nel bordo sinistro dell'altro. */
function crossedNodes(from, to, nodes) {
  const lo = Math.min(from.rank, to.rank), hi = Math.max(from.rank, to.rank);
  if (hi - lo < 2) return [];
  const out = [];
  for (const id in nodes) {
    const n = nodes[id];
    if (n.rank > lo && n.rank < hi) out.push(n);
  }
  return out;
}

/* Quota libera per la traversata di un legame lungo.
   Se la quota di arrivo non incontra ostacoli la restituisce tale e quale: i
   legami che oggi vanno bene non cambiano disegno. Altrimenti cerca il varco
   percorribile piu' vicino, cosi' la deviazione resta minima e leggibile.
   laneOffset distanzia i legami che condividono lo stesso varco. */
function freeLane(target, obstacles, bounds, laneOffset) {
  const margin = 6;    // distacco minimo dal bordo di una scatola
  const step = 7;      // passo fra corsie parallele
  const minGap = 12;   // sotto questa altezza il varco non e' percorribile

  const merged = [];
  const spans = (obstacles || [])
    .map(n => [n.y - margin, n.y + n.h + margin])
    .sort((a, b) => a[0] - b[0]);
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  if (!merged.some(g => target > g[0] && target < g[1])) return target;

  const top = bounds && bounds.top != null ? bounds.top : merged[0][0] - 40;
  const bottom = bounds && bounds.bottom != null
    ? bounds.bottom : merged[merged.length - 1][1] + 40;

  const gaps = [];
  let cursor = top;
  for (const g of merged) {
    if (g[0] - cursor >= minGap) gaps.push([cursor, g[0]]);
    cursor = Math.max(cursor, g[1]);
  }
  if (bottom - cursor >= minGap) gaps.push([cursor, bottom]);
  if (!gaps.length) return target;

  const place = g => Math.min(Math.max(target, g[0] + margin), g[1] - margin);
  let best = gaps[0];
  for (const g of gaps)
    if (Math.abs(place(g) - target) < Math.abs(place(best) - target)) best = g;

  const lane = place(best) + (laneOffset || 0) * step;
  return Math.min(Math.max(lane, best[0] + 4), best[1] - 4);
}

/* Percorso ortogonale fra due nodi, con l'ancoraggio dell'etichetta.
   Esce a destra del predecessore, entra a sinistra del successore. Se il salto
   e' di piu' di un livello, la traversata corre su una corsia libera scelta
   fra gli ostacoli dei ranghi intermedi, non alla quota del nodo di arrivo.
   I tratti verticali stanno sempre dentro i corridoi fra un rango e il
   successivo, che per costruzione non contengono nodi. */
function edgeRoute(from, to, metrics, laneOffset, obstacles) {
  const gap = metrics.gapX;
  const off = laneOffset || 0;
  const obs = obstacles || [];
  const bounds = { top: metrics.laneTop, bottom: metrics.laneBottom };
  const x1 = from.x + from.w, y1 = from.y + from.h / 2;
  const x2 = to.x,            y2 = to.y + to.h / 2;
  const label = (x, y) => ({ labelX: x, labelY: y - 3 });

  if (x2 <= x1) {
    // legame all'indietro: aggira sopra i nodi
    let up = Math.min(from.y, to.y) - 18 - off * 8;
    if (obs.length) up = freeLane(up, obs, bounds, off);
    return Object.assign(
      { d: ['M', x1, y1, 'H', x1 + 14, 'V', up, 'H', x2 - 14, 'V', y2, 'H', x2].join(' ') },
      label((x1 + x2) / 2, up));
  }

  const mid = x1 + Math.max(16, Math.min(gap / 2, (x2 - x1) / 2)) + off * 7;
  if (!obs.length) {
    const d = Math.abs(y1 - y2) < 1
      ? ['M', x1, y1, 'H', x2].join(' ')
      : ['M', x1, y1, 'H', mid, 'V', y2, 'H', x2].join(' ');
    return Object.assign({ d }, label((x1 + x2) / 2, (y1 + y2) / 2));
  }

  // legame lungo: corsia di traversata e rientro nel corridoio del successore
  const lane = freeLane(y2, obs, bounds, off);
  const back = x2 - Math.max(16, Math.min(gap / 2, (x2 - x1) / 2)) - off * 7;
  const exit = Math.min(mid, back - 8);
  const enter = Math.max(back, exit + 8);
  const d = Math.abs(lane - y2) < 1
    ? (Math.abs(y1 - y2) < 1 ? ['M', x1, y1, 'H', x2].join(' ')
                             : ['M', x1, y1, 'H', exit, 'V', y2, 'H', x2].join(' '))
    : ['M', x1, y1, 'H', exit, 'V', lane, 'H', enter, 'V', y2, 'H', x2].join(' ');
  return Object.assign({ d }, label((exit + enter) / 2, lane));
}

/* Il solo tracciato, per chi non ha bisogno dell'etichetta. */
function edgePath(from, to, metrics, laneOffset, obstacles) {
  return edgeRoute(from, to, metrics, laneOffset, obstacles).d;
}

/* LAYOUT CORE END */

module.exports = { assignRanks, orderWithinLayers, countCrossings, layoutNetwork,
  crossedNodes, freeLane, edgeRoute, edgePath };
