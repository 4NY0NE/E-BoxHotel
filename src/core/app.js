/**
 * E-BoxHotel — composição da aplicação (service layer).
 * Liga domínio, dados e segurança. As páginas só falam com este objeto.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { round2 } = HB.util;

  function createApp({ backend, sessionBackend, clock = HB.clock, random = Math.random }) {
    const store = HB.storage.createStore(backend);
    const auth = HB.auth.createAuth({ store, session: sessionBackend, clock });
    const { POLICY } = HB.catalog;

    /* ---------- catálogo (hotéis e tipos de apartamento) ---------- */
    /**
     * Atualiza catálogos salvos por versões antigas (o catálogo fica no navegador e só era criado uma vez):
     * troca o nome da marca e acrescenta o Apartamento Modular aos hotéis de demonstração. É idempotente.
     */
    function upgradeCatalog(c) {
      let changed = false;
      const seed = new Map(HB.catalog.HOTELS.map((h) => [h.id, h]));
      for (const h of c) {
        if (/^Hotel Box\b/.test(h.name)) { h.name = h.name.replace(/^Hotel Box\b/, 'E-BoxHotel'); changed = true; }
        const s = seed.get(h.id);
        const m = s && s.rooms.find((r) => r.id === 'm');
        if (m && !h.rooms.some((r) => r.id === 'm') && h.rooms.length < HB.catalog.LIMITS.maxRoomTypes) {
          h.rooms.push({ ...m, plan: m.plan.map((a) => ({ ...a })), blocked: false, active: true });
          changed = true;
        }
      }
      return changed;
    }
    function loadCatalog() {
      let c = store.getCatalog();
      if (!c) {
        c = HB.catalog.seedCatalog(store.getInventory());
        store.setCatalog(c);
      } else if (upgradeCatalog(c)) {
        store.setCatalog(c);
      }
      return c;
    }
    const allHotels = () => loadCatalog();
    const hotels = () => loadCatalog().filter((h) => h.active !== false);
    const hotel = (id) => loadCatalog().find((h) => h.id === id) || null;
    /** Tipo de apartamento (inclusive arquivado, para exibir reservas antigas). */
    const roomView = (h, roomTypeId) => (h && h.rooms.find((r) => r.id === roomTypeId)) || null;
    /** Tipos disponíveis para venda; com all=true inclui os arquivados. */
    const rooms = (h, { all = false } = {}) => h.rooms.filter((r) => all || r.active !== false);

    function fail(fields) {
      const e = new Error(Object.values(fields)[0]);
      e.fields = fields;
      throw e;
    }
    function newId(prefix, taken) {
      const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let base = prefix;
      for (let i = 0; i < 5; i++) base += A[Math.floor(random() * A.length)];
      let id = base;
      let n = 1;
      while (taken.has(id)) id = base + n++;
      return id;
    }
    /** Lê o catálogo, aplica a alteração e grava; tudo ou nada. */
    function mutateCatalog(fn) {
      const c = loadCatalog();
      const result = fn(c);
      store.setCatalog(c);
      return result;
    }

    function available(hotel, room, checkIn, checkOut) {
      return HB.booking.availableUnits({ hotel, room, bookings: store.listBookings(), checkIn, checkOut });
    }

    /** Hotéis com ao menos um tipo de apartamento disponível para a busca. */
    function search({ query = '', checkIn, checkOut, guests = 1, maxPrice = Infinity, minStars = 0, amenities = [], sort = 'rec' }) {
      const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const q = norm(query.trim());
      const list = hotels()
        .filter((h) => !q || norm(`${h.city} ${h.name}`).includes(q))
        .filter((h) => h.stars >= minStars && amenities.every((a) => h.amenities.includes(a)))
        .map((h) => {
          const fits = rooms(h).filter((r) => r.capacity >= guests && available(h, r, checkIn, checkOut) > 0);
          return { hotel: h, from: fits.length ? Math.min(...fits.map((r) => r.nightly)) : null };
        })
        .filter((x) => x.from !== null && x.from <= maxPrice);
      if (sort === 'price') list.sort((a, b) => a.from - b.from);
      else if (sort === 'rate') list.sort((a, b) => b.hotel.rating - a.hotel.rating);
      return list;
    }

    function quoteFor(room, nights, coupon, payment) {
      return HB.pricing.quote({ nightly: room.nightly, nights, coupon, payment });
    }

    function book({ hotelId, roomTypeId, stay, guest, payment, coupon, owner }) {
      const hotelRec = hotel(hotelId);
      const room = hotelRec && roomView(hotelRec, roomTypeId);
      if (!room || hotelRec.active === false || room.active === false) throw new Error('Hotel ou apartamento não encontrado.');
      const err = HB.validators.validateStay(stay.checkIn, stay.checkOut, clock.today(), POLICY.maxNights);
      if (err) throw new Error(err);
      const errors = HB.validators.validateGuest(guest);
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
      const nights = HB.util.nightsBetween(stay.checkIn, stay.checkOut);
      const quote = quoteFor(room, nights, coupon, payment);
      const booking = HB.booking.createBooking({
        hotel: hotelRec, room, bookings: store.listBookings(), stay, guest, payment, quote,
        nowIso: new Date(clock.now()).toISOString(), random,
      });
      const owned = owner && owner.id ? { ...booking, ownerId: String(owner.id) } : booking;
      store.insertBooking(owned);
      return owned;
    }

    function cancelBooking(code, by) {
      const b = store.getBooking(code);
      if (!b) throw new Error('Reserva não encontrada.');
      const terms = HB.booking.cancellationTerms(b, clock.today());
      if (!terms.allowed && by === 'cliente') throw new Error(terms.reason);
      if (!HB.booking.isActive(b)) throw new Error('Esta reserva já foi cancelada.');
      const updated = HB.booking.cancel(b, { nowIso: new Date(clock.now()).toISOString(), by });
      store.replaceBooking(updated);
      store.appendAudit({ actor: by, action: 'reserva-cancelada', target: code });
      return { booking: updated, terms };
    }

    function registerCheckIn(code, by) {
      const b = store.getBooking(code);
      if (!b || !HB.booking.isActive(b)) throw new Error('Reserva não encontrada.');
      const updated = { ...b, checkedInAt: new Date(clock.now()).toISOString() };
      store.replaceBooking(updated);
      store.appendAudit({ actor: by, action: 'check-in', target: code });
      return updated;
    }

    function undoCheckIn(code, by) {
      const b = store.getBooking(code);
      if (!b) throw new Error('Reserva não encontrada.');
      store.replaceBooking({ ...b, checkedInAt: null });
      store.appendAudit({ actor: by, action: 'check-in-desfeito', target: code });
    }

    /** Operações administrativas exigem sessão válida (defesa em profundidade; a interface também verifica). */
    function requireAdmin() {
      const s = auth.currentSession();
      if (!s) throw new Error('Sessão expirada. Entre novamente.');
      return s.user;
    }

    const futureActive = (hotelId, roomTypeId) => {
      const today = clock.today();
      return store.listBookings().filter((b) => HB.booking.isActive(b) && b.hotelId === hotelId && (!roomTypeId || b.roomTypeId === roomTypeId) && b.checkOut > today);
    };

    /* ----- hotéis ----- */
    function addHotel(data) {
      const actor = requireAdmin();
      const errors = HB.catalog.validateHotelInput(data);
      if (Object.keys(errors).length) fail(errors);
      const clean = HB.catalog.cleanHotelInput(data);
      const created = mutateCatalog((c) => {
        const id = newId('h', new Set(c.map((h) => h.id)));
        const h = { id, ...clean, rating: 0, reviews: 0, hue: HB.catalog.hueFor(id), active: true, rooms: [] };
        c.push(h);
        return h;
      });
      store.appendAudit({ actor, action: 'hotel-criado', target: created.id, detail: { name: created.name } });
      return created;
    }

    function updateHotel(hotelId, data) {
      const actor = requireAdmin();
      const errors = HB.catalog.validateHotelInput(data);
      if (Object.keys(errors).length) fail(errors);
      const clean = HB.catalog.cleanHotelInput(data);
      mutateCatalog((c) => {
        const h = c.find((x) => x.id === hotelId);
        if (!h) throw new Error('Hotel não encontrado.');
        Object.assign(h, clean);
      });
      store.appendAudit({ actor, action: 'hotel-alterado', target: hotelId, detail: { name: clean.name } });
    }

    /** Oculta da busca ou volta a exibir. As reservas existentes permanecem válidas. */
    function setHotelActive(hotelId, active) {
      const actor = requireAdmin();
      mutateCatalog((c) => {
        const h = c.find((x) => x.id === hotelId);
        if (!h) throw new Error('Hotel não encontrado.');
        h.active = Boolean(active);
      });
      store.appendAudit({ actor, action: active ? 'hotel-reativado' : 'hotel-ocultado', target: hotelId });
    }

    /* ----- tipos de apartamento ----- */
    function addRoomType(hotelId, data) {
      const actor = requireAdmin();
      const errors = HB.catalog.validateRoomInput(data);
      if (Object.keys(errors).length) fail(errors);
      const clean = HB.catalog.cleanRoomInput(data);
      const created = mutateCatalog((c) => {
        const h = c.find((x) => x.id === hotelId);
        if (!h) throw new Error('Hotel não encontrado.');
        if (h.rooms.length >= HB.catalog.LIMITS.maxRoomTypes) throw new Error(`Cada hotel comporta até ${HB.catalog.LIMITS.maxRoomTypes} tipos de apartamento (contando os arquivados).`);
        const r = { id: newId('r', new Set(h.rooms.map((x) => x.id))), ...clean, blocked: false, active: true };
        h.rooms.push(r);
        return r;
      });
      store.appendAudit({ actor, action: 'apartamento-criado', target: `${hotelId}/${created.id}`, detail: { name: created.name } });
      return created;
    }

    /** Altera qualquer campo do tipo; aceita alteração parcial (ex.: só a diária). */
    function updateRoomType(hotelId, roomTypeId, patch) {
      const actor = requireAdmin();
      const rec = hotel(hotelId);
      const current = rec && roomView(rec, roomTypeId);
      if (!current) throw new Error('Apartamento não encontrado.');
      const merged = { ...current, ...patch };
      const errors = HB.catalog.validateRoomInput(merged);
      if (Object.keys(errors).length) fail(errors);
      const clean = HB.catalog.cleanRoomInput(merged);
      if (clean.units < current.units) {
        const blocking = futureActive(hotelId, roomTypeId).filter((b) => Number(b.roomNumber) % 100 > clean.units);
        if (blocking.length) {
          const need = Math.max(...blocking.map((b) => Number(b.roomNumber) % 100));
          fail({ units: `Há reservas ativas no apartamento ${blocking[0].roomNumber}. Mantenha ao menos ${need} unidades ou cancele essas reservas.` });
        }
      }
      const blocked = 'blocked' in patch ? Boolean(patch.blocked) : Boolean(current.blocked);
      mutateCatalog((c) => {
        Object.assign(c.find((h) => h.id === hotelId).rooms.find((r) => r.id === roomTypeId), clean, { blocked });
      });
      store.appendAudit({ actor, action: 'apartamento-alterado', target: `${hotelId}/${roomTypeId}`, detail: patch });
    }

    /** Arquiva (sai da venda) ou reativa um tipo. Não arquiva com reservas futuras ativas. */
    function setRoomActive(hotelId, roomTypeId, active) {
      const actor = requireAdmin();
      const rec = hotel(hotelId);
      if (!rec || !roomView(rec, roomTypeId)) throw new Error('Apartamento não encontrado.');
      if (!active && futureActive(hotelId, roomTypeId).length) throw new Error('Há reservas ativas neste apartamento. Cancele-as antes de arquivar.');
      mutateCatalog((c) => { c.find((h) => h.id === hotelId).rooms.find((r) => r.id === roomTypeId).active = Boolean(active); });
      store.appendAudit({ actor, action: active ? 'apartamento-reativado' : 'apartamento-arquivado', target: `${hotelId}/${roomTypeId}` });
    }

    function stats() {
      const all = store.listBookings();
      const active = all.filter(HB.booking.isActive);
      return {
        total: all.length,
        confirmed: active.length,
        cancelled: all.length - active.length,
        revenue: round2(active.reduce((s, b) => s + b.total, 0)),
        nights: active.reduce((s, b) => s + b.nights, 0),
        checkedIn: active.filter((b) => b.checkedInAt).length,
        perHotel: allHotels().map((h) => {
          const x = active.filter((b) => b.hotelId === h.id);
          return { hotel: h, bookings: x.length, nights: x.reduce((s, b) => s + b.nights, 0), revenue: round2(x.reduce((s, b) => s + b.total, 0)) };
        }),
      };
    }

    return {
      store, auth, clock, allHotels, hotels, hotel, roomView, rooms, available, search, quoteFor, book, cancelBooking,
      registerCheckIn, undoCheckIn, addHotel, updateHotel, setHotelActive, addRoomType, updateRoomType, setRoomActive, stats, requireAdmin,
    };
  }

  HB.createApp = createApp;
})(typeof window !== 'undefined' ? window : globalThis);
