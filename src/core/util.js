/**
 * E-BoxHotel — utilitários puros.
 * Camada: núcleo (core). Sem acesso a DOM ou armazenamento: tudo aqui é testável em Node.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});

  const MS_PER_DAY = 86400000;
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escapa texto para inserção segura em HTML (prevenção de XSS). */
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  }

  /** Arredonda para 2 casas decimais (centavos). */
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function formatBRL(n) {
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /** Data local do aparelho no formato AAAA-MM-DD. */
  function toIsoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function isIsoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function nightsBetween(checkIn, checkOut) {
    return Math.round((Date.parse(checkOut + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / MS_PER_DAY);
  }

  function formatDate(iso) {
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  }

  function formatDateTime(isoTimestamp) {
    const d = new Date(isoTimestamp);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  function onlyDigits(s) {
    return String(s ?? '').replace(/\D/g, '');
  }

  /** Hash FNV-1a de 32 bits. Uso: identificadores determinísticos, nunca para senhas. */
  function hash32(s) {
    let x = 2166136261;
    for (const ch of String(s)) {
      x ^= ch.codePointAt(0);
      x = Math.imul(x, 16777619);
    }
    return x >>> 0;
  }

  function hash32Hex(s) {
    return hash32(s).toString(16).padStart(8, '0');
  }

  /* ---- Máscaras de digitação ---- */
  function maskCpf(v) {
    return onlyDigits(v).slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  function maskPhone(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return d;
  }

  function maskCard(v) {
    return onlyDigits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function maskExpiry(v) {
    const d = onlyDigits(v).slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  /** CPF exibível conforme minimização de dados (LGPD): somente os 3 primeiros dígitos. */
  function maskCpfPrivate(cpf) {
    const d = onlyDigits(cpf);
    return d.length === 11 ? `${d.slice(0, 3)}.***.***-**` : '***.***.***-**';
  }

  function maskEmailPrivate(email) {
    const [user, domain] = String(email).split('@');
    if (!domain) return '***';
    return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }

  function firstName(fullName) {
    return String(fullName).trim().split(/\s+/)[0] || '';
  }

  /** Relógio da aplicação. Substituível em testes e no modo demonstração. */
  const clock = {
    now: () => Date.now(),
    today: () => toIsoDate(new Date()),
  };

  HB.util = Object.freeze({
    MS_PER_DAY, escapeHtml, round2, formatBRL, toIsoDate, isIsoDate, addDays, nightsBetween,
    formatDate, formatDateTime, plural, onlyDigits, hash32, hash32Hex, maskCpf, maskPhone,
    maskCard, maskExpiry, maskCpfPrivate, maskEmailPrivate, firstName,
  });
  HB.clock = clock;
})(typeof window !== 'undefined' ? window : globalThis);
