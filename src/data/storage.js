/**
 * E-BoxHotel — repositório de dados.
 * Camada: dados. Única parte do sistema que conhece o formato de armazenamento.
 * O "backend" é injetado: localStorage no navegador, memória nos testes. Trocar por uma API não afeta as outras camadas.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});
  const { onlyDigits, hash32Hex } = HB.util;

  const SCHEMA_VERSION = 2;
  const MAX_AUDIT = 500;
  const KEYS = Object.freeze({
    meta: 'hotelbox:meta',
    bookings: 'hotelbox:bookings',
    inventory: 'hotelbox:inventory',
    catalog: 'hotelbox:catalog',
    audit: 'hotelbox:audit',
    prefs: 'hotelbox:prefs',
    auth: 'hotelbox:auth',
  });
  const LEGACY = Object.freeze({ trips: 'hotelbox.trips', overrides: 'hotelbox.over' });

  function memoryBackend() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => void m.set(k, String(v)),
      removeItem: (k) => void m.delete(k),
    };
  }

  /** Retorna localStorage quando utilizável; caso contrário, memória (os dados se perdem ao fechar). */
  function browserBackend(kind = 'localStorage') {
    try {
      const s = root[kind];
      const probe = '__hotelbox_probe__';
      s.setItem(probe, probe);
      s.removeItem(probe);
      return { backend: s, persistent: true };
    } catch {
      return { backend: memoryBackend(), persistent: false };
    }
  }

  /** Migração v1 (arquivo único anterior) → v2. */
  function migrateLegacyBooking(t) {
    const cpf3 = onlyDigits(t.guest && t.guest.cpf3);
    return {
      schema: 2,
      code: t.code,
      hotelId: t.hotelId,
      roomTypeId: t.roomId,
      roomNumber: t.roomNo || null,
      checkIn: t.in,
      checkOut: t.out,
      nights: t.n,
      guests: t.g,
      guest: {
        name: (t.guest && t.guest.nome) || '',
        email: (t.guest && t.guest.email) || '',
        phone: (t.guest && t.guest.tel) || '',
        cpfMasked: '***.***.***-**',
        arrival: (t.guest && t.guest.chegada) || '',
        notes: (t.guest && t.guest.obs) || '',
      },
      checkinHash: cpf3 ? hash32Hex(`${t.code}:${cpf3}`) : null,
      backupPin: t.door || null,
      payment: t.pay,
      pricing: { total: t.total, nights: t.n },
      total: t.total,
      status: t.status === 'cancelada' ? 'cancelada' : 'confirmada',
      createdAt: t.created || new Date(0).toISOString(),
      cancelledAt: null,
      cancelledBy: null,
      checkedInAt: typeof t.checkedIn === 'string' ? t.checkedIn : null,
    };
  }

  function createStore(backend) {
    const read = (key, fallback) => {
      try {
        const raw = backend.getItem(key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    };
    const write = (key, value) => {
      try {
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    };
    const must = (ok) => {
      if (!ok) throw new Error('Não foi possível salvar os dados neste navegador. Verifique o espaço disponível.');
    };

    function migrate() {
      const meta = read(KEYS.meta, { version: 0 });
      if (meta.version >= SCHEMA_VERSION) return;
      const legacyTrips = read(LEGACY.trips, null);
      if (Array.isArray(legacyTrips) && legacyTrips.length) {
        const current = read(KEYS.bookings, []);
        const known = new Set(current.map((b) => b.code));
        write(KEYS.bookings, current.concat(legacyTrips.filter((t) => t && t.code && !known.has(t.code)).map(migrateLegacyBooking)));
      }
      const legacyOver = read(LEGACY.overrides, null);
      if (legacyOver && typeof legacyOver === 'object') {
        const inv = {};
        for (const [hid, rooms] of Object.entries(legacyOver)) {
          inv[hid] = {};
          for (const [rid, o] of Object.entries(rooms || {})) inv[hid][rid] = { nightly: o.p, units: o.left, blocked: Boolean(o.blocked) };
        }
        write(KEYS.inventory, inv);
      }
      backend.removeItem(LEGACY.trips);
      backend.removeItem(LEGACY.overrides);
      write(KEYS.meta, { version: SCHEMA_VERSION, migratedAt: new Date().toISOString() });
    }

    migrate();

    return {
      listBookings: () => read(KEYS.bookings, []),
      getBooking: (code) => read(KEYS.bookings, []).find((b) => b.code === code) || null,
      insertBooking(booking) {
        const all = read(KEYS.bookings, []);
        if (all.some((b) => b.code === booking.code)) throw new Error('Código de reserva duplicado.');
        must(write(KEYS.bookings, [booking, ...all]));
        return booking;
      },
      replaceBooking(booking) {
        const all = read(KEYS.bookings, []);
        const i = all.findIndex((b) => b.code === booking.code);
        if (i < 0) throw new Error('Reserva não encontrada.');
        all[i] = booking;
        must(write(KEYS.bookings, all));
        return booking;
      },
      getInventory: () => read(KEYS.inventory, {}),
      getRoomOverride: (hotelId, roomTypeId) => (read(KEYS.inventory, {})[hotelId] || {})[roomTypeId] || null,
      setRoomOverride(hotelId, roomTypeId, override) {
        const inv = read(KEYS.inventory, {});
        inv[hotelId] = inv[hotelId] || {};
        inv[hotelId][roomTypeId] = { ...inv[hotelId][roomTypeId], ...override };
        must(write(KEYS.inventory, inv));
      },
      getCatalog: () => read(KEYS.catalog, null),
      setCatalog: (catalog) => must(write(KEYS.catalog, catalog)),
      appendAudit(entry) {
        const log = read(KEYS.audit, []);
        log.unshift({ at: new Date().toISOString(), ...entry });
        write(KEYS.audit, log.slice(0, MAX_AUDIT));
      },
      listAudit: () => read(KEYS.audit, []),
      getPrefs: () => read(KEYS.prefs, {}),
      setPrefs: (p) => write(KEYS.prefs, { ...read(KEYS.prefs, {}), ...p }),
      getAuth: () => read(KEYS.auth, {}),
      setAuth: (a) => must(write(KEYS.auth, a)),
    };
  }

  HB.storage = Object.freeze({ SCHEMA_VERSION, KEYS, LEGACY, memoryBackend, browserBackend, createStore, migrateLegacyBooking });
})(typeof window !== 'undefined' ? window : globalThis);
