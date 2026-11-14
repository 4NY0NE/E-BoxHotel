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

  // iPhone/iPad (Safari) não oferece o botão de instalar: mostra o caminho manual, uma vez, fora do app já instalado.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (btn && ios && !standalone) {
    btn.hidden = false;
    btn.addEventListener('click', () => { if (!deferred) HB.ui.toast('No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".'); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
