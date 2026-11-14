/**
 * E-BoxHotel — catálogo de hotéis e políticas do negócio.
 * Camada: domínio. Dados de demonstração (fictícios); em produção viriam de uma API.
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});

  const POLICY = Object.freeze({
    checkInHour: 14,
    checkOutHour: 12,
    freeCancellationDays: 2,
    maxNights: 30,
    maxGuests: 4,
    doorUnlockSeconds: 10,
  });

  const AMENITY_FILTERS = Object.freeze(['Piscina', 'Café da manhã', 'Pet friendly', 'Estacionamento']);

  const room = (id, name, beds, capacity, area, nightly, units) =>
    Object.freeze({ id, name, beds, capacity, area, nightly, units });

  /** Apartamento modular 5,00 x 3,00 m: banheiro 1,00 x 3,00 m + quarto 4,00 x 3,00 m (comprimento x largura). */
  const MODULE_PLAN = Object.freeze([
    Object.freeze({ name: 'Banheiro', length: 1, width: 3 }),
    Object.freeze({ name: 'Quarto', length: 4, width: 3 }),
  ]);
  const modular = (nightly, units) =>
    Object.freeze({ ...room('m', 'Apartamento Modular 5×3 m', '1 cama queen', 2, 15, nightly, units), plan: MODULE_PLAN });

  const HOTELS = Object.freeze([
    {
      id: 'cwb1', name: 'E-BoxHotel Centro Curitiba', city: 'Curitiba, PR', address: 'Rua XV de Novembro, 820',
      stars: 4, rating: 8.9, reviews: 1240, highlight: 'Mais reservado', scene: 'city', hue: 215,
      amenities: ['Wi-Fi', 'Café da manhã', 'Academia', 'Estacionamento'],
      description: 'Apartamentos compactos e silenciosos a duas quadras da Boca Maldita. Café da manhã servido das 6h às 10h.',
      rooms: [room('s', 'Apartamento Solteiro', '1 cama de solteiro', 1, 14, 219, 4), room('c', 'Apartamento Casal', '1 cama queen', 2, 18, 289, 5), room('f', 'Apartamento Família', '1 cama queen e 2 de solteiro', 4, 28, 429, 2), modular(249, 4)],
    },
    {
      id: 'gua1', name: 'E-BoxHotel Guarapuava', city: 'Guarapuava, PR', address: 'Av. Manoel Ribas, 1500',
      stars: 3, rating: 8.6, reviews: 410, highlight: 'Melhor tarifa', scene: 'forest', hue: 150,
      amenities: ['Wi-Fi', 'Café da manhã', 'Estacionamento', 'Pet friendly'],
      description: 'Indicado para viagens de trabalho e estudo. Estacionamento coberto e apartamentos com mesa de trabalho.',
      rooms: [room('s', 'Apartamento Solteiro', '1 cama de solteiro', 1, 15, 159, 6), room('c', 'Apartamento Casal', '1 cama queen', 2, 19, 199, 6), room('t', 'Apartamento Triplo', '3 camas de solteiro', 3, 24, 259, 3), modular(169, 4)],
    },
    {
      id: 'fln1', name: 'E-BoxHotel Beira-Mar', city: 'Florianópolis, SC', address: 'Av. Beira-Mar Norte, 2200',
      stars: 5, rating: 9.3, reviews: 2105, highlight: 'Vista para o mar', scene: 'sea', hue: 195,
      amenities: ['Wi-Fi', 'Café da manhã', 'Piscina', 'Spa', 'Academia', 'Estacionamento'],
      description: 'De frente para a baía Norte, com piscina na cobertura e spa em funcionamento até as 22h.',
      rooms: [room('c', 'Apartamento Casal Vista Mar', '1 cama king', 2, 26, 689, 3), room('s', 'Suíte Executiva', '1 cama king e sofá-cama', 3, 38, 899, 2), room('f', 'Apartamento Família Vista Mar', '2 camas queen', 4, 40, 979, 1), modular(599, 3)],
    },
    {
      id: 'igu1', name: 'E-BoxHotel Cataratas', city: 'Foz do Iguaçu, PR', address: 'Rod. das Cataratas, km 12',
      stars: 4, rating: 9.0, reviews: 870, highlight: 'Próximo ao Parque Nacional', scene: 'falls', hue: 165,
      amenities: ['Wi-Fi', 'Café da manhã', 'Piscina', 'Estacionamento', 'Pet friendly'],
      description: 'A oito minutos do Parque Nacional do Iguaçu, com traslado de hora em hora até a entrada das Cataratas.',
      rooms: [room('c', 'Apartamento Casal', '1 cama queen', 2, 20, 349, 5), room('f', 'Apartamento Família', '1 cama queen e 2 de solteiro', 4, 30, 519, 3), modular(319, 3)],
    },
    {
      id: 'gra1', name: 'E-BoxHotel Serra Gaúcha', city: 'Gramado, RS', address: 'Rua Garibaldi, 310',
      stars: 4, rating: 9.1, reviews: 1530, highlight: 'Lareira no apartamento', scene: 'forest', hue: 140,
      amenities: ['Wi-Fi', 'Café da manhã', 'Spa', 'Estacionamento'],
      description: 'Chalés em madeira a poucos passos da Rua Coberta, com lareira e banheira de hidromassagem nas suítes.',
      rooms: [room('c', 'Apartamento Casal', '1 cama queen', 2, 22, 559, 4), room('h', 'Suíte com Hidromassagem', '1 cama king e banheira', 2, 32, 789, 2), modular(519, 3)],
    },
    {
      id: 'rio1', name: 'E-BoxHotel Copacabana', city: 'Rio de Janeiro, RJ', address: 'Rua Barata Ribeiro, 410',
      stars: 4, rating: 8.7, reviews: 1960, highlight: 'A 300 m da praia', scene: 'sea', hue: 30,
      amenities: ['Wi-Fi', 'Café da manhã', 'Piscina', 'Academia'],
      description: 'Apartamentos renovados próximos ao calçadão, com climatização silenciosa e cortinas blackout.',
      rooms: [room('s', 'Apartamento Solteiro', '1 cama de solteiro', 1, 13, 299, 3), room('c', 'Apartamento Casal', '1 cama queen', 2, 17, 429, 5), room('t', 'Apartamento Triplo', '1 cama queen e 1 de solteiro', 3, 22, 539, 2), modular(399, 4)],
    },
    {
      id: 'ssa1', name: 'E-BoxHotel Pelourinho', city: 'Salvador, BA', address: 'Rua Gregório de Matos, 45',
      stars: 3, rating: 8.8, reviews: 690, highlight: 'Centro Histórico', scene: 'city', hue: 20,
      amenities: ['Wi-Fi', 'Café da manhã', 'Pet friendly'],
      description: 'Casarão restaurado no Centro Histórico, com pátio interno e café da manhã regional.',
      rooms: [room('c', 'Apartamento Casal', '1 cama queen', 2, 18, 249, 4), room('f', 'Apartamento Família', '1 cama queen e 2 de solteiro', 4, 27, 379, 2), modular(229, 4)],
    },
    {
      id: 'sp1', name: 'E-BoxHotel Paulista', city: 'São Paulo, SP', address: 'Alameda Santos, 900',
      stars: 5, rating: 9.2, reviews: 2480, highlight: 'Perfil executivo', scene: 'city', hue: 225,
      amenities: ['Wi-Fi', 'Café da manhã', 'Academia', 'Spa', 'Estacionamento'],
      description: 'A uma quadra da estação Trianon-Masp, com salas de reunião por hora e apartamentos com estação de trabalho.',
      rooms: [room('s', 'Apartamento Executivo', '1 cama queen', 2, 20, 529, 6), room('c', 'Apartamento Casal Superior', '1 cama king', 2, 26, 679, 3), room('f', 'Suíte Família', '2 camas queen', 4, 36, 899, 2), modular(489, 3)],
    },
  ].map((h) => Object.freeze({ ...h, amenities: Object.freeze(h.amenities), rooms: Object.freeze(h.rooms) })));

  function findHotel(id) {
    return HOTELS.find((h) => h.id === id) || null;
  }

  function findRoomType(hotel, roomTypeId) {
    return hotel ? hotel.rooms.find((r) => r.id === roomTypeId) || null : null;
  }

  /**
   * Aplica os ajustes do administrador (tarifa, unidades, bloqueio) sobre o catálogo base.
   * @param {object} override { nightly?, units?, blocked? }
   */
  function effectiveRoom(roomType, override) {
    const o = override || {};
    return {
      ...roomType,
      nightly: Number.isFinite(o.nightly) && o.nightly > 0 ? o.nightly : roomType.nightly,
      units: Number.isInteger(o.units) && o.units >= 0 ? o.units : roomType.units,
      blocked: Boolean(o.blocked),
    };
  }

  /* ---------- catálogo editável pelo administrador ---------- */
  const SCENES = Object.freeze({ city: 'Cidade', sea: 'Praia', falls: 'Cachoeira', forest: 'Serra e floresta' });
  const AMENITIES = Object.freeze(['Wi-Fi', 'Café da manhã', 'Piscina', 'Estacionamento', 'Pet friendly', 'Academia', 'Spa', 'Ar-condicionado', 'Recepção 24h']);
  const LIMITS = Object.freeze({ maxRoomTypes: 8, maxUnits: 20, maxNightly: 100000 });


  /* ---------- fotografias (Unsplash, licença gratuita; carregadas do próprio serviço) ---------- */
  const ph = (id, author, page, alt) => Object.freeze({ id, author, page: `https://unsplash.com/photos/${page}`, alt });
  const PHOTOS = Object.freeze({
    'quarto-claro': ph('1618773928121-c32242e63f39', 'Vojtech Bruzek', 'Yrxr3bsPdS0', 'Cama com roupa de cama branca e almofadas'),
    'quarto-jardim': ph('1611892440504-42a792e24d32', 'visualsofdana', 'T5pL6ciEn-I', 'Quarto de hotel com cama de madeira e vista para o jardim'),
    'quarto-marmore': ph('1778205015308-1ed324aea202', 'Nusrat Ali', '9QhyuOeu3Ik', 'Quarto moderno com parede de mármore'),
    'quarto-madeira': ph('1765547090903-348b711f0eee', 'Marcel Strauß', 'CMHgRFDANH8', 'Quarto moderno com detalhes em madeira e luz natural'),
    'quarto-cortinas': ph('1759328257280-28bdb3050be3', 'Hiram Huang', 'NIbUk7ATSuw', 'Quarto de hotel com luz entrando pelas cortinas'),
    'quarto-branco': ph('1631049307264-da0ec9d70304', 'Point3D Commercial Imaging Ltd.', 'oxeCZrodz78', 'Cama arrumada com roupa de cama branca'),
    'quarto-janela': ph('1629140727571-9b5c6f6267b4', 'Linus Mimietz', 'p3UWyaujtQo', 'Cama branca com travesseiro cinza'),
    'casarao': ph('1723465308831-29da05e011f3', 'Rafi Thissen', 'bpvWdfSnt0Q', 'Casarão com janelas e venezianas azuis'),
    'praia-espreguicadeiras': ph('1602002418816-5c0aeef426aa', 'Upgraded Points', 'KVym2PAn1gA', 'Espreguiçadeiras na areia branca sob coqueiros'),
    'praia-deck': ph('1584132869994-873f9363a562', 'Sasha Kaunas', 'G6eXUCi8JgA', 'Espreguiçadeiras de madeira em um deck à beira-mar'),
    'cachoeira-pousada': ph('1791830179547-f401c311934c', 'Ximin Lin', 'WLe0SH9a464', 'Cachoeira abaixo de uma pousada na floresta'),
    'chale-floresta': ph('1587381420270-3e1a5b9e6904', 'Chris Czermak', '0b9eOKZU_dE', 'Casa de madeira entre árvores e montanha'),
    'chale-madeira': ph('1618140052121-39fc6db33972', 'Laura Barry', 'ntrLKLHoMYY', 'Casa de madeira cercada por árvores'),
  });
  const SCENE_PHOTO = Object.freeze({ city: 'quarto-claro', sea: 'praia-espreguicadeiras', falls: 'cachoeira-pousada', forest: 'chale-floresta' });
  const ROOM_PHOTOS = Object.freeze(['quarto-claro', 'quarto-jardim', 'quarto-marmore', 'quarto-madeira', 'quarto-cortinas', 'quarto-branco', 'quarto-janela']);
  const SEED_PHOTO = Object.freeze({ cwb1: 'quarto-claro', gua1: 'chale-floresta', fln1: 'praia-espreguicadeiras', igu1: 'cachoeira-pousada', gra1: 'chale-madeira', rio1: 'praia-deck', ssa1: 'casarao', sp1: 'quarto-marmore' });

  /** Foto de capa do hotel: a escolhida, senão a original da demonstração, senão a do ambiente. */
  function photoKeyFor(hotel) {
    if (hotel && PHOTOS[hotel.photo]) return hotel.photo;
    if (hotel && SEED_PHOTO[hotel.id]) return SEED_PHOTO[hotel.id];
    return SCENE_PHOTO[(hotel && hotel.scene) || 'city'];
  }
  function roomPhotoKey(hotelId, roomId) {
    return ROOM_PHOTOS[HB.util.hash32(`${hotelId}/${roomId}`) % ROOM_PHOTOS.length];
  }
  const photoUrl = (key, w) => `https://images.unsplash.com/photo-${PHOTOS[key].id}?auto=format&fit=crop&q=70&w=${w || 800}`;

  /** Cópia editável do catálogo de demonstração, já com os ajustes antigos de tarifa/unidades aplicados. */
  function seedCatalog(inventory) {
    return HOTELS.map((h) => ({
      ...h,
      amenities: [...h.amenities],
      active: true,
      rooms: h.rooms.map((r) => ({ ...HB.catalog.effectiveRoom(r, ((inventory || {})[h.id] || {})[r.id]), active: true })),
    }));
  }

  const hueFor = (id) => HB.util.hash32(id) % 360;
  const str = (v) => String(v ?? '').trim();
  const inRange = (v, min, max) => Number.isInteger(Number(v)) && str(v) !== '' && Number(v) >= min && Number(v) <= max;

  /** @returns {Object} mapa campo → mensagem (vazio quando válido) */
  function validateHotelInput(d) {
    const e = {};
    if (str(d.name).length < 3 || str(d.name).length > 80) e.name = 'Informe o nome do hotel (3 a 80 caracteres).';
    if (!/^.{2,70},\s*[A-Za-z]{2}$/.test(str(d.city))) e.city = 'Use o formato "Cidade, UF" (ex.: Curitiba, PR).';
    if (str(d.address).length < 3 || str(d.address).length > 120) e.address = 'Informe o endereço (3 a 120 caracteres).';
    if (!inRange(d.stars, 1, 5)) e.stars = 'Escolha de 1 a 5 estrelas.';
    if (str(d.highlight).length > 40) e.highlight = 'Máximo de 40 caracteres.';
    if (str(d.description).length > 400) e.description = 'Máximo de 400 caracteres.';
    if (!SCENES[d.scene]) e.scene = 'Escolha uma ilustração.';
    if (str(d.photo) && !PHOTOS[d.photo]) e.photo = 'Escolha uma foto da lista.';
    if (!Array.isArray(d.amenities) || d.amenities.some((a) => !AMENITIES.includes(a))) e.amenities = 'Comodidade inválida.';
    return e;
  }

  function cleanHotelInput(d) {
    const [city, uf] = str(d.city).split(/,\s*/);
    return {
      name: str(d.name), city: `${city}, ${uf.toUpperCase()}`, address: str(d.address), stars: Number(d.stars),
      highlight: str(d.highlight), scene: d.scene, photo: str(d.photo), description: str(d.description), amenities: [...new Set(d.amenities)],
    };
  }

  const PLAN_LIMITS = { maxItems: 6, min: 0.5, max: 20 };

  /** Converte texto ("Nome; comprimento; largura", um ambiente por linha, metros) em lista; vazio = sem planta. */
  function parsePlan(text) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const plan = [];
    for (const line of lines) {
      const parts = line.split(/[;|]/).map((x) => x.trim());
      const num = (v) => Number(String(v).replace(/\s*m$/i, '').replace(',', '.'));
      if (parts.length !== 3 || !parts[0] || !(num(parts[1]) > 0) || !(num(parts[2]) > 0)) {
        return { plan: [], error: `Linha inválida: "${line}". Use: Nome; comprimento; largura (em metros).` };
      }
      plan.push({ name: parts[0], length: num(parts[1]), width: num(parts[2]) });
    }
    return { plan, error: '' };
  }

  function validatePlan(plan) {
    if (plan === undefined || plan === null) return '';
    if (!Array.isArray(plan)) return 'Planta inválida.';
    if (plan.length > PLAN_LIMITS.maxItems) return `Use até ${PLAN_LIMITS.maxItems} ambientes na planta.`;
    for (const a of plan) {
      if (!a || str(a.name).length < 2 || str(a.name).length > 30) return 'Cada ambiente precisa de um nome de 2 a 30 caracteres.';
      for (const v of [a.length, a.width]) if (!(Number(v) >= PLAN_LIMITS.min && Number(v) <= PLAN_LIMITS.max)) return `As medidas vão de ${PLAN_LIMITS.min} a ${PLAN_LIMITS.max} metros.`;
    }
    return '';
  }

  const planTotals = (plan) => ({
    length: HB.util.round2((plan || []).reduce((t, a) => t + Number(a.length), 0)),
    width: HB.util.round2(Math.max(0, ...(plan || []).map((a) => Number(a.width)))),
  });
  const meters = (n) => Number(n).toFixed(2).replace('.', ',');
  const planLabel = (plan) => { const t = planTotals(plan); return `${meters(t.length)} × ${meters(t.width)} m`; };

  function validateRoomInput(d) {
    const e = {};
    if (str(d.name).length < 3 || str(d.name).length > 60) e.name = 'Informe o nome do apartamento (3 a 60 caracteres).';
    if (str(d.beds).length < 3 || str(d.beds).length > 60) e.beds = 'Descreva as camas (3 a 60 caracteres).';
    if (!inRange(d.capacity, 1, POLICY.maxGuests)) e.capacity = `A capacidade vai de 1 a ${POLICY.maxGuests} hóspedes.`;
    if (!inRange(d.area, 5, 200)) e.area = 'A área deve ter de 5 a 200 m².';
    const n = Number(d.nightly);
    if (!(n > 0 && n <= LIMITS.maxNightly) || str(d.nightly) === '') e.nightly = 'Informe uma diária entre R$ 0,01 e R$ 100.000,00.';
    if (!inRange(d.units, 0, LIMITS.maxUnits)) e.units = `O número de unidades deve ser um inteiro de 0 a ${LIMITS.maxUnits}.`;
    const pe = validatePlan(d.plan); if (pe) e.plan = pe;
    return e;
  }

  function cleanRoomInput(d) {
    return {
      name: str(d.name), beds: str(d.beds), capacity: Number(d.capacity), area: Number(d.area),
      nightly: HB.util.round2(Number(d.nightly)), units: Number(d.units),
      plan: Array.isArray(d.plan) ? d.plan.map((a) => ({ name: str(a.name), length: Number(a.length), width: Number(a.width) })) : [],
    };
  }

  HB.catalog = Object.freeze({
    POLICY, AMENITY_FILTERS, HOTELS, findHotel, findRoomType, effectiveRoom,
    SCENES, AMENITIES, LIMITS, PHOTOS, photoKeyFor, roomPhotoKey, photoUrl, seedCatalog, hueFor, validateHotelInput, cleanHotelInput, validateRoomInput, cleanRoomInput, parsePlan, planTotals, planLabel, meters,
  });
})(typeof window !== 'undefined' ? window : globalThis);
