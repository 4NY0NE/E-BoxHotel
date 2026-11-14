/**
 * E-BoxHotel — regras de reserva, disponibilidade, cancelamento e check-in.
 * Camada: domínio. Funções puras: recebem o estado, devolvem resultados; quem persiste é a camada de dados.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { addDays, nightsBetween, onlyDigits, hash32Hex, round2, maskCpfPrivate } = HB.util;
  const { POLICY } = HB.catalog;

  const STATUS = Object.freeze({ CONFIRMED: 'confirmada', CANCELLED: 'cancelada' });
  const PAYMENT_METHODS = Object.freeze({ pix: 'Pix', card: 'Cartão de crédito', hotel: 'Pagamento no hotel' });
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /** RN-01: duas estadias se sobrepõem quando uma começa antes de a outra terminar (saída no mesmo dia da entrada não conflita). */
  function overlaps(a, b) {
    return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
  }

  function isActive(b) {
    return b.status === STATUS.CONFIRMED;
  }

  /** Numeração física: andar = posição do tipo + 2; unidade sequencial. Ex.: 2º tipo, 1ª unidade → 301. */
  function roomNumbers(hotel, roomTypeId, units) {
    const index = hotel.rooms.findIndex((r) => r.id === roomTypeId);
    if (index < 0) return [];
    const floor = index + 2;
    return Array.from({ length: units }, (_, k) => String(floor * 100 + k + 1));
  }

  function allRoomNumbers(hotel, unitsFor) {
    return hotel.rooms.filter((r) => r.active !== false).flatMap((r) => roomNumbers(hotel, r.id, unitsFor(r)).map((no) => ({ number: no, roomType: r })));
  }

  function conflicting(bookings, hotelId, roomTypeId, stay) {
    return bookings.filter((b) => isActive(b) && b.hotelId === hotelId && b.roomTypeId === roomTypeId && overlaps(b, stay));
  }

  /** RN-02: unidades livres = unidades cadastradas − reservas ativas sobrepostas; tipo bloqueado tem zero. */
  function availableUnits({ hotel, room, bookings, checkIn, checkOut }) {
    if (room.blocked) return 0;
    return Math.max(0, room.units - conflicting(bookings, hotel.id, room.id, { checkIn, checkOut }).length);
  }

  /** RN-03: atribui o menor número de apartamento livre no período. */
  function assignRoomNumber({ hotel, room, bookings, checkIn, checkOut }) {
    const taken = new Set(conflicting(bookings, hotel.id, room.id, { checkIn, checkOut }).map((b) => b.roomNumber));
    return roomNumbers(hotel, room.id, room.units).find((n) => !taken.has(n)) || null;
  }

  function randomCode(random) {
    let code = 'HB-';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    return code;
  }

  function checkinHash(code, cpfDigits) {
    return hash32Hex(`${code}:${onlyDigits(cpfDigits).slice(-3)}`);
  }

  /**
   * Cria uma reserva. Lança erro com mensagem ao usuário quando alguma regra não é atendida.
   * Dados de cartão nunca chegam aqui (RNF-SEG-04).
   */
  function createBooking({ hotel, room, bookings, stay, guest, payment, quote, nowIso, random = Math.random }) {
    if (!PAYMENT_METHODS[payment]) throw new Error('Forma de pagamento inválida.');
    if (stay.guests < 1 || stay.guests > room.capacity) throw new Error(`Este apartamento comporta até ${room.capacity} hóspede(s).`);
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    if (nights !== quote.nights) throw new Error('A cotação não corresponde ao período selecionado.');
    if (availableUnits({ hotel, room, bookings, ...stay }) < 1) throw new Error('Não há mais unidades disponíveis neste período.');
    const roomNumber = assignRoomNumber({ hotel, room, bookings, ...stay });

    let code;
    const existing = new Set(bookings.map((b) => b.code));
    do code = randomCode(random); while (existing.has(code));

    return {
      schema: 2,
      code,
      hotelId: hotel.id,
      roomTypeId: room.id,
      roomNumber,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      nights,
      guests: stay.guests,
      guest: {
        name: guest.name.trim(),
        email: guest.email.trim().toLowerCase(),
        phone: guest.phone,
        cpfMasked: maskCpfPrivate(guest.cpf),
        arrival: guest.arrival,
        notes: String(guest.notes || '').trim(),
      },
      checkinHash: checkinHash(code, guest.cpf),
      backupPin: String(100000 + Math.floor(random() * 900000)),
      payment,
      pricing: quote,
      total: quote.total,
      status: STATUS.CONFIRMED,
      createdAt: nowIso,
      cancelledAt: null,
      cancelledBy: null,
      checkedInAt: null,
    };
  }

  /** RN-09/RN-10: condições de cancelamento. */
  function cancellationTerms(booking, todayIso) {
    if (!isActive(booking)) return { allowed: false, reason: 'Esta reserva já foi cancelada.' };
    if (todayIso >= booking.checkIn) return { allowed: false, reason: 'O cancelamento on-line encerra na data de entrada.' };
    const freeUntil = addDays(booking.checkIn, -POLICY.freeCancellationDays);
    const free = todayIso <= freeUntil;
    const fee = free ? 0 : round2(Math.min(booking.total, booking.total / booking.nights));
    const refund = booking.payment === 'hotel' ? 0 : round2(booking.total - fee);
    return { allowed: true, free, fee, refund, freeUntil };
  }

  function cancel(booking, { nowIso, by }) {
    return { ...booking, status: STATUS.CANCELLED, cancelledAt: nowIso, cancelledBy: by };
  }

  /**
   * RN-11/RN-12: verifica se o QR lido libera a porta.
   * @returns {{status:'ok'|'not-found'|'wrong-room'|'too-early'|'ended', booking?, other?}}
   */
  function checkInStatus({ bookings, hotelId, roomNumber, todayIso }) {
    const mine = bookings.filter((b) => isActive(b) && b.hotelId === hotelId);
    const booking = mine.find((b) => b.roomNumber === roomNumber && todayIso < b.checkOut)
      || mine.find((b) => b.roomNumber === roomNumber);
    if (!booking) {
      const other = mine.find((b) => todayIso < b.checkOut) || null;
      return { status: other ? 'wrong-room' : 'not-found', other };
    }
    if (todayIso < booking.checkIn) return { status: 'too-early', booking };
    if (todayIso >= booking.checkOut) return { status: 'ended', booking };
    return { status: 'ok', booking };
  }

  function verifyCheckinDigits(booking, digits) {
    return onlyDigits(digits).length === 3 && checkinHash(booking.code, digits) === booking.checkinHash;
  }

  HB.booking = Object.freeze({
    STATUS, PAYMENT_METHODS, overlaps, isActive, roomNumbers, allRoomNumbers, availableUnits,
    assignRoomNumber, createBooking, cancellationTerms, cancel, checkInStatus, verifyCheckinDigits, checkinHash,
  });
})(typeof window !== 'undefined' ? window : globalThis);
