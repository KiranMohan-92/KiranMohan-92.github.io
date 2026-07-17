/* deck runtime: hash routing (#/N), keyboard, swipe, progress, persistence */
(function () {
  'use strict';
  var deck = document.querySelector('.deck');
  if (!deck) return;
  var slides = Array.prototype.slice.call(deck.querySelectorAll(':scope > .slide'));
  var total = slides.length;
  var KEY = 'loopdeck-pos';
  var cur = -1;

  var bar = document.createElement('div');
  bar.className = 'progress-bar';
  var fill = document.createElement('span');
  bar.appendChild(fill);
  document.body.appendChild(bar);

  var nav = document.createElement('div');
  nav.className = 'deck-nav';
  function mkBtn(dir, label, path) {
    var b = document.createElement('button');
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
    b.addEventListener('click', function () { step(dir); });
    return b;
  }
  nav.appendChild(mkBtn(-1, 'Previous slide', 'M15 18l-6-6 6-6'));
  nav.appendChild(mkBtn(1, 'Next slide', 'M9 18l6-6-6-6'));
  document.body.appendChild(nav);

  function clamp(n) { return Math.max(0, Math.min(total - 1, n)); }

  function apply(n) {
    n = clamp(n);
    if (n === cur) return;
    cur = n;
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === n); });
    fill.style.width = ((n + 1) / total * 100) + '%';
    try { localStorage.setItem(KEY, String(n)); } catch (e) {}
    var want = '#/' + (n + 1);
    if (location.hash !== want) {
      try { history.replaceState(null, '', want); } catch (e) { location.hash = want; }
    }
  }

  function fromHash() {
    var m = location.hash.match(/^#\/(\d+)/);
    return m ? clamp(parseInt(m[1], 10) - 1) : null;
  }
  function step(d) { apply(cur + d); }

  window.addEventListener('hashchange', function () {
    var h = fromHash();
    if (h !== null) apply(h);
  });

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var interactive = t && t.closest && t.closest('button,a,[role="button"]');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown':
        e.preventDefault(); step(1); break;
      case ' ':
        if (interactive) return;
        e.preventDefault(); step(1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); step(-1); break;
      case 'Home': e.preventDefault(); apply(0); break;
      case 'End': e.preventDefault(); apply(total - 1); break;
    }
  });

  var tx = null, ty = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    tx = ty = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  var start = fromHash();
  if (start === null) {
    try {
      var s = parseInt(localStorage.getItem(KEY), 10);
      if (!isNaN(s)) start = clamp(s);
    } catch (e) {}
  }
  apply(start === null ? 0 : start);
  window.deckGo = apply;
})();
