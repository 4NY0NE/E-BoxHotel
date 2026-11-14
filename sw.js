/* E-BoxHotel — service worker. Funciona só em HTTPS (ou localhost); em file:// o site segue normal, sem modo offline.
   Estratégias: casca do aplicativo pré-armazenada; navegação com reserva offline; fotos do Unsplash em cache dinâmico limitado. */
'use strict';
const VERSION = 'hb-3.1.0';
const SHELL = `${VERSION}-shell`;
const PHOTOS = `${VERSION}-fotos`;
const MAX_PHOTOS = 60;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/css/base.css',
  './assets/brand/logo-mark.svg', './assets/brand/favicon.svg',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png',
  './vendor/qrcode-generator-1.4.4.js', './vendor/supabase-js-2.119.0.js', './src/core/config.js', './src/security/accounts.js',
  './src/core/util.js', './src/core/validators.js', './src/domain/catalog.js', './src/domain/pricing.js', './src/domain/booking.js',
  './src/data/storage.js', './src/security/auth.js', './src/core/app.js', './src/ui/common.js', './src/ui/client.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(caches.open(PHOTOS).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { cache.put(req, res.clone()); trim(cache); }
      return res;
    }));
    return;
  }


  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
