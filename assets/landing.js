// Landing page motion: hero maker-checker simulation, scroll chrome, reveals and count-ups.
// Every number on the page is already final in the HTML; this file only animates towards it.
(() => {
  const root = document.documentElement;
  const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window;
  if (motion) root.classList.add("motion");

  /* ---------- chrome: scrolled state, progress bar, active section ---------- */
  const chrome = document.getElementById("chrome");
  const bar = document.querySelector(".progress i");
  const navLinks = [...document.querySelectorAll(".chrome nav a")];
  const onScroll = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    chrome.classList.toggle("scrolled", y > 24);
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const sections = navLinks.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const navIO = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) {
      navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(s => navIO.observe(s));

  /* ---------- reveals, bars, count-ups, ring ---------- */
  const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US");
  const countUp = el => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = 1400;
    const tick = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(end * e, dec);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const ringUp = ring => {
    const fg = ring.querySelector(".fg"), c = 2 * Math.PI * +fg.getAttribute("r"), pct = +ring.dataset.pct;
    fg.style.strokeDasharray = c;
    fg.style.strokeDashoffset = c;
    fg.getBoundingClientRect();
    fg.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.2,.7,.1,1)";
    fg.style.strokeDashoffset = c * (1 - pct / 100);
  };
  if (motion && "IntersectionObserver" in window) {
    document.querySelectorAll("[data-count]").forEach(el => {
      const sr = document.createElement("span");
      sr.className = "sr-only"; sr.textContent = el.textContent;
      el.after(sr); el.setAttribute("aria-hidden", "true");
      el.textContent = fmt(0, +(el.dataset.dec || 0));
    });
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        el.classList.add("in");
        el.querySelectorAll("[data-count]").forEach(countUp);
        if (el.matches("[data-count]")) countUp(el);
        el.querySelectorAll(".ring").forEach(ringUp);
        el.querySelectorAll(".dots i.on").forEach((d, i) => { d.style.transitionDelay = `${i * 45}ms`; });
        io.unobserve(el);
      }
    }, { threshold: .18 });
    document.querySelectorAll(".reveal, .grow, .dots-wrap, .gantt, .stats, [data-count]").forEach(el => io.observe(el));
  }

  /* ---------- Source popovers: Escape or a tap outside closes them ---------- */
  const closeAll = except => document.querySelectorAll("details.src[open]").forEach(d => { if (d !== except) d.open = false; });
  addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
  addEventListener("click", e => closeAll(e.target.closest("details.src")));

  /* ---------- hero: maker-checker simulation ---------- */
  const canvas = document.getElementById("hero-canvas");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const ICE = "153,220,255", CORAL = "255,143,118", MINT = "143,227,180", AMBER = "242,194,123";
  let W = 0, H = 0, DPR = 1, nodes = [], mobile = false;
  const MONO = getComputedStyle(document.body).getPropertyValue("--mono");
  const NODE_DEF = [
    { id: "spec", label: "Spec" },
    { id: "maker", label: "Maker" },
    { id: "checks", label: "Code checks" },
    { id: "checker", label: "Checker" },
    { id: "ship", label: "Shipped" },
  ];
  function layout() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    mobile = W < 860;
    const pos = mobile
      ? [[.12, .14], [.32, .2], [.52, .13], [.72, .2], [.9, .13]]
      : [[.53, .34], [.64, .52], [.75, .36], [.85, .55], [.94, .38]];
    nodes = NODE_DEF.map((n, i) => ({ ...n, x: pos[i][0] * W, y: pos[i][1] * H }));
  }
  const N = id => nodes.find(n => n.id === id);
  // quadratic edge helpers
  const ctrl = (a, b, bend) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + bend });
  const qpt = (a, c, b, t) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  const FWD = [["spec", "maker"], ["maker", "checks"], ["checks", "checker"], ["checker", "ship"]];
  const BACK = [["checks", "maker"], ["checker", "maker"]];
  const bendOf = (from, to, back) => back ? (mobile ? 70 : 120) * (to === "maker" && from === "checker" ? 1.25 : 1) : 0;

  let packets = [], passed = 0, sentBack = 0, last = 0, spawnAt = 0;
  function spawn() { packets.push({ from: "spec", to: "maker", t: 0, back: false, life: 1, speed: .55 + Math.random() * .25, retried: 0 }); }
  function route(p) {
    if (p.to === "maker") return { from: "maker", to: "checks", back: false };
    if (p.to === "checks") {
      if (Math.random() < (p.retried ? .05 : .14)) return { from: "checks", to: "maker", back: true };
      return { from: "checks", to: "checker", back: false };
    }
    if (p.to === "checker") {
      if (Math.random() < (p.retried ? .05 : .16)) return { from: "checker", to: "maker", back: true };
      return { from: "checker", to: "ship", back: false };
    }
    return null;
  }
  function step(dt) {
    for (const p of packets) {
      if (p.done) { p.life -= dt * 1.4; continue; }
      p.t += dt * p.speed * (p.back ? .8 : 1);
      if (p.t >= 1) {
        if (p.back) { sentBack++; p.retried++; }
        const next = route(p);
        if (!next) { p.done = true; passed++; continue; }
        Object.assign(p, next, { t: 0 });
      }
    }
    packets = packets.filter(p => !p.done || p.life > 0);
  }
  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    const alpha = mobile ? .5 : 1;
    // edges
    for (const [f, t] of FWD) { const a = N(f), b = N(t); ctx.strokeStyle = `rgba(${ICE},${.28 * alpha})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.setLineDash([4, 7]);
    for (const [f, t] of BACK) { const a = N(f), b = N(t), c = ctrl(a, b, bendOf(f, t, true)); ctx.strokeStyle = `rgba(${CORAL},${.32 * alpha})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke(); }
    ctx.setLineDash([]);
    // nodes
    for (const n of nodes) {
      const isCheck = n.id === "checks" || n.id === "checker", col = isCheck ? MINT : n.id === "ship" ? AMBER : ICE;
      const pulse = .5 + .5 * Math.sin(time / 900 + n.x);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 46);
      g.addColorStop(0, `rgba(${col},${.22 * alpha})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 46, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(6,12,21,.9)"; ctx.strokeStyle = `rgba(${col},${(.55 + .3 * pulse) * alpha})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(n.x, n.y, mobile ? 8 : 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(${col},${.95 * alpha})`; ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, 7); ctx.fill();
      if (!mobile) {
        ctx.font = "500 11px " + MONO;
        ctx.fillStyle = `rgba(${col},.9)`; ctx.textAlign = "center";
        ctx.fillText(n.label.toUpperCase(), n.x, n.y + 34);
      }
    }
    // packets
    for (const p of packets) {
      const a = N(p.done ? "ship" : p.from), b = N(p.done ? "ship" : p.to);
      const c = p.back ? ctrl(a, b, bendOf(p.from, p.to, true)) : ctrl(a, b, 0);
      const pt = p.done ? { x: b.x, y: b.y } : qpt(a, c, b, p.t);
      const col = p.back ? CORAL : p.done ? AMBER : ICE, r = p.done ? 3 + (1 - p.life) * 22 : 3.2;
      ctx.shadowColor = `rgba(${col},.9)`; ctx.shadowBlur = 14;
      ctx.fillStyle = `rgba(${col},${(p.done ? p.life * .55 : .95) * alpha})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, 7);
      if (p.done) { ctx.lineWidth = 1.5; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); } else ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  let running = false, visible = true;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    if (t > spawnAt) { spawn(); spawnAt = t + 650 + Math.random() * 500; }
    step(dt); draw(t);
    requestAnimationFrame(frame);
  }
  function start() { if (running || !motion || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(frame); }
  function stop() { running = false; }
  layout();
  if (motion) {
    for (let i = 0; i < 6; i++) { spawn(); packets[packets.length - 1].t = Math.random(); }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    start();
  } else {
    // a still frame: a few items in flight, one being sent back
    packets = [
      { from: "spec", to: "maker", t: .5 }, { from: "maker", to: "checks", t: .35 }, { from: "checks", to: "checker", t: .6 },
      { from: "checker", to: "ship", t: .4 }, { from: "checker", to: "maker", t: .45, back: true },
    ];
    draw(0);
  }
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (!running) draw(0); }, 120); });
})();
