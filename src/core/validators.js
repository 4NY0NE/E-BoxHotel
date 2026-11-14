/**
 * E-BoxHotel — validações de entrada.
 * Camada: núcleo. Cada função recebe valores e devolve booleano ou mensagens; nenhuma toca a interface.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { onlyDigits, isIsoDate, nightsBetween } = HB.util;

  function isValidCpf(value) {
    const c = onlyDigits(value);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i);
      if (((sum * 10) % 11) % 10 !== Number(c[t])) return false;
    }
    return true;
  }

  function isValidEmail(value) {
    const v = String(value ?? '').trim();
    return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function isValidPhone(value) {
    const d = onlyDigits(value);
    if (d.length !== 10 && d.length !== 11) return false;
    const ddd = Number(d.slice(0, 2));
    if (ddd < 11 || ddd > 99) return false;
    return d.length === 10 || d[2] === '9';
  }

  function isValidFullName(value) {
    const v = String(value ?? '').trim();
    if (v.length < 5 || v.length > 120) return false;
    const parts = v.split(/\s+/);
    return parts.length >= 2 && parts.every((p) => /^[\p{L}'.-]+$/u.test(p)) && parts.filter((p) => p.length >= 2).length >= 2;
  }

  /** Algoritmo de Luhn para números de cartão. */
  function isValidCardNumber(value) {
    const n = onlyDigits(value);
    if (n.length < 13 || n.length > 19) return false;
    let sum = 0;
    let alt = false;
    for (let i = n.length - 1; i >= 0; i--) {
      let d = Number(n[i]);
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function isValidExpiry(value, todayIso) {
    const m = /^(\d{2})\/(\d{2})$/.exec(String(value ?? ''));
    if (!m) return false;
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return false;
    const [ty, tm] = todayIso.split('-').map(Number);
    return year * 12 + month >= ty * 12 + tm;
  }

  function isValidCvv(value) {
    return /^\d{3,4}$/.test(String(value ?? ''));
  }

  /**
   * Valida o período da estadia.
   * @returns {string|null} mensagem de erro ou null quando válido
   */
  function validateStay(checkIn, checkOut, todayIso, maxNights) {
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return 'Informe as datas de entrada e de saída.';
    if (checkIn < todayIso) return 'A data de entrada não pode ser anterior a hoje.';
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) return 'A data de saída deve ser posterior à data de entrada.';
    if (nights > maxNights) return `Reservas on-line são limitadas a ${maxNights} noites.`;
    return null;
  }

  /** Valida o formulário do hóspede e devolve um objeto { campo: mensagem }. */
  function validateGuest(g) {
    const errors = {};
    if (!isValidFullName(g.name)) errors.name = 'Informe nome e sobrenome.';
    if (!isValidCpf(g.cpf)) errors.cpf = 'CPF inválido. Verifique os 11 dígitos.';
    if (!isValidPhone(g.phone)) errors.phone = 'Informe um celular com DDD.';
    if (!isValidEmail(g.email)) errors.email = 'Informe um e-mail válido.';
    if (String(g.notes ?? '').length > 500) errors.notes = 'Limite de 500 caracteres.';
    if (!g.consent) errors.consent = 'É necessário aceitar os Termos de Uso e a Política de Privacidade.';
    return errors;
  }

  function validateCard(c, todayIso) {
    const errors = {};
    if (!isValidCardNumber(c.number)) errors.number = 'Número de cartão inválido.';
    if (String(c.holder ?? '').trim().length < 3) errors.holder = 'Informe o nome impresso no cartão.';
    if (!isValidExpiry(c.expiry, todayIso)) errors.expiry = 'Validade inválida ou vencida.';
    if (!isValidCvv(c.cvv)) errors.cvv = 'Informe 3 ou 4 dígitos.';
    return errors;
  }

  HB.validators = Object.freeze({
    isValidCpf, isValidEmail, isValidPhone, isValidFullName, isValidCardNumber, isValidExpiry,
    isValidCvv, validateStay, validateGuest, validateCard,
  });
})(typeof window !== 'undefined' ? window : globalThis);
