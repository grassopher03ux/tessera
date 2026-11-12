/* ════════════════════════════════════════════════════════════════
   TESSERA — splash di avvio
   Il logo si disegna in 5 secondi (animazione in style.css, blocco SPLASH).
   Non si puo' saltare: per 5 s tastiera e clic sono fermati, poi sfuma.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var s = document.getElementById('splash');
  if (!s) return;
  var block = function (e) { e.stopImmediatePropagation(); e.preventDefault(); };
  window.addEventListener('keydown', block, true);
  window.addEventListener('keyup', block, true);
  setTimeout(function () {
    s.classList.add('out');
    window.removeEventListener('keydown', block, true);
    window.removeEventListener('keyup', block, true);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 550);
  }, 5000);
})();
