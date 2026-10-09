import { routeNodes, routeEdges, findRoute } from './graph-search.js';

const node = (x, y, label, width = 112) => `<g class="flow-node"><rect x="${x - width / 2}" y="${y - 22}" width="${width}" height="44" rx="5"/><text x="${x}" y="${y + 5}" text-anchor="middle">${label}</text></g>`;
const edge = (x1, y1, x2, y2) => `<path class="flow-edge" d="M${x1},${y1} L${x2},${y2}" marker-end="url(#flow-arrow)"/>`;
const frame = (body, label, height = 210) => `<svg class="flow-svg" viewBox="0 0 600 ${height}" role="img" aria-label="${label}"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#749cb5"/></marker></defs>${body}</svg>`;

export function diagramFor(item) {
  if (item.id === 'model') return frame(
    '<path class="flow-edge" d="M160,110 H440"/><text class="flow-note" x="300" y="85" text-anchor="middle">TWO-WAY WALKABLE CONNECTION</text>' + node(100,110,'Place A',120) + node(500,110,'Place B',120),
    'Two places are nodes. The line between them is a two-way walkable connection.');
  if (item.id === 'navigation') return '<a class="button small" href="#route-lab">Try the working route graph ↑</a>';
  if (item.id === 'dependencies') return frame(
    edge(136,90,244,90) + edge(356,90,464,90) + '<path class="flow-edge" d="M80,112 V160 H520 V112" marker-end="url(#flow-arrow)"/>' + node(80,90,'Shared') + node(300,90,'Client') + node(520,90,'Server') + '<text class="flow-note" x="300" y="195" text-anchor="middle">ARROW = PREREQUISITE → CONSUMER</text>',
    'Shared is a prerequisite of client and server. Client is also a prerequisite of server.');
  if (item.id === 'review') return frame(
    '<path class="flow-edge" d="M101,110 H132 V40 H156 M132,110 H156 M132,110 V180 H156 M266,40 H288 V110 H322 M266,110 H322 M266,180 H288 V110"/>' + edge(418,110,472,110) + node(55,110,'Diff',92) + node(211,40,'Correctness',110) + node(211,110,'Security',110) + node(211,180,'Performance',110) + node(370,110,'Combine',96) + node(526,110,'Skeptics',108),
    'A diff branches into review lenses, then their findings join before skeptical checks.',220);
  if (item.id === 'hierarchy') return frame(
    edge(68,67,174,67) + edge(266,67,340,67) + '<path class="flow-edge" d="M438,67 H463 V140 H486 M463,67 V190 H486"/>' + node(68,67,'Figure',100) + node(220,67,'Body',92) + node(390,67,'Shoulder',96) + node(536,140,'Hand',100) + node(536,190,'Blade',100) + '<text class="flow-note" x="240" y="160" text-anchor="middle">ARROW = PARENT → CHILD</text>',
    'Figure contains body, body contains shoulder, and shoulder contains hand and blade. The outer group and upper arm are omitted.',230);
  if (item.id === 'feedback') return frame(
    edge(144,64,228,64) + edge(284,86,284,126) + edge(228,148,144,148) + edge(88,126,88,86) + '<path class="flow-edge" d="M88,170 V212 H474 V170" marker-end="url(#flow-arrow)"/>' + node(88,64,'Observe',112) + node(284,64,'Investigate',112) + node(284,148,'Change',112) + node(88,148,'Check',112) + node(474,148,'Stop &amp; record',150) + '<text class="flow-note" x="472" y="112" text-anchor="middle">EXPECTATIONS MET</text><text class="flow-note" x="88" y="109" text-anchor="end">NO</text><text class="flow-note" x="175" y="204" text-anchor="middle">YES</text>',
    'Observe, investigate, change and check form a cycle when expectations are not met. Otherwise stop and record.',235);
  return `<div class="graph-linear">${item.nodes.map((label, i) => `${i ? '<span class="diagram-arrow" aria-hidden="true">→</span>' : ''}<span class="diagram-node ${i ? '' : 'coral'}">${label}</span>`).join('')}</div>`;
}

export function mountRouteLab() {
  const svg = document.querySelector('#route-graph');
  const status = document.querySelector('#route-status');
  const controls = ['route-block', 'route-disconnect', 'route-budget'].map(id => document.getElementById(id));
  const render = () => {
    const [block, disconnect, budget] = controls.map(input => input.checked);
    const edges = routeEdges.map(edge => ({ ...edge, blocked: (block || disconnect) && edge.id === 'passage-goal' || disconnect && edge.id === 'bridge-goal' }));
    const result = findRoute(routeNodes, edges, 'start', 'goal', budget ? 2 : 6);
    const used = (a, b) => result.path.some((id, i) => i > 0 && (result.path[i-1] === a && id === b || result.path[i-1] === b && id === a));
    const byId = new Map(routeNodes.map(node => [node.id, node]));
    const segments = edges.map(edge => {
      const a = byId.get(edge.a), b = byId.get(edge.b);
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      return `<g class="route-edge ${edge.blocked ? 'closed' : used(edge.a,edge.b) ? 'active' : ''}"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><rect x="${x-14}" y="${y-13}" width="28" height="26" rx="13"/><text x="${x}" y="${y+5}" text-anchor="middle">${edge.blocked ? '×' : edge.cost}</text></g>`;
    }).join('');
    const points = routeNodes.map(node => `<g class="route-node ${result.path.includes(node.id) ? 'visited' : ''} ${node.id === 'goal' ? 'goal' : ''}"><circle cx="${node.x}" cy="${node.y}" r="25"/><circle class="node-core" cx="${node.x}" cy="${node.y}" r="5"/><text x="${node.x}" y="${node.y + (node.y > 160 ? 47 : -40)}" text-anchor="middle">${node.label}</text></g>`).join('');
    svg.innerHTML = segments + points;
    svg.setAttribute('aria-label', `Route graph. ${result.complete ? 'Complete' : 'Partial'} path: ${result.path.map(id => byId.get(id).label).join(' to ')}. Cost ${result.cost}.`);
    const title = result.complete ? block || disconnect ? 'A connection closed. The route changed.' : 'Connected places. A complete route.' : result.reason === 'budget' ? 'Search paused. The goal is not reached.' : 'The goal is disconnected. A partial route remains.';
    const message = result.complete ? `The highlighted path reaches the goal with cost ${result.cost}. ${block ? 'The available alternative costs more than the original route.' : 'The search prefers this lower-cost path.'}` : result.reason === 'budget' ? 'Only two nodes could be expanded. A partial path is progress, not arrival. More search may find a route.' : 'Neither connection into the goal is open. More searching cannot create a missing connection.';
    status.innerHTML = `<span class="badge ${result.complete ? 'observed' : 'planned'}">${result.complete ? 'COMPLETE' : 'PARTIAL'} · ${result.expanded} NODES EXPANDED</span><h4>${title}</h4><p>${message}</p><div class="route-path">${result.path.map(id => byId.get(id).label).join(' → ')}${result.complete ? ' ✓' : ' · not at goal'}</div>`;
    status.dataset.complete = String(result.complete);
    status.dataset.reason = result.reason;
    status.dataset.cost = String(result.cost);
  };
  controls.forEach(input => input.addEventListener('change', render));
  document.querySelector('#route-reset').addEventListener('click', () => { controls.forEach(input => { input.checked = false; }); render(); });
  render();
}
