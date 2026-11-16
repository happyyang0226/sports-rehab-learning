/* 청암대학교 물리치료과 · 대학 테마 키트 (상단 띠 · 하단 정보 · 배너)
   사용: <link rel="stylesheet" href="univ-kit/univ-kit.css">
         <script src="univ-kit/univ-kit.js" data-family="ptbase" data-app="기능해부학" defer></script>
   data-family : ptbase | learning | aidx | quest   (앱별 색 연결 방식)
   data-app    : 상단 띠·하단 정보에 보일 앱 이름
   data-hero-from : (선택) 이 요소의 제목과 바로 다음 문단을 캠퍼스 배너로 바꿈. 예: ".wrap > h1"
   data-footer : off 이면 하단 정보를 넣지 않음 */
(function () {
  var s = document.currentScript, d = (s && s.dataset) || {};
  var B = { univ: '청암대학교', dept: '물리치료과', site: 'https://www.ca.ac.kr', portal: 'https://pt-exercise.vercel.app/portal.html' };
  var base = s && s.src ? s.src.replace(/[^\/]*$/, '') : '';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var b = document.body; if (!b) return;
    b.classList.add('univ-kit'); if (d.family) b.setAttribute('data-univ', d.family);
    b.style.setProperty('--u-art', 'url("' + base + 'campus.svg")'); b.style.setProperty('--u-logo', 'url("' + base + 'logo.png")');
    var app = d.app || document.title.split(/[|·—-]/)[0].trim();
    if (!document.querySelector('.uk-util')) {
      var u = document.createElement('div'); u.className = 'uk-util';
      u.innerHTML = '<div class="uk-in"><span><b>' + esc(B.univ) + '</b> · ' + esc(B.dept) + ' · ' + esc(app) + '</span><span class="uk-links"><a href="' + B.portal + '">학습 포털</a><a href="' + B.site + '" target="_blank" rel="noopener">대학 홈페이지 ↗</a></span></div>';
      b.insertBefore(u, b.firstChild);
    }
    if (d.footer !== 'off' && !document.querySelector('.uk-foot')) {
      var f = document.createElement('footer'); f.className = 'uk-foot';
      f.innerHTML = '<div class="uk-in"><div class="uk-fb"><span class="uk-logo"><img src="' + base + 'logo.png" alt="' + esc(B.univ) + ' 로고"></span><div><b>' + esc(B.univ) + ' ' + esc(B.dept) + '</b><small>' + esc(app) + ' · 수업용 학습 웹앱</small></div></div>' +
        '<nav><a href="' + B.portal + '">물리치료과 학습 포털</a><a href="' + B.site + '" target="_blank" rel="noopener">대학 홈페이지</a></nav><small class="uk-copy">© ' + new Date().getFullYear() + ' ' + esc(B.univ) + ' ' + esc(B.dept) + '</small></div>';
      b.appendChild(f);
    }
    if (d.heroFrom) {
      var h = document.querySelector(d.heroFrom);
      if (h && !h.closest('.uk-hero')) {
        var p = h.nextElementSibling && h.nextElementSibling.tagName === 'P' ? h.nextElementSibling : null;
        var sec = document.createElement('section'); sec.className = 'uk-hero';
        sec.innerHTML = '<div class="uk-hin"><span class="uk-kick">' + esc(B.univ + ' ' + B.dept) + '</span></div>';
        h.parentNode.insertBefore(sec, h);
        var inner = sec.firstChild; inner.appendChild(h); if (p) inner.appendChild(p);
      }
    }
  });
})();
