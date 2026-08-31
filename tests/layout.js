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
        y: m.padding + i * (m.nodeH + m.gapY),
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
  const height = m.padding * 2 + tallest * m.nodeH + Math.max(0, tallest - 1) * m.gapY;

  return { nodes, layers, width, height, rank,
           crossingsBefore: before, crossingsAfter: after, metrics: m };
}

/* Percorso ortogonale fra due nodi.
   Esce a destra del predecessore, entra a sinistra del successore.
   Se il salto e' di piu' di un livello, aggira passando sopra o sotto. */
function edgePath(from, to, metrics, laneOffset) {
  const gap = metrics.gapX;
  const x1 = from.x + from.w, y1 = from.y + from.h / 2;
  const x2 = to.x,            y2 = to.y + to.h / 2;

  if (x2 <= x1) {
    // legame all'indietro: aggira sopra i nodi
    const up = Math.min(from.y, to.y) - 18 - (laneOffset || 0) * 8;
    return ['M', x1, y1, 'H', x1 + 14, 'V', up, 'H', x2 - 14, 'V', y2, 'H', x2].join(' ');
  }

  const mid = x1 + Math.max(16, Math.min(gap / 2, (x2 - x1) / 2)) + (laneOffset || 0) * 7;
  if (Math.abs(y1 - y2) < 1) return ['M', x1, y1, 'H', x2].join(' ');
  return ['M', x1, y1, 'H', mid, 'V', y2, 'H', x2].join(' ');
}

/* LAYOUT CORE END */

module.exports = { assignRanks, orderWithinLayers, countCrossings, layoutNetwork, edgePath };
