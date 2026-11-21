/* 학생 필기 · 용어 찾기 연결 (student-notes 스킬, study.js)
   결과(해설) 화면이 그려질 때마다 도구를 다시 붙인다. 필기는 브라우저 localStorage 'mp-notes-v1:sr-ch<장>-results'에 저장된다. */
(function () {
  'use strict';
  if (!window.PTX_STUDY || typeof window.render !== 'function') return;
  var GL = null, XIDX = null;
  function glossFor() {
    return GL || (GL = (window.SR_GLOSSARY || []).map(function (g) {
      var ab = (String(g[1] || '').match(/\b[A-Z][A-Z0-9]{1,7}\b/g) || []);
      var a = (g[2] || []).concat(ab).filter(function (x, i, arr) { return x !== g[0] && arr.indexOf(x) === i; });
      return { t: g[0], en: g[1], a: a, d: g[3], ch: g[4] };
    }));
  }
  function plain(h) { var d = document.createElement('div'); d.innerHTML = String(h == null ? '' : h); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function crossIndex() {
    if (XIDX) return XIDX; XIDX = [];
    chapters.forEach(function (c) {
      (c.lessons || []).forEach(function (l) {
        var txt = [l.name, l.takeaway, l.review].concat(l.paragraphs || []).concat((l.rows || []).map(function (r) { return r.join(' '); })).concat(l.flow || []).map(plain).join(' ').replace(/[₀-₉]/g, function (d) { return String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)); });
        XIDX.push({ ch: c.id, href: '#sr-ch-' + c.id, t: l.name, txt: txt });
      });
    });
    return XIDX;
  }
  function crossSearch(terms) {
    var out = [], ts = (terms || []).filter(function (t) { return t && t.length >= 2; }).map(function (t) { return t.toLowerCase(); });
    if (!ts.length) return out;
    crossIndex().forEach(function (x) {
      if (x.ch === selectedChapter) return;
      var lo = x.txt.toLowerCase(), p = -1, w = '';
      ts.forEach(function (t) { var q = lo.indexOf(t); if (q >= 0 && (p < 0 || q < p)) { p = q; w = t; } });
      if (p < 0) return;
      var a = Math.max(0, p - 24), z = Math.min(x.txt.length, p + w.length + 36);
      out.push({ href: x.href, label: x.ch + '장', t: x.t, snip: (a > 0 ? '…' : '') + escH(x.txt.slice(a, p)) + '<mark>' + escH(x.txt.slice(p, p + w.length)) + '</mark>' + escH(x.txt.slice(p + w.length, z)) + (z < x.txt.length ? '…' : '') });
    });
    return out;
  }
  function mount() {
    var bar = document.getElementById('stBar'), keep = bar && !bar.hidden ? ((document.querySelector('#stBar [data-t][aria-pressed=true]') || {}).dataset || {}).t || 'pen' : null;
    var memo = !!(document.getElementById('stPanel') && !document.getElementById('stPanel').hidden);
    if (view !== 'results' || !document.querySelector('#app article.result')) { PTX_STUDY.unmount(); return; }
    var h = document.querySelector('#app > h1'), nx = h && h.nextElementSibling;
    if (nx && nx.matches('p.muted')) h = nx;
    if (h && !document.querySelector('#app > .st-tools')) h.insertAdjacentHTML('afterend', '<div class="st-tools"></div>');
    var arts = [].slice.call(document.querySelectorAll('#app article.result'));
    PTX_STUDY.mount({
      app: 'sr-ch' + selectedChapter + '-results', slides: '#app article.result', activeClass: 'st-none',
      mount: '#app > .st-tools', medical: true, title: '스포츠재활 ' + selectedChapter + '장 ' + title + ' · 해설',
      goTo: function (i) { var a = arts[i]; if (!a) return; [].forEach.call(a.querySelectorAll('details'), function (d) { d.open = true; }); a.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      glossary: glossFor(), chLabel: function (n) { return n + '장'; }, hereLabel: '이 화면에서 나오는 곳', crossSearch: crossSearch,
      parts: { study: true, lookup: true, edit: false }
    });
    if (keep && window.STUDY) { window.STUDY.setOpen(true); window.STUDY.setTool(keep); if (memo) window.STUDY.showMemo(true); }
  }
  var orig = window.render;
  window.render = function () { var r = orig.apply(this, arguments); try { mount(); } catch (e) { console.error(e); } return r; };
  window.addEventListener('hashchange', function () {
    var m = /^#sr-ch-(\d+)$/.exec(location.hash); if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    var id = +m[1], s = stored(id);
    selectChapter(id);
    go(s && s.submitted ? 'results' : 'chapter');
  });
  try { mount(); } catch (e) { console.error(e); }
})();
