/* The City the Agents Built — presentation page.
   All copy comes from content.json (copied from film-v3/data/present-content.json);
   chapters and transcript come from timeline.json. GitHub Pages build: the film is embedded from FILM_URL (YouTube or Google Drive). */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;

  const CHAPTERS = {
    S01: 'Cold open', S02: 'A model', S03: 'An agent', S04: 'Graphs', S05: 'Two big ideas', S06: 'Scale',
    S07: '01 Define done', S08: '02 Context', S09: '03 Split', S10: '04 Prerequisites', S11: '05 Fresh review',
    S12: '06 Missing checks', S13: '07 Measure', S14: '08 Close the loop', S15: 'The human', S16: 'The pattern',
    S17: 'Honest + next', S18: 'End'
  };
  const FILM_URL = "";
  const MEDIA = {
    film: 'media/film.mp4', vtt: 'media/film.vtt', poster: 'media/film-poster.jpg',
    posterPlaceholder: 'media/_placeholder/film-poster.jpg', hero: 'media/hero-loop.mp4',
    clip: id => `media/clips/${id}.mp4`, clipPlaceholder: id => `media/_placeholder/${id}.mp4`
  };

  /* ---------- helpers ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (html != null) n.innerHTML = html;
    return n;
  };
  const sv = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  const probeCache = new Map();
  const exists = url => {
    if (!probeCache.has(url)) {
      probeCache.set(url, fetch(url, { method: 'HEAD' }).then(r => r.ok).catch(() => false));
    }
    return probeCache.get(url);
  };
  const playSafe = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const sentenceCase = s => s.charAt(0).toUpperCase() + s.slice(1);
  // External film: an (unlisted) YouTube video, embedded with the iframe JS API.
  const ytId = u => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(u || ''); return m ? m[1] : null; };
  const filmEmbedUrl = (t = 0, autoplay = false) => {
    const yt = ytId(FILM_URL);
    if (!yt) return null;
    const origin = encodeURIComponent(location.origin);
    return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&enablejsapi=1&origin=${origin}&start=${Math.floor(t)}${autoplay ? '&autoplay=1' : ''}`;
  };
  const filmCanSeek = () => !!ytId(FILM_URL);
  // The player reports its real state (playing / muted) through postMessage once we say we're listening,
  // so K and M always send the right command even after someone uses the player's own buttons.
  let filmPlaying = false, filmMuted = false;
  const filmFrame = () => document.querySelector('#film-embed iframe');
  const ytCommand = (func) => {
    const f = filmFrame();
    if (f && f.contentWindow) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
  };
  window.addEventListener('message', e => {
    const f = filmFrame();
    if (!f || e.source !== f.contentWindow || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    const info = d && d.info;
    if (!info || typeof info !== 'object') return;
    if (typeof info.playerState === 'number') filmPlaying = info.playerState === 1 || info.playerState === 3;
    if (typeof info.muted === 'boolean') filmMuted = info.muted;
  });
  const listenToFilm = () => {
    const f = filmFrame();
    if (!f) return;
    f.addEventListener('load', () => f.contentWindow && f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'film', channel: 'widget' }), '*'));
  };

  let content = null;
  let timeline = null;
  let shots = {};
  let filmReady = false;
  let vttReady = false;

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg, ms = 3200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  /* ---------- clip cards (muted loops, optional sound from the film) ---------- */
  function clipCard(shotId, { tall = false } = {}) {
    const shot = shots[shotId];
    const fig = el('figure', { class: 'clip' + (tall ? ' tall' : ''), 'data-shot': shotId });
    const label = CHAPTERS[shotId] || shotId;
    fig.innerHTML = `
      <video muted loop playsinline preload="none" disablepictureinpicture data-loop aria-label="Looping clip from the film: ${esc(label)}"></video>
      <div class="clip-fallback" aria-hidden="true"><span>${esc(shotId)}</span><small>clip not rendered yet</small></div>
      <span class="ph-tag" hidden>Placeholder clip</span>
      <figcaption class="clip-bar">
        <span class="clip-tag">From the film${shot ? ' &middot; ' + fmtTime(shot.start) : ''}</span>
        <button type="button" class="sound-btn" aria-pressed="false">&#9654;&#xFE0E; watch this moment</button>
      </figcaption>`;
    return fig;
  }

  async function resolveClip(fig) {
    if (fig.dataset.resolved) return;
    fig.dataset.resolved = '1';
    const id = fig.dataset.shot;
    const v = $('video', fig);
    let src = null;
    if (await exists(MEDIA.clip(id))) src = MEDIA.clip(id);
    else if (await exists(MEDIA.clipPlaceholder(id))) { src = MEDIA.clipPlaceholder(id); $('.ph-tag', fig).hidden = false; }
    if (!src) { fig.classList.add('no-media'); return; }
    fig._loopSrc = src;
    v.src = src;
    v.addEventListener('loadeddata', () => fig.classList.add('has-media'), { once: true });
    v.load();
    if (fig.closest('.slide')?.classList.contains('current') && !reduced()) playSafe(v);
  }

  function silence(fig, resume = true) {
    if (!fig.classList.contains('with-sound')) return;
    const v = $('video', fig);
    v.removeEventListener('timeupdate', fig._onTime);
    fig.classList.remove('with-sound');
    const btn = $('.sound-btn', fig);
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '&#9654;&#xFE0E; play with sound';
    v.muted = true; v.loop = true;
    v.pause();
    if (fig._loopSrc) { v.src = fig._loopSrc; v.load(); if (resume && !reduced()) playSafe(v); }
  }

  function playWithSound(fig) {
    if (!filmReady) { toast('The film link has not been added yet.'); return; }
    const sh = shots[fig.dataset.shot];
    if (!sh) return;
    filmSeek(sh.start);
    goTo(slides.indexOf($('#film')));
    return;
    // eslint-disable-next-line no-unreachable
    if (fig.classList.contains('with-sound')) { silence(fig); return; }
    const shot = shots[fig.dataset.shot];
    if (!shot) return;
    $$('.clip.with-sound').forEach(f => silence(f, false));
    const v = $('video', fig);
    const btn = $('.sound-btn', fig);
    v.loop = false; v.muted = false;
    v.src = MEDIA.film;
    v.addEventListener('loadedmetadata', () => { v.currentTime = shot.start; playSafe(v); }, { once: true });
    fig._onTime = () => { if (v.currentTime >= shot.end - 0.05) silence(fig); };
    v.addEventListener('timeupdate', fig._onTime);
    v.load();
    fig.classList.add('with-sound');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = '&#9632; back to silent loop';
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.sound-btn');
    if (btn) { playWithSound(btn.closest('.clip')); btn.blur(); return; }
    const vid = e.target.closest('.clip video');
    if (vid && !vid.closest('.with-sound')) { vid.paused ? playSafe(vid) : vid.pause(); }
  });

  /* ---------- hero ---------- */
  function initHero() {
    $('#hero-sub').textContent = content.subtitle;
    document.title = `${content.title} — presentation`;
    $('#watch-film').addEventListener('click', () => setTimeout(() => $('#game-video').blur(), 50));
    exists(MEDIA.hero).then(ok => {
      if (!ok) return;
      const v = $('#hero-video');
      v.src = MEDIA.hero;
      v.addEventListener('loadeddata', () => $('#hero').classList.add('has-video'), { once: true });
      v.load();
      if ($('#hero').classList.contains('current') && !reduced()) playSafe(v);
    });
    heroCanvas();
  }

  function heroCanvas() {
    const canvas = $('#hero-canvas');
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, nodes = [], edges = [], pulses = [], raf = 0, visible = true, last = 0;
    const ICE = '153,220,255', AMBER = '242,194,123', CORAL = '255,143,118';

    const seed = () => {
      const n = Math.max(34, Math.min(86, Math.round((w * h) / 24000)));
      nodes = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
        r: 1.6 + Math.random() * 2.2, kind: i % 17 === 0 ? 'goal' : i % 29 === 3 ? 'fail' : 'node', ph: Math.random() * 6.28
      }));
      edges = []; pulses = [];   // old edge/pulse indices refer to the previous node set
    };
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced()) draw(0);
    };
    const link = () => {
      const max = Math.min(w, h) * 0.2, max2 = max * max;
      edges = [];
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d2 = dx * dx + dy * dy;
        if (d2 < max2) edges.push([i, j, 1 - Math.sqrt(d2) / max]);
      }
    };
    const draw = t => {
      ctx.clearRect(0, 0, w, h);
      link();
      ctx.lineWidth = 1;
      for (const [i, j, a] of edges) {
        ctx.strokeStyle = `rgba(${ICE},${(a * 0.2).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
      }
      for (const p of pulses) {
        const [i, j] = p.e, a = nodes[i], b = nodes[j];
        const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        g.addColorStop(0, `rgba(${ICE},.9)`); g.addColorStop(1, `rgba(${ICE},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.283); ctx.fill();
      }
      for (const n of nodes) {
        const c = n.kind === 'goal' ? AMBER : n.kind === 'fail' ? CORAL : ICE;
        const pulse = 0.5 + 0.5 * Math.sin(t / 900 + n.ph);
        if (n.kind !== 'node') {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 26);
          g.addColorStop(0, `rgba(${c},${(0.18 + pulse * 0.16).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = `rgba(${c},${n.kind === 'node' ? 0.7 : 0.95})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.kind === 'node' ? n.r : n.r + 1.6, 0, 6.283); ctx.fill();
      }
    };
    const frame = t => {
      raf = 0;
      if (!visible || reduced() || $('#hero').classList.contains('has-video')) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      for (const n of nodes) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
      }
      if (edges.length && pulses.length < 6 && Math.random() < 0.05) pulses.push({ e: edges[(Math.random() * edges.length) | 0], t: 0 });
      pulses = pulses.filter(p => (p.t += dt * 0.55) < 1);
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && !reduced()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; kick(); }, { threshold: 0 }).observe(canvas);
    new ResizeObserver(resize).observe(canvas);
    motionQuery.addEventListener?.('change', () => { resize(); kick(); });
    resize(); kick();
  }

  /* ---------- film ---------- */
  async function initFilm() {
    const v = $('#film-video');
    const list = $('#chapter-list');
    const ids = Object.keys(CHAPTERS);
    $('#film-runtime').textContent = `${fmtTime(timeline.total)} runtime`;
    ids.forEach(id => {
      const s = shots[id];
      if (!s) return;
      const li = el('li');
      li.innerHTML = `<button type="button" data-t="${Number(s.start) || 0}" data-shot="${esc(id)}"><span class="ch-time">${fmtTime(s.start)}</span><span class="ch-name">${esc(CHAPTERS[id])}</span></button>`;
      list.appendChild(li);
    });

    // transcript, grouped by chapter, from timeline.json
    const body = $('#transcript-body');
    let current = null, group = null;
    for (const ln of timeline.lines) {
      if (ln.shot !== current) {
        current = ln.shot;
        group = el('section', { class: 'tr-group' }, `<h4>${esc(CHAPTERS[current] || current)}</h4>`);
        body.appendChild(group);
      }
      const p = el('p', {}, `<button type="button" class="ts" data-t="${Number(ln.start) || 0}">${fmtTime(ln.start)}</button> ${esc(ln.text)}`);
      group.appendChild(p);
    }

    const film = !!filmEmbedUrl();
    const [vtt, poster] = [false, true];
    filmReady = film; vttReady = vtt;
    if (!film && FILM_URL) {   // a non-YouTube link: offer it as a link instead of an embed
      const pend = $('#film-pending');
      pend.innerHTML = `<strong>Watch the film</strong><a class="btn" href="${esc(FILM_URL)}" target="_blank" rel="noopener">Open the film in a new tab</a>`;
      pend.style.pointerEvents = 'auto';
    }
    if (!poster) {
      if (await exists(MEDIA.posterPlaceholder)) { v.poster = MEDIA.posterPlaceholder; $('.film-stage .video-frame').classList.add('ph-poster'); }
      else v.removeAttribute('poster');
    }
    if (film) {
      if (vtt) {
        const t = el('track', { kind: 'captions', src: MEDIA.vtt, srclang: 'en', label: 'English', default: '' });
        v.appendChild(t);
      }
      v.hidden = true;
      const box = $('#film-embed');
      box.hidden = false;
      box.innerHTML = `<iframe src="${filmEmbedUrl(0)}" title="The City the Agents Built (film)" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      listenToFilm();
    } else {
      v.removeAttribute('controls');
      $('#film-pending').hidden = false;
      $('#chapter-list').classList.add('inactive');
    }

    const seek = t => {
      if (!filmReady) { toast('The film link has not been added yet.'); return; }
      filmSeek(t);
    };
    $('#film').addEventListener('click', e => {
      const b = e.target.closest('button[data-t]');
      if (!b) return;
      seek(Number(b.dataset.t));
      b.blur();
    });
    const buttons = $$('#chapter-list button');
    v.addEventListener('timeupdate', () => {
      const t = v.currentTime;
      let active = buttons[0];
      for (const b of buttons) if (Number(b.dataset.t) <= t + 0.05) active = b;
      buttons.forEach(b => { b.parentElement.classList.toggle('on', b === active); if (b === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    });
    // keep keys for slide navigation after using the player with the mouse
    v.addEventListener('pointerup', () => setTimeout(() => v.blur(), 0));
  }

  function filmSeek(t) {
    const frame = $('#film-embed iframe');
    if (!frame) return;
    frame.src = filmEmbedUrl(t, true);
    filmPlaying = true;
    listenToFilm();
  }

  /* ---------- game ---------- */
  function initGame() {
    const l2 = timeline.lines.find(l => l.id === 'L02');
    if (l2) {
      const m = l2.text.match(/^This is Warsaw Downtown: (.*?)\. Kiran/);
      $('#game-lede').textContent = m ? `Warsaw Downtown is ${m[1]}.` : '';
    }
    const box = $('#lightbox'), img = $('#lightbox-img');
    $$('.strip button').forEach(b => b.addEventListener('click', () => {
      img.src = b.dataset.still; img.alt = b.dataset.alt;
      box.showModal();
    }));
    box.addEventListener('click', e => { if (e.target === box || e.target.id === 'lightbox-close') box.close(); });
    for (const id of ['#game-video', '#gameplay-video']) {
      const gv = $(id);
      if (gv) gv.addEventListener('pointerup', () => setTimeout(() => gv.blur(), 0));
    }
  }

  /* ---------- metrics ---------- */
  function initMetrics() {
    const wrap = $('#metrics');
    content.metrics.forEach((m, i) => {
      const parsed = /^(~?)([\d,]+(?:\.\d+)?)(.*)$/.exec(m.value) || ['', '', m.value, ''];
      const tile = el('div', { class: 'tile reveal', role: 'listitem', style: `--d:${i * 55}ms` });
      tile.innerHTML = `
        <div class="val" aria-label="${esc(m.value + ' ' + m.unit)}">
          <span class="num" aria-hidden="true" data-prefix="${esc(parsed[1])}" data-target="${esc(parsed[2])}" data-suffix="${esc(parsed[3])}">${esc(m.value)}</span>
          <span class="unit" aria-hidden="true">${esc(m.unit)}</span>
        </div>
        <p class="lbl">${esc(m.label)}</p>
        <p class="note">${esc(m.note)}</p>`;
      wrap.appendChild(tile);
    });
  }

  let countedUp = false;
  function countUp() {
    if (countedUp) return;
    countedUp = true;
    const nums = $$('#metrics .num');
    const render = (n, v) => {
      const target = n.dataset.target;
      const dec = (target.split('.')[1] || '').length;
      const commas = target.includes(',');
      let s = v.toFixed(dec);
      if (commas) { const [a, b] = s.split('.'); s = Number(a).toLocaleString('en-US') + (b ? '.' + b : ''); }
      n.textContent = n.dataset.prefix + s + n.dataset.suffix;
    };
    if (reduced()) { nums.forEach(n => render(n, Number(n.dataset.target.replace(/,/g, '')))); return; }
    const start = performance.now();
    nums.forEach((n, i) => {
      const end = Number(n.dataset.target.replace(/,/g, ''));
      const delay = i * 55, dur = 1500;
      render(n, 0);
      const tick = now => {
        const p = Math.min(1, Math.max(0, (now - start - delay) / dur));
        const eased = 1 - Math.pow(1 - p, 4);
        render(n, end * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- basics ---------- */
  function initBasics() {
    const grid = $('#basics-grid');
    content.basics.forEach((b, i) => {
      const card = el('article', { class: 'basic panel reveal', style: `--d:${i * 110}ms` });
      card.appendChild(clipCard(b.shot));
      const body = el('div', { class: 'basic-body' }, `
        <p class="eyebrow">${String(i + 1).padStart(2, '0')}</p>
        <h3>${esc(b.name)}</h3>
        <p class="basic-line">${esc(b.line)}</p>
        <p class="basic-more">${esc(b.more)}</p>`);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  /* ---------- two big ideas ---------- */
  function initIdeas() {
    const grid = $('#ideas-grid');
    const make = (text, kind, i) => {
      const m = /^(.*?) is (designing .*?): (.*?)\.?$/.exec(text);
      const head = m ? m[1] : kind, tag = m ? m[2] : '', rest = m ? m[3] : text;
      const items = rest.split(/,\s*(?:and\s+)?/).map(sentenceCase);
      const card = el('article', { class: `idea panel reveal ${kind}`, style: `--d:${i * 140}ms` });
      card.innerHTML = `
        <svg class="idea-art" viewBox="0 0 160 160" aria-hidden="true"></svg>
        <p class="eyebrow">${esc(head)}</p>
        <h3>${esc(sentenceCase(tag))}</h3>
        <ul>${items.map((t, k) => `<li><span class="li-n">${k + 1}</span><span>${esc(t)}</span></li>`).join('')}</ul>`;
      const art = $('.idea-art', card);
      if (kind === 'agentic') {
        sv('circle', { cx: 80, cy: 80, r: 52, class: 'ring' }, art);
        sv('path', { d: 'M80 28 A52 52 0 0 1 132 80', class: 'ring hot' }, art);
        [[80, 28], [132, 80], [80, 132], [28, 80]].forEach(([x, y], k) => sv('circle', { cx: x, cy: y, r: 7, class: 'dot' + (k === 1 ? ' amber' : '') }, art));
        sv('circle', { cx: 80, cy: 80, r: 14, class: 'dot core' }, art);
      } else {
        const pts = [[34, 44], [92, 30], [130, 76], [70, 90], [38, 128], [112, 128]];
        [[0, 1], [1, 2], [0, 3], [1, 3], [3, 2], [3, 4], [3, 5], [5, 2]].forEach(([a, b]) => sv('line', { x1: pts[a][0], y1: pts[a][1], x2: pts[b][0], y2: pts[b][1], class: 'edge' }, art));
        pts.forEach(([x, y], k) => sv('circle', { cx: x, cy: y, r: k === 2 ? 9 : 6, class: 'dot' + (k === 2 ? ' amber' : '') }, art));
      }
      return card;
    };
    grid.appendChild(make(content.ideas.agentic, 'agentic', 0));
    grid.appendChild(el('div', { class: 'ideas-plus reveal', 'aria-hidden': 'true' }, '+'));
    grid.appendChild(make(content.ideas.graph, 'graph', 1));
  }

  /* ---------- principles ---------- */
  function initPrinciples() {
    const host = $('#principle-slides');
    const index = $('#principle-index');
    const P = content.principles;
    P.forEach((p, i) => {
      const id = `p-${String(p.n).replace(/[^\w-]/g, '')}`;
      const sec = el('section', { class: 'slide principle', id, 'data-title': `${p.n} ${p.title}`, 'aria-labelledby': `${id}-t` });
      sec.innerHTML = `
        <div class="inner p-grid">
          <div class="p-head">
            <ol class="tracker reveal" aria-label="Principle ${i + 1} of ${P.length}">${P.map((q, k) => `<li class="${k === i ? 'on' : k < i ? 'done' : ''}"></li>`).join('')}</ol>
            <div class="p-title reveal">
              <span class="numeral" aria-hidden="true">${esc(p.n)}</span>
              <h2 id="${id}-t">${esc(p.title)}</h2>
            </div>
            <div class="p-idea reveal"><h3 class="label">The idea</h3><p>${esc(p.idea)}</p></div>
          </div>
          <div class="p-media reveal"></div>
          <div class="p-blocks">
            <div class="blk warsaw reveal" style="--d:80ms"><h3 class="label"><i></i>In Warsaw</h3><p>${esc(p.warsaw)}</p></div>
            <div class="blk any reveal" style="--d:170ms"><h3 class="label"><i></i>In any job</h3><p>${esc(p.anyjob)}</p></div>
            <div class="blk try reveal" style="--d:260ms"><h3 class="label"><i></i>Try it</h3><p>${esc(p.try)}</p></div>
          </div>
        </div>`;
      $('.p-media', sec).appendChild(clipCard(p.shot, { tall: true }));
      host.appendChild(sec);

      const li = el('li', {}, `<a href="#${id}"><span class="ix-n">${esc(p.n)}</span><span class="ix-t">${esc(p.title)}</span></a>`);
      li.style.setProperty('--d', `${i * 60}ms`);
      index.appendChild(li);
    });
  }

  /* ---------- human ---------- */
  function initHuman() {
    const parts = content.human.split(/(?<=\.)\s+/);
    const first = parts.shift();
    $('#human-title').textContent = first;
    const rest = parts.join(' ');
    const lastDot = rest.lastIndexOf('. ', rest.length - 3);
    $('#human-rest').innerHTML = lastDot > -1
      ? `${esc(rest.slice(0, lastDot + 1))} <em>${esc(rest.slice(lastDot + 2))}</em>`
      : esc(rest);

    const svg = $('.human-art');
    const edges = $('.edges', svg), nodes = $('.nodes', svg);
    const rows = [[[210, 46]], [[90, 140], [210, 140], [330, 140]], [[40, 245], [100, 245], [160, 245], [210, 245], [260, 245], [320, 245], [380, 245]],
      [[20, 350], [60, 350], [100, 350], [140, 350], [180, 350], [220, 350], [260, 350], [300, 350], [340, 350], [380, 350]]];
    const link = (a, b, cls) => sv('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls }, edges);
    rows[0].forEach(r => rows[1].forEach(c => link(r, c, 'hot')));
    rows[1].forEach((r, i) => rows[2].forEach((c, k) => { if (Math.abs(k - (i * 2 + 1)) <= 1 || (i === 1 && k === 3)) link(r, c, 'e'); }));
    rows[2].forEach((r, i) => rows[3].forEach((c, k) => { if (Math.abs(k - i * 1.4) < 1.4) link(r, c, 'e faint'); }));
    sv('circle', { cx: 210, cy: 46, r: 30, class: 'halo' }, nodes);
    rows.forEach((row, ri) => row.forEach(([x, y]) => sv('circle', { cx: x, cy: y, r: ri === 0 ? 14 : ri === 1 ? 8 : ri === 2 ? 6 : 4.5, class: ri === 0 ? 'n amber' : 'n' }, nodes)));
  }

  /* ---------- pattern ---------- */
  const wrapLabel = (s, max = 15) => {
    const out = []; let line = '';
    s.split(' ').forEach(w => { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
    if (line) out.push(line);
    return out;
  };

  function initPattern() {
    const steps = content.pattern;
    const host = $('#pattern-diagram');
    const W = 1400, CARD_W = 176, GAP = 52, X0 = 24, Y0 = 84, CARD_H = 286;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${Y0 + CARD_H + 14}`, role: 'img', class: 'pattern-svg', 'aria-label': `The pattern in six steps: ${steps.join(', then ')}.` });
    const defs = sv('defs', {}, svg);
    const mk = (id, color) => {
      const m = sv('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      sv('path', { d: 'M1 1 L9 5 L1 9 z', fill: color }, m);
    };
    mk('arr-ice', '#99dcff'); mk('arr-amber', '#f2c27b');

    steps.forEach((label, i) => {
      const x = X0 + i * (CARD_W + GAP), cx = x + CARD_W / 2, g = sv('g', { class: 'station' + (i === 0 ? ' goal' : '') + (i === 5 ? ' loop' : ''), transform: `translate(0,0)` }, svg);
      sv('rect', { x, y: Y0, width: CARD_W, height: CARD_H, rx: 20, class: 'card' }, g);
      const num = sv('text', { x: x + 18, y: Y0 + 34, class: 'step-n' }, g); num.textContent = String(i + 1).padStart(2, '0');
      const iy = Y0 + 112;
      const ic = sv('g', { class: 'icon' }, g);
      if (i === 0) {            // goal: target
        sv('circle', { cx, cy: iy, r: 40, class: 'stroke amber' }, ic); sv('circle', { cx, cy: iy, r: 24, class: 'stroke amber' }, ic); sv('circle', { cx, cy: iy, r: 9, class: 'fill amber' }, ic);
      } else if (i === 1) {     // map: small graph
        const p = [[-34, 18], [-6, -30], [30, -6], [26, 32], [-12, 16]];
        [[0, 1], [1, 2], [2, 3], [0, 4], [4, 3], [1, 4]].forEach(([a, b]) => sv('line', { x1: cx + p[a][0], y1: iy + p[a][1], x2: cx + p[b][0], y2: iy + p[b][1], class: 'stroke thin' }, ic));
        p.forEach(([dx, dy]) => sv('circle', { cx: cx + dx, cy: iy + dy, r: 7, class: 'fill ice' }, ic));
      } else if (i === 2) {     // lanes with owners
        [-26, 0, 26].forEach((dy, k) => { sv('line', { x1: cx - 42, y1: iy + dy, x2: cx + 42, y2: iy + dy, class: 'stroke thin' }, ic); sv('circle', { cx: cx - 42 + k * 10 + 14, cy: iy + dy, r: 7, class: 'fill ice' }, ic); });
      } else if (i === 3) {     // arrows for order
        sv('circle', { cx: cx - 36, cy: iy, r: 9, class: 'fill ice' }, ic);
        sv('circle', { cx: cx + 10, cy: iy - 26, r: 9, class: 'fill ice' }, ic);
        sv('circle', { cx: cx + 10, cy: iy + 26, r: 9, class: 'fill ice' }, ic);
        sv('circle', { cx: cx + 42, cy: iy, r: 9, class: 'fill ice' }, ic);
        [[-27, -3, 1, -22], [-27, 3, 1, 22], [19, -21, 33, -6], [19, 21, 33, 6]].forEach(([a, b, c, d]) => sv('line', { x1: cx + a, y1: iy + b, x2: cx + c, y2: iy + d, class: 'stroke thin', 'marker-end': 'url(#arr-ice)' }, ic));
      } else if (i === 4) {     // checks: join, then a gate
        [-30, 0, 30].forEach(dy => { sv('circle', { cx: cx - 38, cy: iy + dy, r: 7, class: 'fill ice' }, ic); sv('line', { x1: cx - 30, y1: iy + dy, x2: cx + 8, y2: iy, class: 'stroke thin' }, ic); });
        sv('path', { d: `M${cx + 8} ${iy - 24} L${cx + 40} ${iy} L${cx + 8} ${iy + 24} L${cx - 2} ${iy} z`, class: 'stroke ice-s' }, ic);
        sv('line', { x1: cx + 40, y1: iy, x2: cx + 52, y2: iy, class: 'stroke thin' }, ic);
      } else {                  // loop back
        sv('path', { d: `M${cx + 34} ${iy - 10} A38 38 0 1 0 ${cx + 22} ${iy + 28}`, class: 'stroke ice-s', 'marker-end': 'url(#arr-ice)', fill: 'none' }, ic);
        sv('circle', { cx, cy: iy, r: 6, class: 'fill amber' }, ic);
      }
      const lines = wrapLabel(label);
      const t = sv('text', { x: cx, y: Y0 + 196, class: 'lab', 'text-anchor': 'middle' }, g);
      lines.forEach((ln, k) => { const ts = sv('tspan', { x: cx, dy: k === 0 ? 0 : 30 }, t); ts.textContent = ln; });
      if (i < steps.length - 1) sv('line', { x1: x + CARD_W + 6, y1: Y0 + CARD_H / 2, x2: x + CARD_W + GAP - 6, y2: Y0 + CARD_H / 2, class: 'link', 'marker-end': 'url(#arr-ice)' }, svg);
    });
    // loop back to the start
    const lastCx = X0 + 5 * (CARD_W + GAP) + CARD_W / 2, firstCx = X0 + CARD_W / 2;
    sv('path', { d: `M${lastCx} ${Y0 - 4} C ${lastCx} 8, ${firstCx} 8, ${firstCx} ${Y0 - 8}`, class: 'return', 'marker-end': 'url(#arr-amber)' }, svg);
    const rt = sv('text', { x: W / 2, y: 40, class: 'return-lab', 'text-anchor': 'middle' }, svg); rt.textContent = 'back to the start';
    host.appendChild(svg);

    const ol = el('ol', { class: 'pattern-steps' }, steps.map(s => `<li>${esc(s)}</li>`).join(''));
    host.appendChild(ol);

    const tbody = $('#reuse-table tbody');
    content.reuse.forEach(r => {
      const tr = el('tr', {}, `
        <th scope="row" data-label="Job">${esc(r.job)}</th>
        <td data-label="Goal">${esc(r.goal)}</td>
        <td data-label="Lanes">${esc(r.lanes)}</td>
        <td data-label="Gate">${esc(r.gate)}</td>`);
      tbody.appendChild(tr);
    });
  }

  /* ---------- honest + next ---------- */
  function initHonest() {
    const ol = $('#honest-list');
    const kinds = ['coral', 'coral', 'amber', 'ice'];
    content.honest.forEach((t, i) => {
      ol.appendChild(el('li', { class: `reveal ${kinds[i] || 'ice'}`, style: `--d:${i * 110}ms` }, `<span class="mark" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><p>${esc(t)}</p>`));
    });
  }

  function initNext() {
    const text = content.next;
    const m = /^(.*?):\s*(.*?\.)\s*(.*)$/.exec(text);
    $('#next-title').textContent = m ? m[1] : text;
    $('#next-note').innerHTML = m ? `<span class="n-lead">${esc(sentenceCase(m[2]))}</span> <span class="n-tag">${esc(m[3])}</span>` : '';

    const svg = $('.next-art');
    svg.setAttribute('viewBox', '0 0 1000 300');
    const defs = sv('defs', {}, svg);
    const mm = sv('marker', { id: 'arr-n', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    sv('path', { d: 'M1 1 L9 5 L1 9 z', fill: '#99dcff' }, mm);
    const g = sv('g', {}, svg);
    const row = (y, tag, boxes, loop) => {
      const t = sv('text', { x: 0, y: y + 8, class: 'row-tag' }, g); t.textContent = tag;
      boxes.forEach((b, i) => {
        const x = 190 + i * 290;
        sv('rect', { x, y: y - 40, width: 220, height: 80, rx: 14, class: 'bx' + (loop ? ' live' : '') }, g);
        const tt = sv('text', { x: x + 110, y: y + 9, class: 'bx-t', 'text-anchor': 'middle' }, g); tt.textContent = b;
        if (i < boxes.length - 1) sv('line', { x1: x + 226, y1: y, x2: x + 274, y2: y, class: 'ln', 'marker-end': 'url(#arr-n)' }, g);
      });
      if (loop) sv('path', { d: `M${190 + 2 * 290 + 110} ${y + 44} C ${190 + 2 * 290 + 110} ${y + 96}, ${300} ${y + 96}, ${300} ${y + 46}`, class: 'ln amber', fill: 'none', 'marker-end': 'url(#arr-n)' }, g);
    };
    row(70, 'Today', ['Read the game', 'Hand-written rules', 'Act'], false);
    row(190, 'Next', ['Observe', 'Reason', 'Act'], true);
  }

  /* ---------- slides, navigation, presenter mode ---------- */
  let slides = [];
  let currentIdx = 0;
  let navTarget = null;
  let scrollEndTimer = 0;

  function currentFromScroll() {
    const mid = innerHeight * 0.5;
    for (let i = 0; i < slides.length; i++) {
      const r = slides[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return i;
    }
    return currentIdx;
  }

  function setCurrent(i) {
    const prev = slides[currentIdx];
    const next = slides[i];
    if (prev && prev !== next) leave(prev);
    currentIdx = i;
    slides.forEach((s, k) => s.classList.toggle('current', k === i));
    enter(next);
    updateChrome();
    try { history.replaceState(null, '', '#' + next.id); } catch { /* ignore */ }
  }

  function enter(slide) {
    slide.classList.add('seen');
    if (!reduced()) {
      $$('video[data-loop], video[data-autoplay], .hero-video', slide).forEach(v => { if (v.src || v.currentSrc) playSafe(v); });
    }
    $$('.clip', slide).forEach(resolveClip);
    if (slide.id === 'numbers') countUp();
  }

  function leave(slide) {
    if (slide.id === 'film') { ytCommand('pauseVideo'); filmPlaying = false; }
    $$('.clip.with-sound', slide).forEach(f => silence(f, false));
    $$('video', slide).forEach(v => { if (!v.paused) v.pause(); });
  }

  function updateChrome() {
    const n = slides.length;
    $('#progress i').style.transform = `scaleX(${n > 1 ? currentIdx / (n - 1) : 1})`;
    $('#counter b').textContent = String(currentIdx + 1).padStart(2, '0');
    $('#counter span').textContent = String(n).padStart(2, '0');
    const cur = slides[currentIdx];
    const links = $$('.chrome nav a');
    let active = null;
    links.forEach(a => {
      const t = $(a.getAttribute('href'));
      if (t && slides.indexOf(t) <= currentIdx) active = a;
    });
    links.forEach(a => { if (a === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    navTarget = i;
    slides[i].scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => { navTarget = null; }, 900);
  }
  const step = d => goTo((navTarget ?? currentIdx) + d);

  function onScroll() {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => { navTarget = null; }, 180);
    if (onScroll.queued) return;
    onScroll.queued = true;
    requestAnimationFrame(() => {
      onScroll.queued = false;
      const i = currentFromScroll();
      if (i !== currentIdx) setCurrent(i);
    });
  }

  function setPresenting(on, quiet) {
    document.documentElement.classList.toggle('presenting', on);
    const b = $('#present-toggle');
    b.setAttribute('aria-pressed', String(on));
    try { sessionStorage.setItem('present-mode', on ? '1' : '0'); } catch { /* ignore */ }
    slides[currentIdx]?.scrollIntoView({ block: 'start' });
    if (!quiet) toast(on
      ? 'Presenter mode. → Space next · ← back · F fullscreen · K play/pause · P exit'
      : 'Presenter mode off', on ? 4200 : 1800);
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => toast('Fullscreen was blocked by the browser.'));
    } catch { /* ignore */ }
  }

  function activeVideo() {
    const s = slides[currentIdx];
    return $('#film-video', s) || $('#game-video', s) || $('#gameplay-video', s) || $('.clip video', s);
  }

  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if ($('#lightbox').open) return;
    const t = e.target;
    const typing = t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    if (typing) return;
    const interactive = t.closest && t.closest('button, a, summary, video');
    const presenting = document.documentElement.classList.contains('presenting');
    const key = e.key;
    let handled = true;
    if (key === 'ArrowRight' || key === 'PageDown') step(1);
    else if (key === 'ArrowLeft' || key === 'PageUp') step(-1);
    else if (key === ' ' || key === 'Spacebar') { if (interactive) return; step(e.shiftKey ? -1 : 1); }
    else if (presenting && key === 'ArrowDown') step(1);
    else if (presenting && key === 'ArrowUp') step(-1);
    else if (key === 'Home') goTo(0);
    else if (key === 'End') goTo(slides.length - 1);
    else if (key === 'f' || key === 'F') toggleFullscreen();
    else if (key === 'p' || key === 'P') setPresenting(!presenting);
    else if ((key === 'k' || key === 'K') && slides[currentIdx]?.id === 'film' && $('#film-embed iframe')) { filmPlaying = !filmPlaying; ytCommand(filmPlaying ? 'playVideo' : 'pauseVideo'); }
    else if ((key === 'm' || key === 'M') && slides[currentIdx]?.id === 'film' && $('#film-embed iframe')) { filmMuted = !filmMuted; ytCommand(filmMuted ? 'mute' : 'unMute'); }
    else if (key === 'k' || key === 'K') { const v = activeVideo(); if (v && (v.src || v.currentSrc)) v.paused ? playSafe(v) : v.pause(); }
    else if (key === 'm' || key === 'M') { const v = activeVideo(); if (v) v.muted = !v.muted; }
    else handled = false;
    if (handled) e.preventDefault();
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    $$('.reveal').forEach(n => io.observe(n));
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      [content, timeline] = await Promise.all([
        fetch('content.json').then(r => { if (!r.ok) throw new Error('content.json'); return r.json(); }),
        fetch('timeline.json').then(r => { if (!r.ok) throw new Error('timeline.json'); return r.json(); })
      ]);
    } catch (err) {
      $('#main').insertAdjacentHTML('afterbegin', `<p class="noscript">Could not load ${esc(err.message)}. Serve this page over HTTP (node server.mjs).</p>`);
      return;
    }
    timeline.shots.forEach(s => { shots[s.id] = s; });

    initHero(); await initFilm(); initGame(); initMetrics(); initBasics(); initIdeas();
    initPrinciples(); initHuman(); initPattern(); initHonest(); initNext();
    initReveal();

    slides = $$('.slide');
    slides.forEach(s => { if (!s.id) s.id = 's-' + slides.indexOf(s); });

    // lazy-resolve clips shortly before they are needed
    const near = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { resolveClip(en.target); near.unobserve(en.target); }
    }), { rootMargin: '120% 0px' });
    $$('.clip').forEach(c => near.observe(c));

    // game video autoplays (muted) when its slide is active
    const gv = $('#game-video');
    gv.src = 'media/gameplay.mp4'; gv.preload = 'metadata';
    const rv = $('#gameplay-video');
    if (rv) { rv.src = 'media/gameplay-raw.mp4'; rv.preload = 'metadata'; }

    $('#present-toggle').addEventListener('click', e => { setPresenting(!document.documentElement.classList.contains('presenting')); e.currentTarget.blur(); });
    document.addEventListener('keydown', onKey);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    motionQuery.addEventListener?.('change', () => { if (reduced()) $$('video[data-loop], .hero-video').forEach(v => v.pause()); });

    let start = 0;
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) { const i = slides.findIndex(s => s.id === hash); if (i > -1) start = i; }
    currentIdx = start;
    setCurrent(start);
    if (hash) slides[start].scrollIntoView({ block: 'start' });

    let wantPresent = new URLSearchParams(location.search).get('present') === '1';
    try { wantPresent = wantPresent || sessionStorage.getItem('present-mode') === '1'; } catch { /* ignore */ }
    if (wantPresent) setPresenting(true, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
