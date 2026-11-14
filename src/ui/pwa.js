/**
 * E-BoxHotel — instalação como aplicativo (PWA).
 * Registra o service worker (somente em HTTPS/localhost) e mostra o botão "Instalar aplicativo" quando o navegador permite.
 */
(function (root) {
  'use strict';
  const HB = root.HB;
  const $ = HB.ui.$;

  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  let deferred = null;
  const btn = $('#install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e;
    if (btn) btn.hidden = false;
  });
  if (btn) btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null; btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; });
})(typeof window !== 'undefined' ? window : globalThis);
