// A small teaching graph. Costs are illustrative units, not measured game times.
export const routeNodes = [
  { id: 'start', label: 'Start', x: 65, y: 150 },
  { id: 'square', label: 'Square', x: 220, y: 65 },
  { id: 'passage', label: 'Passage', x: 390, y: 65 },
  { id: 'alley', label: 'Alley', x: 220, y: 235 },
  { id: 'bridge', label: 'Bridge', x: 390, y: 235 },
  { id: 'goal', label: 'Goal', x: 550, y: 150 },
];
export const routeEdges = [
  { id: 'start-square', a: 'start', b: 'square', cost: 3 },
  { id: 'square-passage', a: 'square', b: 'passage', cost: 2 },
  { id: 'passage-goal', a: 'passage', b: 'goal', cost: 3 },
  { id: 'start-alley', a: 'start', b: 'alley', cost: 4 },
  { id: 'alley-bridge', a: 'alley', b: 'bridge', cost: 3 },
  { id: 'bridge-goal', a: 'bridge', b: 'goal', cost: 4 },
];

// A* with a geometric lower-bound heuristic; closed edges are excluded.
// Small-array priority selection is sufficient for this six-node illustration.
export function findRoute(nodes, edges, startId, goalId, budget = nodes.length) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (!byId.has(startId) || !byId.has(goalId)) throw new Error('Unknown route endpoint');
  if (!Number.isInteger(budget) || budget < 1) throw new Error('Invalid expansion budget');
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const links = new Map(nodes.map(node => [node.id, []]));
  let scale = Infinity;
  for (const edge of edges) {
    if (!byId.has(edge.a) || !byId.has(edge.b) || !Number.isFinite(edge.cost) || edge.cost < 0) throw new Error('Invalid edge');
    if (edge.blocked) continue;
    links.get(edge.a).push({ id: edge.b, cost: edge.cost });
    links.get(edge.b).push({ id: edge.a, cost: edge.cost });
    const length = distance(byId.get(edge.a), byId.get(edge.b));
    if (length > 0) scale = Math.min(scale, edge.cost / length);
  }
  if (!Number.isFinite(scale)) scale = 0;
  const heuristic = id => distance(byId.get(id), byId.get(goalId)) * scale;
  const open = new Set([startId]);
  const closed = new Set();
  const costs = new Map([[startId, 0]]);
  const previous = new Map();
  let closest = startId;
  let complete = false;
  while (open.size && closed.size < budget) {
    const current = [...open].reduce((best, id) => costs.get(id) + heuristic(id) < costs.get(best) + heuristic(best) ? id : best);
    open.delete(current);
    closed.add(current);
    if (heuristic(current) < heuristic(closest)) closest = current;
    if (current === goalId) { closest = current; complete = true; break; }
    for (const neighbor of links.get(current)) {
      if (closed.has(neighbor.id)) continue;
      const cost = costs.get(current) + neighbor.cost;
      if (cost < (costs.get(neighbor.id) ?? Infinity)) {
        costs.set(neighbor.id, cost);
        previous.set(neighbor.id, current);
        open.add(neighbor.id);
      }
    }
  }
  const path = [closest];
  while (previous.has(path[0])) path.unshift(previous.get(path[0]));
  return { path, cost: costs.get(closest), complete, expanded: closed.size, reason: complete ? 'complete' : open.size ? 'budget' : 'disconnected' };
}
