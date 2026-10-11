/* By-the-numbers dashboard: KPI strip, five charts, and a source panel behind every figure.
   Charts are plain SVG built here; motion is CSS transitions switched on by .is-playing, so the
   reduced-motion path is just "add the class with transitions off". */
(function () {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const color = c => /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#99dcff';
  const num = v => typeof v === 'number' && Number.isFinite(v);

  let D, root, sheet, tip, played = false;
  const sources = {};   // id -> { title, value, src, conf }

  function s(tag, attrs, parent) {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  const confBadge = c => `<span class="dash-conf" data-conf="${c}" title="${esc(D.conf[c].label)}: ${esc(D.conf[c].desc)}"><i></i>${esc(D.conf[c].label)}</span>`;
  const srcBtn = (id, label) => `<button type="button" class="dash-src" data-src="${id}" aria-label="Source for ${esc(label)}">Source</button>`;

  function panel(cls, id, title, sub, conf) {
    const p = document.createElement('figure');
    p.className = `dash-panel ${cls}`;
    p.innerHTML = `<figcaption class="dash-ph"><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <div class="dash-ph-r">${confBadge(conf)}${srcBtn(id, title)}</div></figcaption><div class="dash-body"></div>`;
    return p;
  }

  /* ---------- KPI strip ---------- */
  function kpis(grid) {
    const strip = document.createElement('div');
    strip.className = 'dash-kpis';
    D.kpis.forEach((k, i) => {
      const sid = `kpi-${k.id}`;
      sources[sid] = { title: k.unit.charAt(0).toUpperCase() + k.unit.slice(1), value: k.value, unit: k.unit, src: k.src, conf: k.conf };
      const m = /^(~?)([\d.,]+)(.*)$/.exec(k.value) || ['', '', k.value, ''];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dash-kpi';
      b.dataset.src = sid;
      b.style.setProperty('--i', i);
      b.setAttribute('aria-label', `${k.value} ${k.unit}, ${k.label}. ${D.conf[k.conf].label}. Show source`);
      b.innerHTML = `<span class="dash-kv"><span class="dash-num" data-pre="${esc(m[1])}" data-target="${esc(m[2])}" data-suf="${esc(m[3])}">${esc(k.value)}</span><span class="dash-unit">${esc(k.unit)}</span></span>
        <span class="dash-kl"><span class="dash-kc" data-conf="${k.conf}" title="${esc(D.conf[k.conf].label)}"><i></i></span>${esc(k.label)}</span>`;
      strip.appendChild(b);
    });
    grid.appendChild(strip);
  }

  /* ---------- A. the nine days ---------- */
  function days(grid) {
    const d = D.days;
    sources.days = { title: 'The nine days', value: '370', unit: 'commits in nine days', src: d.src, conf: d.conf };
    const p = panel('dash-days', 'days', 'The nine days', 'Commits per day (bars) and active agent hours (line)', d.conf);
    const W = 560, H = 192, L = 34, R = 34, T = 34, B = 34;
    const iw = W - L - R, ih = H - T - B, n = d.commits.length, bw = iw / n;
    const yC = v => T + ih - (v / 80) * ih, yH = v => T + ih - (v / 20) * ih;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'dash-svg',
      'aria-label': `Commits per day: ${d.commits.map((c, i) => `${d.labels[i]} ${d.months[i] || ''} ${c}`).join(', ')}. Active hours peak at 16.7 on 30 September.` });
    const [o0, o1] = d.outage;
    s('rect', { x: L + o0 * bw, y: T - 20, width: (o1 - o0 + 1) * bw, height: ih + 20, class: 'dash-outage' }, svg);
    s('text', { x: L + (o0 + (o1 - o0 + 1) / 2) * bw, y: T - 24, class: 'dash-outage-t', 'text-anchor': 'middle' }, svg).textContent = 'Codex reviewer down';
    [0, 40, 80].forEach(v => {
      s('line', { x1: L, x2: W - R, y1: yC(v), y2: yC(v), class: 'dash-gl' }, svg);
      s('text', { x: L - 8, y: yC(v) + 4, class: 'dash-ax', 'text-anchor': 'end' }, svg).textContent = v;
    });
    [0, 10, 20].forEach(v => { s('text', { x: W - R + 8, y: yH(v) + 4, class: 'dash-ax dash-ax-h' }, svg).textContent = v + 'h'; });
    d.commits.forEach((c, i) => {
      const x = L + i * bw + bw * 0.2, w = bw * 0.6;
      const r = s('rect', { x, y: yC(c), width: w, height: Math.max(1, T + ih - yC(c)), rx: 3, class: 'dash-bar', style: `--i:${i}` }, svg);
      r.dataset.tip = `${d.labels[i]} ${d.months[i] || (i < 6 ? 'Sep' : 'Oct')}: ${c} commits, ${d.hours[i]} active hours`;
      if (c === 79) s('text', { x: x + w / 2, y: yC(c) - 6, class: 'dash-val', 'text-anchor': 'middle', style: `--i:${i}` }, svg).textContent = '79';
      s('text', { x: x + w / 2, y: H - B + 16, class: 'dash-ax', 'text-anchor': 'middle' }, svg).textContent = d.labels[i];
      if (d.months[i]) s('text', { x: x + w / 2, y: H - B + 30, class: 'dash-ax dash-ax-m', 'text-anchor': 'middle' }, svg).textContent = d.months[i];
    });
    const pts = d.hours.map((h, i) => [L + i * bw + bw / 2, yH(h)]);
    s('path', { d: 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L'), class: 'dash-line', pathLength: 1 }, svg);
    pts.forEach(([x, y], i) => s('circle', { cx: x, cy: y, r: i === 5 ? 4.2 : 2.6, class: 'dash-dot' + (i === 5 ? ' is-peak' : ''), style: `--i:${i}` }, svg));
    p.querySelector('.dash-body').appendChild(svg);
    grid.appendChild(p);
  }

  /* ---------- B. 613 sessions, one dot each ---------- */
  function sessions(grid) {
    const g = D.sessions.groups, total = g.reduce((a, x) => a + x.count, 0);
    sources.sessions = { title: 'Who did the work', value: String(total), unit: 'agent sessions', src: D.sessions.src, conf: D.sessions.conf };
    const p = panel('dash-sessions', 'sessions', `${total} agent sessions`, 'One dot per session, coloured by role', D.sessions.conf);
    const cols = 52, cell = 10, rows = Math.ceil(total / cols);
    const svg = s('svg', { viewBox: `0 0 ${cols * cell} ${rows * cell}`, role: 'img', class: 'dash-svg dash-waffle',
      'aria-label': g.map(x => `${x.family} ${x.label}: ${x.count}`).join(', ') });
    let k = 0;
    g.forEach(grp => {
      for (let j = 0; j < grp.count; j++, k++) {
        const c = s('circle', { cx: (k % cols) * cell + cell / 2, cy: Math.floor(k / cols) * cell + cell / 2, r: grp.id === 'lead' ? 4.4 : 3.5,
          fill: color(grp.color), class: 'dash-cell', style: `--k:${k}` }, svg);
        c.dataset.g = grp.id;
      }
    });
    const legend = document.createElement('div');
    legend.className = 'dash-legend';
    ['Claude Code', 'Codex'].forEach(fam => {
      const items = g.filter(x => x.family === fam), sum = items.reduce((a, x) => a + x.count, 0);
      legend.insertAdjacentHTML('beforeend', `<div class="dash-fam"><p class="dash-fam-h">${fam} <b>${sum}</b></p>${items.map(x =>
        `<button type="button" class="dash-li" data-g="${esc(x.id)}"><i style="background:${color(x.color)}"></i><span>${esc(x.label)}</span><b>${x.count}</b></button>`).join('')}</div>`);
    });
    const body = p.querySelector('.dash-body');
    body.append(svg, legend);
    const hi = id => { svg.classList.toggle('is-focus', !!id); svg.querySelectorAll('.dash-cell').forEach(c => c.classList.toggle('is-on', c.dataset.g === id)); };
    legend.querySelectorAll('.dash-li').forEach(b => {
      b.addEventListener('mouseenter', () => hi(b.dataset.g)); b.addEventListener('focus', () => hi(b.dataset.g));
      b.addEventListener('mouseleave', () => hi(null)); b.addEventListener('blur', () => hi(null));
    });
    grid.appendChild(p);
  }

  /* ---------- C. tokens ---------- */
  function tokens(grid) {
    const t = D.tokens;
    sources.tokens = { title: 'Token use', value: `${t.share}%`, unit: 'cached re-reads', src: t.src, conf: t.conf };
    const p = panel('dash-tokens', 'tokens', 'Token use', `${t.total} processed`, t.conf);
    const max = Math.max(t.claude, t.codex);
    p.querySelector('.dash-body').innerHTML = `
      <div class="dash-big"><span class="dash-num" data-pre="" data-target="${t.share}" data-suf="%">${t.share}%</span><span>were cached re-reads of earlier context</span></div>
      <div class="dash-split" role="img" aria-label="${t.share} percent cached, ${100 - t.share} percent fresh"><i class="dash-split-c" style="--w:${t.share}%"></i><i class="dash-split-f" style="--w:${100 - t.share}%"></i></div>
      <div class="dash-split-k"><span><i class="k-c"></i>cached ${t.share}%</span><span><i class="k-f"></i>fresh ~${100 - t.share}%</span></div>
      <dl class="dash-sys">
        <div><dt>Claude Code</dt><dd><i class="dash-hb" style="--w:${(t.claude / max) * 100}%"></i><b>${t.claude.toFixed(2)}B</b></dd></div>
        <div><dt>Codex</dt><dd><i class="dash-hb is-lb" style="--w:${(t.codex / max) * 100}%"></i><b>≥${t.codex.toFixed(2)}B</b></dd></div>
      </dl>
      <p class="dash-foot">Output written by Claude: ${t.written} tokens.</p>`;
    grid.appendChild(p);
  }

  /* ---------- D. review gate ---------- */
  function gate(grid) {
    const g = D.gate, total = g.block + g.pass + g.error;
    sources.gate = { title: 'The review gate', value: `${g.block} of ${total}`, unit: 'reviews blocked', src: g.src, conf: g.conf };
    const p = panel('dash-gate', 'gate', 'The review gate', `${total} fresh reviews with a verdict`, g.conf);
    const tiles = [...Array(g.block).fill(['BLOCK', 'b']), ...Array(g.pass).fill(['PASS', 'p']), ...Array(g.error).fill(['ERROR', 'e'])];
    p.querySelector('.dash-body').innerHTML = `
      <ol class="dash-tiles" aria-label="${g.block} blocked, ${g.pass} passed, ${g.error} errored">${tiles.map(([l, c], i) => `<li class="dash-t is-${c}" style="--i:${i}">${l}</li>`).join('')}</ol>
      <div class="dash-gate-k"><span class="is-b"><b>${g.block}</b> blocked</span><span class="is-p"><b>${g.pass}</b> passed</span><span class="is-e"><b>${g.error}</b> errored</span></div>
      <p class="dash-foot">${g.p2 + g.p3} findings: ${g.p1} P1, ${g.p2} P2, ${g.p3} P3. Half the recorded reviews stopped the change.</p>`;
    grid.appendChild(p);
  }

  /* ---------- E. tool calls ---------- */
  function tools(grid) {
    const t = D.tools, max = t.rows[0][1];
    sources.tools = { title: 'Tool calls', value: fmt(t.total), unit: 'tool calls', src: t.src, conf: t.conf };
    const p = panel('dash-tools', 'tools', `${fmt(t.total)} tool calls`, 'What the agents actually did', t.conf);
    p.querySelector('.dash-body').innerHTML = `<ul class="dash-rows">${t.rows.map(([l, v], i) =>
      `<li style="--i:${i}"><span class="dash-rl">${esc(l)}</span><span class="dash-rt"><i style="--w:${(v / max) * 100}%"></i></span><b>${fmt(v)}</b></li>`).join('')}</ul>
`;
    grid.appendChild(p);
  }

  /* ---------- F. before / after ---------- */
  function fixes(grid) {
    const f = D.fixes;
    sources.fixes = { title: 'Before and after', value: '', unit: '', src: f.src, conf: f.conf };
    const p = panel('dash-fixes', 'fixes', 'Before and after', 'Two measured comparisons', f.conf);
    const show = (v, k) => k === 'pct' ? `${v}%` : fmt(v);
    p.querySelector('.dash-body').innerHTML = f.rows.map((r, i) => {
      const lo = r.fmt === 'pct' ? 80 : 0, hi = r.fmt === 'pct' ? 100 : r.after;
      const pos = v => ((v - lo) / (hi - lo)) * 100;
      return `<div class="dash-fx" style="--i:${i}"><p class="dash-fx-l">${esc(r.label)}</p>
        <div class="dash-fx-track"><i class="dash-fx-bar" style="--a:${pos(r.before)}%;--b:${pos(r.after)}%"></i><i class="dash-fx-a" style="--x:${pos(r.before)}%"></i><i class="dash-fx-b" style="--x:${pos(r.after)}%"></i></div>
        <p class="dash-fx-v"><span>${show(r.before, r.fmt)}</span><span class="dash-fx-arrow" aria-hidden="true">→</span><b>${show(r.after, r.fmt)}</b></p>
        <p class="dash-fx-n">${esc(r.note)}</p></div>`;
    }).join('');
    grid.appendChild(p);
  }

  /* ---------- source sheet ---------- */
  function buildSheet() {
    sheet = document.createElement('aside');
    sheet.className = 'dash-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'dash-sheet-t');
    sheet.hidden = true;
    sheet.innerHTML = `<div class="dash-sheet-in"><header><p class="dash-sheet-e">Where this number comes from</p>
      <button type="button" class="dash-x" aria-label="Close source">×</button></header>
      <h3 id="dash-sheet-t"></h3><p class="dash-sheet-v"></p><dl></dl></div>`;
    document.body.appendChild(sheet);
    sheet.querySelector('.dash-x').addEventListener('click', () => closeSheet(true));
    document.addEventListener('keydown', e => {
      if (!sheet.classList.contains('is-open')) return;   // released as soon as closing starts
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(true); }
      else if (e.key === 'Tab') { e.preventDefault(); sheet.querySelector('.dash-x').focus(); }   // the close button is the panel's only control
    });
    document.addEventListener('click', e => { if (!sheet.hidden && !sheet.contains(e.target) && !e.target.closest('[data-src]')) closeSheet(false); });
  }
  let opener = null;
  function openSheet(id, from) {
    const x = sources[id];
    if (!x) return;
    opener = from;
    sheet.querySelector('h3').textContent = x.title;
    sheet.querySelector('.dash-sheet-v').innerHTML = x.value ? `<b>${esc(x.value)}</b> ${esc(x.unit)}` : '';
    sheet.querySelector('dl').innerHTML = `
      <div><dt>What it counts</dt><dd>${esc(x.src.counts)}</dd></div>
      <div><dt>How it was counted</dt><dd>${esc(x.src.method)}</dd></div>
      <div><dt>Source</dt><dd><code>${esc(x.src.source)}</code></dd></div>
      <div><dt>Confidence</dt><dd>${confBadge(x.conf)} ${esc(D.conf[x.conf].desc)}</dd></div>
      <div><dt>As of</dt><dd>${esc(D.asOf)}</dd></div>`;
    sheet.hidden = false;
    void sheet.offsetWidth;          // commit the closed position so the slide-in transition runs
    sheet.classList.add('is-open');
    root.querySelectorAll('[data-src]').forEach(b => b.classList.toggle('is-active', b.dataset.src === id));
    sheet.querySelector('.dash-x').focus({ preventScroll: true });
  }
  function closeSheet(restoreFocus) {
    sheet.classList.remove('is-open');
    root.querySelectorAll('[data-src].is-active').forEach(b => b.classList.remove('is-active'));
    setTimeout(() => { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, 260);
    if (restoreFocus && opener) opener.focus({ preventScroll: true });
  }

  /* ---------- tooltip for chart marks ---------- */
  function buildTip() {
    tip = document.createElement('div');
    tip.className = 'dash-tip';
    tip.hidden = true;
    document.body.appendChild(tip);
    root.addEventListener('pointermove', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      tip.textContent = t.dataset.tip;
      tip.hidden = false;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY - 34}px`;
    });
    root.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  /* ---------- motion ---------- */
  function countUp() {
    root.querySelectorAll('.dash-num').forEach((n, i) => {
      const target = n.dataset.target, end = Number(target.replace(/,/g, ''));
      if (!Number.isFinite(end)) return;
      const dec = (target.split('.')[1] || '').length, commas = target.includes(',');
      const render = v => {
        let str = v.toFixed(dec);
        if (commas) str = Number(str).toLocaleString('en-US');
        n.textContent = n.dataset.pre + str + n.dataset.suf;
      };
      if (reduced()) { render(end); return; }
      const t0 = performance.now() + i * 70, dur = 1400;
      render(0);
      const tick = now => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        render(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function play() {
    if (played || !root) return;
    played = true;
    root.classList.add('is-playing');
    countUp();
  }

  // Everything the renderers read. Anything missing means "don't mount" rather than a half-built slide.
  function valid(d) {
    const src = x => x && x.src && ['counts', 'method', 'source'].every(k => typeof x.src[k] === 'string');
    const conf = d && d.conf && ['M', 'R', 'E'].every(k => d.conf[k] && d.conf[k].label);
    return !!(conf && Array.isArray(d.kpis) && d.kpis.length && d.kpis.every(k => k.id && k.value && k.unit && d.conf[k.conf] && src(k))
      && d.days && [d.days.labels, d.days.months, d.days.commits, d.days.hours].every(a => Array.isArray(a) && a.length === d.days.labels.length)
      && Array.isArray(d.days.outage) && d.days.outage.length === 2 && d.days.outage.every(num) && src(d.days)
      && d.sessions && Array.isArray(d.sessions.groups) && d.sessions.groups.every(g => num(g.count)) && src(d.sessions)
      && d.tokens && num(d.tokens.share) && num(d.tokens.claude) && num(d.tokens.codex) && src(d.tokens)
      && d.gate && ['block', 'pass', 'error', 'p1', 'p2', 'p3'].every(k => num(d.gate[k])) && src(d.gate)
      && d.tools && Array.isArray(d.tools.rows) && d.tools.rows.length && num(d.tools.total) && src(d.tools)
      && d.fixes && Array.isArray(d.fixes.rows) && src(d.fixes)
      && [d.days, d.sessions, d.tokens, d.gate, d.tools, d.fixes].every(x => d.conf[x.conf]));
  }

  function mount(container, data) {
    if (!valid(data)) { console.warn('dashboard: incomplete data, using the plain metric tiles'); return false; }
    D = data;
    root = container;
    root.classList.add('dash');
    root.classList.toggle('no-motion', reduced());
    const grid = document.createElement('div');
    grid.className = 'dash-grid';
    kpis(grid);
    days(grid); sessions(grid); tokens(grid);
    gate(grid); tools(grid); fixes(grid);
    root.appendChild(grid);
    root.insertAdjacentHTML('beforeend', `<p class="dash-asof">${esc(D.asOf)}</p>`);
    buildSheet();
    buildTip();
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-src]');
      if (b) openSheet(b.dataset.src, b);
    });
    // play when the dashboard scrolls into view, even if the host page never calls play()
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { play(); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(root);
    if (reduced()) play();
    const head = root.closest('section')?.querySelector('.slide-head');
    if (head) head.insertAdjacentHTML('beforeend', `<p class="dash-legend-top"><span>Tap any number for its source</span>${['M', 'R', 'E'].map(confBadge).join('')}</p>`);
    return true;
  }

  window.WarsawDashboard = { mount, play, isOpen: () => !!sheet && sheet.classList.contains('is-open') };
})();
