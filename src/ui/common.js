/**
 * E-BoxHotel — recursos de interface compartilhados (cliente e gestão).
 * Camada: apresentação. Ilustrações, tema, avisos, QR code e montagem da aplicação.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { hash32, escapeHtml } = HB.util;

  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

  /** Ilustração vetorial determinística de cada hotel (sem imagens externas). */
  function scene(type, hue, uid) {
    const r = hash32(uid);
    const rnd = (i) => ((r >>> (i % 24)) & 255) / 255;
    let g = `<defs><linearGradient id="sk${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},40%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 20) % 360},50%,86%)"/></linearGradient></defs><rect width="400" height="240" fill="url(#sk${uid})"/><circle cx="${290 + rnd(3) * 70}" cy="${60 + rnd(5) * 30}" r="24" fill="#fff6d6" opacity=".9"/>`;
    if (type === 'city') {
      let x = -10;
      for (let i = 0; i < 11; i++) {
        const w = 34 + rnd(i) * 26;
        const h = 70 + rnd(i + 7) * 110;
        g += `<rect x="${x}" y="${240 - h}" width="${w}" height="${h}" fill="hsl(${hue},30%,${22 + (i % 3) * 6}%)"/>`;
        for (let y = 240 - h + 10; y < 228; y += 16) for (let k = 6; k < w - 8; k += 12) if (rnd(y + k + i) > 0.45) g += `<rect x="${x + k}" y="${y}" width="5" height="7" fill="#f0cf85"/>`;
        x += w + 4;
      }
    } else if (type === 'sea') {
      g += `<rect y="140" width="400" height="100" fill="hsl(${hue},45%,40%)"/>`;
      for (let i = 0; i < 5; i++) g += `<path d="M-10 ${158 + i * 18} q30 -10 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>`;
      g += `<rect x="40" y="70" width="46" height="100" fill="hsl(${hue},20%,25%)"/><rect x="92" y="95" width="38" height="75" fill="hsl(${hue},20%,32%)"/>`;
      for (let y = 80; y < 160; y += 14) g += `<rect x="48" y="${y}" width="30" height="5" fill="#d3e6f7" opacity=".8"/>`;
    } else if (type === 'falls') {
      g += `<path d="M0 240 L0 150 L90 80 L170 150 L240 100 L330 170 L400 120 L400 240Z" fill="hsl(${hue},30%,28%)"/><rect x="150" y="120" width="70" height="120" fill="#fff" opacity=".85"/><rect x="170" y="120" width="8" height="120" fill="hsl(${hue},30%,70%)" opacity=".6"/><rect x="195" y="120" width="8" height="120" fill="hsl(${hue},30%,70%)" opacity=".6"/>`;
    } else {
      g += `<rect y="170" width="400" height="70" fill="hsl(${hue},30%,22%)"/>`;
      for (let i = 0; i < 14; i++) {
        const x = i * 30 + rnd(i) * 10;
        const h = 70 + rnd(i + 3) * 70;
        g += `<path d="M${x} 180 l22 -${h} l22 ${h}z" fill="hsl(${hue},35%,${20 + (i % 4) * 5}%)"/>`;
      }
      g += '<rect x="170" y="150" width="60" height="42" fill="#7a4b2a"/><path d="M162 152 L200 122 L238 152Z" fill="#8f3a2d"/><rect x="192" y="166" width="16" height="26" fill="#f0cf85"/>';
    }
    return `<svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustração do hotel">${g}</svg>`;
  }

  /** Gera um QR Code como SVG usando a biblioteca local (vendor/). */
  function qrSvg(text) {
    try {
      const q = root.qrcode(0, 'M');
      q.addData(text);
      q.make();
      return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch {
      return '<p class="small muted">QR Code indisponível.</p>';
    }
  }

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  /** Tema: automático (preferência do sistema), claro ou escuro. Guardado só neste navegador. */
  function initTheme(app) {
    const apply = (t) => { if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
    const saved = app.store.getPrefs().theme;
    apply(saved);
    const btn = $('#theme-btn');
    if (!btn) return;
    const label = (t) => (t === 'dark' ? 'Tema: escuro' : t === 'light' ? 'Tema: claro' : 'Tema: automático');
    btn.textContent = label(saved);
    btn.addEventListener('click', () => {
      const cur = app.store.getPrefs().theme;
      const next = cur === 'light' ? 'dark' : cur === 'dark' ? undefined : 'light';
      app.store.setPrefs({ theme: next || 'auto' });
      apply(next);
      btn.textContent = label(next);
    });
  }

  /** Cria a aplicação com armazenamento do navegador e relógio ajustável (modo demonstração). */
  function bootstrap() {
    const local = HB.storage.browserBackend('localStorage');
    const sess = HB.storage.browserBackend('sessionStorage');
    const clock = {
      override: null,
      now: () => Date.now(),
      today() { return this.override || HB.util.toIsoDate(new Date()); },
    };
    // Códigos de reserva e PINs usam o gerador criptográfico do navegador (Math.random é previsível).
    const random = () => (root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random());
    const app = HB.createApp({ backend: local.backend, sessionBackend: sess.backend, clock, random });
    const accounts = HB.accounts ? HB.accounts.createAccounts({ backend: local.backend, clock, config: HB.config, sdk: root.supabase }) : null;
    return { app, clock, persistent: local.persistent, accounts };
  }

  /**
   * Fotografia com reserva: a ilustração fica por baixo e a foto por cima; se a foto não carregar
   * (sem internet, bloqueio), o evento de erro remove a <img> e a ilustração continua visível.
   */
  function picture(type, hue, uid, key, w, withCredit) {
    const p = key && HB.catalog.PHOTOS[key];
    if (!p) return scene(type, hue, uid);
    const credit = withCredit ? `<a class="credit" href="${p.page}" target="_blank" rel="noopener noreferrer">Foto: ${escapeHtml(p.author)} / Unsplash</a>` : '';
    return `<div class="photo">${scene(type, hue, uid)}<img data-ph="1" src="${HB.catalog.photoUrl(key, w)}" alt="${escapeHtml(p.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${credit}</div>`;
  }
  document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.dataset.ph) t.remove(); }, true);

  /**
   * Planta baixa esquemática gerada a partir das medidas (ambientes empilhados, comprimento x largura em metros).
   * Desenho próprio: parede, mobiliário básico para "quarto" e "banheiro", cotas externas.
   */
  function planSvg(plan, uid) {
    const K = 60; const PADL = 44; const PADT = 34; const WALL = 5;
    const tot = HB.catalog.planTotals(plan);
    const W = tot.width * K; const H = tot.length * K;
    const vw = PADL + W + 20; const vh = PADT + H + 22;
    const m = HB.catalog.meters;
    let y = 0; let g = '';
    const mk = (cls, x, yy, w, h, extra) => `<rect class="${cls}" x="${x}" y="${yy}" width="${w}" height="${h}" ${extra || ''}/>`;
    plan.forEach((a, i) => {
      const w = a.width * K; const h = a.length * K; const x0 = (W - w) / 2; const n = a.name.toLowerCase();
      const quarto = n.includes('quarto') || n.includes('suíte') || n.includes('suite'); const wc = n.includes('banheiro') || n.includes('lavabo');
      g += mk(wc ? 'pl-wet' : quarto ? 'pl-bed' : 'pl-room', x0, y, w, h);
      if (quarto && h >= 150 && w >= 120) {
        const bw = Math.min(1.6 * K, w - 70); const bx = x0 + (w - bw) / 2;
        g += mk('pl-furn', bx, y + 18, bw, 2 * K, 'rx="4"') + mk('pl-pillow', bx + 6, y + 24, bw / 2 - 9, 16, 'rx="4"') + mk('pl-pillow', bx + bw / 2 + 3, y + 24, bw / 2 - 9, 16, 'rx="4"');
        g += mk('pl-furn', x0 + w - 12, y + 40, 8, 90, 'rx="2"') + mk('pl-furn', x0 + 8, y + h - 52, 62, 30, 'rx="3"');
      }
      if (wc && h >= 50 && w >= 100) {
        g += mk('pl-fix', x0 + 6, y + 6, Math.min(54, h - 12), Math.min(54, h - 12), 'rx="2"') + `<ellipse class="pl-fix" cx="${x0 + w / 2}" cy="${y + 20}" rx="12" ry="15"/>` + mk('pl-fix', x0 + w - 50, y + 6, 40, 20, 'rx="3"');
      }
      const ly = quarto && h >= 150 && w >= 120 ? y + 18 + 2 * K + 36 : y + h - 14;
      if (!(wc && h < 90)) g += `<text class="pl-t" x="${W / 2}" y="${ly - 14}" text-anchor="middle">${escapeHtml(a.name)}</text><text class="pl-s" x="${W / 2}" y="${ly}" text-anchor="middle">${m(a.length)} × ${m(a.width)} m</text>`;
      if (i > 0) g += `<line class="pl-wall" x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" stroke-width="${WALL - 1}"/>`;
      g += `<text class="pl-d" transform="translate(-10 ${y + h / 2}) rotate(-90)" text-anchor="middle">${m(a.length)} m</text>`;
      y += h;
    });
    g += `<rect class="pl-wall" x="0" y="0" width="${W}" height="${H}" fill="none" stroke-width="${WALL}"/>`;
    g += `<rect class="pl-door" x="${W - 46}" y="${H - 2}" width="34" height="${WALL + 1}"/>`;
    g += `<text class="pl-d" x="${W / 2}" y="-14" text-anchor="middle">${m(tot.width)} m</text><line class="pl-dim" x1="0" y1="-6" x2="${W}" y2="-6"/>`;
    const label = `Planta do apartamento, ${HB.catalog.planLabel(plan)}: ${plan.map((a) => `${a.name} ${m(a.length)} por ${m(a.width)} m`).join(', ')}`;
    return `<svg class="plan" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="${escapeHtml(label)}" data-uid="${escapeHtml(uid)}"><g transform="translate(${PADL} ${PADT})">${g}</g></svg>`;
  }

  /**
   * Acessibilidade das janelas (#overlay): prende o foco do teclado dentro da janela aberta e devolve o foco
   * ao elemento que a abriu quando ela fecha. Observa o atributo "hidden", então vale para qualquer janela.
   */
  function watchOverlay() {
    const ov = $('#overlay'); if (!ov) return;
    let opener = null; let lastOutside = null;
    document.addEventListener('focusin', (e) => { if (!ov.contains(e.target)) lastOutside = e.target; });
    const focusables = () => $$('button,input,select,textarea,a[href],summary,[tabindex]:not([tabindex="-1"])', ov).filter((x) => !x.disabled && x.offsetParent !== null);
    new MutationObserver(() => {
      if (!ov.hidden) { if (!opener) opener = lastOutside; } else if (opener) { try { opener.focus({ preventScroll: true }); } catch { /* elemento removido */ } opener = null; }
    }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || ov.hidden) return;
      const f = focusables(); if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (!ov.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function storageWarning(persistent) {
    return persistent ? '' : '<div class="alert error" role="alert">Este navegador bloqueou o armazenamento local. As informações serão perdidas ao fechar a página.</div>';
  }

  HB.ui = Object.freeze({ $, $$, scene, picture, planSvg, qrSvg, toast, initTheme, bootstrap, storageWarning, watchOverlay, esc: escapeHtml });
})(typeof window !== 'undefined' ? window : globalThis);
