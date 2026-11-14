/**
 * E-BoxHotel — cálculo de preços.
 * Camada: domínio. Regras RN-05 a RN-08 (ver docs/regras-de-negocio.md).
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { round2 } = HB.util;

  const TAX_RATE = 0.07;
  const PIX_DISCOUNT_RATE = 0.05;
  const MAX_INSTALLMENTS = 3;
  const COUPONS = Object.freeze({
    BOX10: Object.freeze({ rate: 0.1, label: 'Cupom BOX10' }),
  });

  function findCoupon(code) {
    const key = String(code ?? '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(COUPONS, key) ? { code: key, ...COUPONS[key] } : null;
  }

  /**
   * Monta a cotação de uma estadia.
   * Ordem: diárias → desconto de cupom → taxas sobre o valor com desconto → desconto Pix sobre o subtotal.
   */
  function quote({ nightly, nights, coupon, payment }) {
    if (!(Number(nightly) > 0) || !Number.isInteger(nights) || nights < 1) {
      throw new RangeError('Parâmetros de cotação inválidos.');
    }
    const base = round2(nightly * nights);
    const c = findCoupon(coupon);
    const discount = c ? round2(base * c.rate) : 0;
    const taxes = round2((base - discount) * TAX_RATE);
    const subtotal = round2(base - discount + taxes);
    const pixDiscount = payment === 'pix' ? round2(subtotal * PIX_DISCOUNT_RATE) : 0;
    const total = round2(subtotal - pixDiscount);
    return { nightly, nights, base, coupon: c ? c.code : null, discount, taxes, subtotal, pixDiscount, total };
  }

  /** Divide o total em parcelas; a diferença de centavos vai para a primeira. */
  function installments(total, count) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) throw new RangeError('Número de parcelas inválido.');
    const each = Math.floor((total * 100) / count) / 100;
    const first = round2(total - each * (count - 1));
    return { count, first, each };
  }

  HB.pricing = Object.freeze({ TAX_RATE, PIX_DISCOUNT_RATE, MAX_INSTALLMENTS, findCoupon, quote, installments });
})(typeof window !== 'undefined' ? window : globalThis);
