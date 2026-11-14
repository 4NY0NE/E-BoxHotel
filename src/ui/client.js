/**
 * E-BoxHotel — página do cliente (busca, reserva, minhas reservas, check-in pela porta).
 * Camada: apresentação. Toda regra de negócio vem de HB.createApp / HB.booking / HB.pricing.
 */
(function (root) {
  'use strict';
  const HB = root.HB;
  const { $, $$, qrSvg, toast, esc } = HB.ui;
  const U = HB.util;
  const { POLICY, AMENITY_FILTERS } = HB.catalog;
  const CAT = HB.catalog;
  const { picture } = HB.ui;
  const { app, clock, persistent, accounts } = HB.ui.bootstrap();
  const brl = U.formatBRL;
  const pl = U.plural;

  /* ---------- estado ---------- */
  const t0 = clock.today();
  const S = { dest: '', checkIn: U.addDays(t0, 1), checkOut: U.addDays(t0, 3), guests: 2, maxPrice: 1200, star4: false, amen: new Set(), sort: 'rec' };
  let currentHotel = null;
  let D = null; // reserva em andamento
  let demoDay = false;
  let unlockTimer = null;
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const score = (n) => n.toFixed(1).replace('.', ',');

  /* ---------- navegação ---------- */
  const VIEWS = ['home', 'hotel', 'trips', 'door', 'termos', 'privacidade'];
  function show(view) {
    VIEWS.forEach((v) => { $(`#v-${v}`).hidden = v !== view; });
    $('#nav-home').setAttribute('aria-current', view === 'home' || view === 'hotel' ? 'page' : 'false');
    $('#nav-trips').setAttribute('aria-current', view === 'trips' ? 'page' : 'false');
  }
  function go(hash) { if (location.hash === '#' + hash) route(); else location.hash = hash; }
  function route() {
    clearInterval(unlockTimer);
    const h = location.hash.slice(1);
    const door = /^porta-([a-z0-9]+)-(\d{3})$/.exec(h);
    if (!door) { clock.override = null; demoDay = false; } // a simulação de data vale só na tela da porta
    if (door) { show('door'); renderDoor(door[1], door[2]); } else if (h === 'minhas-reservas') { show('trips'); renderTrips(); } else if (h === 'termos' || h === 'privacidade') show(h);
    else { show('home'); renderGrid(); }
    window.scrollTo(0, 0);
  }

  /* ---------- busca ---------- */
  function initSearch() {
    $('#cities').innerHTML = [...new Set(app.hotels().map((h) => h.city))].map((c) => `<option value="${esc(c)}">`).join('');
    $('#q-g').innerHTML = [1, 2, 3, 4].map((n) => `<option value="${n}" ${n === S.guests ? 'selected' : ''}>${n} ${pl(n, 'hóspede', 'hóspedes')}</option>`).join('');
    $('#q-in').value = S.checkIn; $('#q-out').value = S.checkOut;
    $('#q-in').min = t0; $('#q-out').min = U.addDays(t0, 1);
    $('#f-amen').innerHTML = AMENITY_FILTERS.map((a) => `<button type="button" class="chip" data-amen="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join('');
  }
  function readSearch() {
    const err = $('#q-err');
    const i = $('#q-in').value; const o = $('#q-out').value;
    const msg = HB.validators.validateStay(i, o, clock.today(), POLICY.maxNights);
    err.hidden = !msg; err.textContent = msg || '';
    if (msg) return false;
    S.checkIn = i; S.checkOut = o; S.dest = $('#q-dest').value.trim(); S.guests = Number($('#q-g').value);
    return true;
  }
  function renderGrid() {
    const nights = U.nightsBetween(S.checkIn, S.checkOut);
    const list = app.search({ query: S.dest, checkIn: S.checkIn, checkOut: S.checkOut, guests: S.guests, maxPrice: S.maxPrice, minStars: S.star4 ? 4 : 0, amenities: [...S.amen], sort: S.sort });
    $('#count').textContent = list.length ? `${list.length} ${pl(list.length, 'hotel disponível', 'hotéis disponíveis')} · ${U.formatDate(S.checkIn)} a ${U.formatDate(S.checkOut)} · ${nights} ${pl(nights, 'noite', 'noites')}` : '';
    $('#grid').innerHTML = list.length ? list.map(({ hotel: h, from }) => `
      <button type="button" class="card" data-hotel="${h.id}">
        <div class="pic">${picture(h.scene, h.hue, 'c' + h.id, CAT.photoKeyFor(h), 640)}<span class="tag">${esc(h.highlight)}</span></div>
        <div class="body">
          <h3>${esc(h.name)}</h3>
          <div class="small muted">${esc(h.city)} · <span class="stars" aria-label="${h.stars} estrelas">${stars(h.stars)}</span></div>
          <div class="small muted">${h.reviews ? `<span class="score">${score(h.rating)}</span>${h.reviews.toLocaleString('pt-BR')} avaliações` : 'Novo no E-BoxHotel'}</div>
          <div class="foot"><span class="small muted">${esc(h.amenities.slice(0, 2).join(' · '))}</span><span class="price"><small>a partir de </small>${brl(from)}<small> /noite</small></span></div>
        </div></button>`).join('')
      : '<div class="empty"><b>Nenhum hotel encontrado para os critérios informados.</b><br>Altere as datas, aumente o valor máximo ou remova algum filtro.</div>';
  }

  /* ---------- hotel ---------- */
  function openHotel(id) {
    currentHotel = app.hotel(id);
    if (!currentHotel || currentHotel.active === false) return;
    show('hotel'); renderHotel(); window.scrollTo(0, 0);
  }
  function renderHotel() {
    const h = currentHotel;
    $('#v-hotel').innerHTML = `
    <button type="button" class="back" id="back">← Voltar à lista de hotéis</button>
    <div class="gal" style="position:relative">${picture(h.scene, h.hue, 'g' + h.id, CAT.photoKeyFor(h), 1600, true)}</div>
    <div class="dhead"><div><h1>${esc(h.name)}</h1>
      <p class="small muted" style="margin-top:6px">${esc(h.address)} · ${esc(h.city)} · <span class="stars">${stars(h.stars)}</span></p></div>
      <p class="small muted">${h.reviews ? `<span class="score">${score(h.rating)}</span>${h.reviews.toLocaleString('pt-BR')} avaliações` : 'Novo no E-BoxHotel'}</p></div>
    <p style="max-width:68ch">${esc(h.description)}</p>
    <ul class="amen">${h.amenities.map((a) => `<li>${esc(a)}</li>`).join('')}<li>Check-in digital</li><li>Entrada por QR Code</li></ul>
    <div class="cols">
      <div><h2 id="rooms-title" style="font-size:24px;margin-bottom:14px"></h2><div class="rooms" id="rooms"></div></div>
      <aside class="side" aria-label="Período da estadia">
        <h3>Período da estadia</h3>
        <div class="row2"><div class="field"><label for="d-in">Entrada</label><input id="d-in" type="date" min="${t0}" value="${S.checkIn}"></div>
        <div class="field"><label for="d-out">Saída</label><input id="d-out" type="date" min="${U.addDays(t0, 1)}" value="${S.checkOut}"></div></div>
        <div class="field"><label for="d-g">Hóspedes</label><select id="d-g">${[1, 2, 3, 4].map((k) => `<option value="${k}" ${k === S.guests ? 'selected' : ''}>${k} ${pl(k, 'hóspede', 'hóspedes')}</option>`).join('')}</select></div>
        <p class="err small" id="d-err" role="alert" style="color:var(--danger)"></p>
        <ul class="policy"><li>Entrada a partir das ${POLICY.checkInHour}h; saída até as ${POLICY.checkOutHour}h.</li><li>Cancelamento sem custo até ${POLICY.freeCancellationDays * 24} horas antes da entrada.</li><li>Acesso ao apartamento por QR Code, sem passar pela recepção.</li></ul>
      </aside>
    </div>`;
    renderRooms();
  }
  function renderRooms() {
    const h = currentHotel;
    const n = U.nightsBetween(S.checkIn, S.checkOut);
    $('#rooms-title').textContent = `Apartamentos para ${U.formatDate(S.checkIn)} a ${U.formatDate(S.checkOut)}`;
    $('#rooms').innerHTML = app.rooms(h).map((r) => {
      const left = app.available(h, r, S.checkIn, S.checkOut);
      const fits = r.capacity >= S.guests;
      const ok = left > 0 && fits;
      const note = !fits ? `Comporta até ${r.capacity} ${pl(r.capacity, 'hóspede', 'hóspedes')}` : left === 0 ? 'Indisponível no período' : left <= 2 ? `Restam ${left} ${pl(left, 'unidade', 'unidades')}` : '';
      return `<div class="room has-photo ${ok ? '' : 'off'}">
        <div class="rphoto">${picture(h.scene, h.hue, 'r' + h.id + r.id, CAT.roomPhotoKey(h.id, r.id), 320)}</div>
        <div><h3>${esc(r.name)}</h3><p class="small muted">${esc(r.beds)} · ${r.area} m² · até ${r.capacity} ${pl(r.capacity, 'hóspede', 'hóspedes')}</p>${note ? `<p class="left">${note}</p>` : ''}</div>
        <div class="buy"><div class="price">${brl(r.nightly)}<small> /noite</small></div><p class="small muted">${brl(r.nightly * n)} por ${n} ${pl(n, 'noite', 'noites')}</p>
        <button type="button" class="btn" data-room="${r.id}" ${ok ? '' : 'disabled'}>Reservar</button></div>
        ${r.plan && r.plan.length ? `<details class="plan-box"><summary>Ver planta baixa · ${CAT.planLabel(r.plan)}</summary><div class="plan-wrap">${HB.ui.planSvg(r.plan, h.id + r.id)}<ul class="plan-list">${r.plan.map((a) => `<li><b>${esc(a.name)}</b> ${CAT.meters(a.length)} × ${CAT.meters(a.width)} m</li>`).join('')}</ul></div></details>` : ''}</div>`;
    }).join('');
  }

  /* ---------- reserva ---------- */
  const STEPS = ['Dados do hóspede', 'Pagamento', 'Confirmação'];
  function startBooking(roomId) {
    if (!accounts.current()) { openAuth('in', () => startBooking(roomId)); return; }
    const me = accounts.current();
    const room = app.roomView(currentHotel, roomId);
    D = { hotel: currentHotel, room, checkIn: S.checkIn, checkOut: S.checkOut, guests: S.guests, nights: U.nightsBetween(S.checkIn, S.checkOut), step: 0, coupon: '', pay: 'pix', done: null,
      guest: { name: me.name === me.email ? '' : me.name, cpf: '', email: me.email, phone: '', arrival: '15:00', notes: '', consent: false } };
    renderPanel();
  }
  const quote = () => app.quoteFor(D.room, D.nights, D.coupon, D.pay);
  function summaryHtml() {
    const q = quote();
    return `<aside class="box sum" aria-label="Resumo da reserva">
      <div class="pic" style="height:100px;border-radius:6px;overflow:hidden;margin-bottom:12px">${picture(D.hotel.scene, D.hotel.hue, 's' + D.hotel.id, CAT.photoKeyFor(D.hotel), 480)}</div>
      <h3 style="font-size:18px">${esc(D.hotel.name)}</h3>
      <p class="small muted" style="margin-bottom:10px">${esc(D.room.name)} · ${D.guests} ${pl(D.guests, 'hóspede', 'hóspedes')}<br>${U.formatDate(D.checkIn)} → ${U.formatDate(D.checkOut)}</p>
      <dl><dt>${D.nights} ${pl(D.nights, 'diária', 'diárias')} × ${brl(D.room.nightly)}</dt><dd>${brl(q.base)}</dd>
      ${q.discount ? `<dt class="ok">Cupom ${esc(q.coupon)}</dt><dd class="ok">− ${brl(q.discount)}</dd>` : ''}
      <dt>Taxas e serviços (${Math.round(HB.pricing.TAX_RATE * 100)}%)</dt><dd>${brl(q.taxes)}</dd>
      ${q.pixDiscount ? `<dt class="ok">Desconto Pix (${Math.round(HB.pricing.PIX_DISCOUNT_RATE * 100)}%)</dt><dd class="ok">− ${brl(q.pixDiscount)}</dd>` : ''}
      <dt class="tot">Total</dt><dd class="tot">${brl(q.total)}</dd></dl></aside>`;
  }
  function renderPanel() {
    const ov = $('#overlay');
    ov.className = 'overlay'; ov.hidden = false; document.body.style.overflow = 'hidden';
    ov.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pt">
      <div class="phead"><h2 id="pt">Reserva · ${esc(D.hotel.name)}</h2><button type="button" class="x" id="close" aria-label="Fechar">✕</button></div>
      <ol class="steps">${STEPS.map((s, i) => `<li class="${i <= D.step ? 'on' : ''}" ${i === D.step ? 'aria-current="step"' : ''}>${i + 1}. ${s}</li>`).join('')}</ol>
      <div class="pbody"><div id="stepbody"></div>${D.step < 2 ? summaryHtml() : ''}</div></div>`;
    [stepGuest, stepPay, stepDone][D.step]();
    const first = $('#stepbody input, #stepbody .btn'); if (first) first.focus({ preventScroll: true });
  }
  function closeOverlay() {
    const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; ov.className = 'overlay'; document.body.style.overflow = ''; D = null;
  }
  const setErr = (scope, errors) => $$('[data-e]', scope).forEach((s) => { const m = errors[s.dataset.e] || ''; s.textContent = m; const inp = s.parentElement.querySelector('input,select,textarea'); if (inp) inp.setAttribute('aria-invalid', m ? 'true' : 'false'); });

  function stepGuest() {
    const g = D.guest;
    $('#stepbody').innerHTML = `<form class="box" id="gform" novalidate><h3 style="font-size:20px;margin-bottom:14px">Dados do hóspede responsável</h3>
      <div class="form">
        <div class="field full"><label for="g-name">Nome completo</label><input id="g-name" value="${esc(g.name)}" autocomplete="name" maxlength="120"><span class="err" data-e="name"></span></div>
        <div class="field"><label for="g-cpf">CPF</label><input id="g-cpf" value="${esc(g.cpf)}" inputmode="numeric" placeholder="000.000.000-00" autocomplete="off"><span class="err" data-e="cpf"></span></div>
        <div class="field"><label for="g-phone">Celular</label><input id="g-phone" value="${esc(g.phone)}" inputmode="tel" placeholder="(42) 99999-0000" autocomplete="tel"><span class="err" data-e="phone"></span></div>
        <div class="field full"><label for="g-email">E-mail</label><input id="g-email" type="email" value="${esc(g.email)}" autocomplete="email" maxlength="254"><span class="err" data-e="email"></span></div>
        <div class="field"><label for="g-arrival">Horário previsto de chegada</label><select id="g-arrival">${['14:00', '15:00', '16:00', '18:00', '20:00', '22:00', '00:00'].map((x) => `<option ${x === g.arrival ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="g-coupon">Cupom promocional (teste: BOX10)</label><input id="g-coupon" value="${esc(D.coupon)}" autocapitalize="characters" autocomplete="off"><span class="err" data-e="coupon" id="coupon-msg"></span></div>
        <div class="field full"><label for="g-notes">Observações (opcional)</label><textarea id="g-notes" maxlength="500">${esc(g.notes)}</textarea><span class="err" data-e="notes"></span></div>
        <div class="field full"><label class="check"><input type="checkbox" id="g-consent" ${g.consent ? 'checked' : ''}><span>Li e aceito os <a href="#termos" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="#privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label><span class="err" data-e="consent"></span></div>
      </div>
      <div class="actions"><button type="button" class="btn secondary" id="cancel">Voltar</button><button class="btn" type="submit">Continuar para o pagamento</button></div></form>`;
    $('#g-cpf').oninput = (e) => { e.target.value = U.maskCpf(e.target.value); };
    $('#g-phone').oninput = (e) => { e.target.value = U.maskPhone(e.target.value); };
    $('#g-coupon').oninput = (e) => {
      D.coupon = e.target.value.trim().toUpperCase();
      const ok = Boolean(HB.pricing.findCoupon(D.coupon));
      const m = $('#coupon-msg'); m.textContent = ok ? 'Cupom aplicado: 10% sobre as diárias.' : D.coupon ? 'Cupom inválido.' : ''; m.style.color = ok ? 'var(--ok)' : 'var(--danger)';
      $('.sum').outerHTML = summaryHtml();
    };
    $('#cancel').onclick = closeOverlay;
    $('#gform').onsubmit = (e) => {
      e.preventDefault();
      D.guest = { name: $('#g-name').value, cpf: $('#g-cpf').value, phone: $('#g-phone').value, email: $('#g-email').value, arrival: $('#g-arrival').value, notes: $('#g-notes').value, consent: $('#g-consent').checked };
      const errors = HB.validators.validateGuest(D.guest);
      setErr($('#gform'), errors);
      const first = Object.keys(errors)[0];
      if (first) { const map = { name: 'g-name', cpf: 'g-cpf', phone: 'g-phone', email: 'g-email', notes: 'g-notes', consent: 'g-consent' }; $('#' + map[first]).focus(); return; }
      D.step = 1; renderPanel();
    };
  }

  const pixCode = () => `00020126580014BR.GOV.BCB.PIX0136hotelbox-demo-${U.hash32Hex(D.hotel.id + D.checkIn)}5204000053039865802BR5909E-BOXHOTEL6009SAO PAULO62070503***6304ABCD`;
  function stepPay() {
    $('#stepbody').innerHTML = `<form class="box" id="pform" novalidate><h3 style="font-size:20px;margin-bottom:14px">Forma de pagamento</h3>
      <div class="pays" role="radiogroup" aria-label="Forma de pagamento">
        <label class="pay"><input type="radio" name="pay" value="pix" ${D.pay === 'pix' ? 'checked' : ''}><div><b>Pix · 5% de desconto</b><span>Confirmação imediata. O código é exibido abaixo.</span></div></label>
        <label class="pay"><input type="radio" name="pay" value="card" ${D.pay === 'card' ? 'checked' : ''}><div><b>Cartão de crédito</b><span>Em até 3 parcelas sem juros.</span></div></label>
        <label class="pay"><input type="radio" name="pay" value="hotel" ${D.pay === 'hotel' ? 'checked' : ''}><div><b>Pagamento no hotel</b><span>Sem cobrança agora. Um cartão será solicitado como garantia.</span></div></label>
      </div><div id="payx"></div>
      <p class="alert" style="margin-top:14px">Versão de demonstração: nenhum pagamento é processado. Os dados do cartão são apenas validados no seu navegador e descartados em seguida; nunca são gravados.</p>
      <div class="actions"><button type="button" class="btn secondary" id="prev">Voltar</button><button class="btn" type="submit" id="pay-btn"></button></div></form>`;
    const draw = () => {
      const q = quote();
      $('#payx').innerHTML = D.pay === 'pix' ? `<div class="field"><span class="lbl">Pix copia e cola</span><div class="pix" id="pixc">${esc(pixCode())}</div><button type="button" class="btn secondary sm" id="copy" style="align-self:flex-start">Copiar código</button></div>`
        : D.pay === 'card' ? `<div class="form"><div class="field full"><label for="c-num">Número do cartão</label><input id="c-num" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"><span class="err" data-e="number"></span></div>
          <div class="field full"><label for="c-holder">Nome impresso no cartão</label><input id="c-holder" autocomplete="cc-name"><span class="err" data-e="holder"></span></div>
          <div class="field"><label for="c-exp">Validade</label><input id="c-exp" inputmode="numeric" placeholder="MM/AA" autocomplete="cc-exp"><span class="err" data-e="expiry"></span></div>
          <div class="field"><label for="c-cvv">Código de segurança</label><input id="c-cvv" inputmode="numeric" maxlength="4" autocomplete="cc-csc"><span class="err" data-e="cvv"></span></div>
          <div class="field full"><label for="c-inst">Parcelamento</label><select id="c-inst">${[1, 2, 3].map((n) => { const p = HB.pricing.installments(q.total, n); return `<option>${n}x de ${brl(p.each)}${n > 1 ? ' sem juros' : ''}</option>`; }).join('')}</select></div></div>`
          : `<p class="alert">O valor de ${brl(q.total)} será pago na chegada. Cancelamento sem custo até ${POLICY.freeCancellationDays * 24} horas antes da entrada.</p>`;
      $('#pay-btn').textContent = D.pay === 'hotel' ? 'Confirmar reserva' : `Pagar ${brl(q.total)}`;
      if (D.pay === 'card') {
        $('#c-num').oninput = (e) => { e.target.value = U.maskCard(e.target.value); };
        $('#c-exp').oninput = (e) => { e.target.value = U.maskExpiry(e.target.value); };
        $('#c-cvv').oninput = (e) => { e.target.value = U.onlyDigits(e.target.value); };
      }
      if (D.pay === 'pix') {
        $('#copy').onclick = () => {
          try { navigator.clipboard.writeText(pixCode()).then(() => toast('Código Pix copiado.')).catch(() => toast('Selecione o código e copie manualmente.')); } catch { toast('Selecione o código e copie manualmente.'); }
        };
      }
    };
    draw();
    $$('input[name=pay]').forEach((r) => { r.onchange = () => { D.pay = r.value; draw(); $('.sum').outerHTML = summaryHtml(); }; });
    $('#prev').onclick = () => { D.step = 0; renderPanel(); };
    $('#pform').onsubmit = (e) => {
      e.preventDefault();
      if (D.pay === 'card') {
        const errors = HB.validators.validateCard({ number: $('#c-num').value, holder: $('#c-holder').value, expiry: $('#c-exp').value, cvv: $('#c-cvv').value }, clock.today());
        setErr($('#payx'), errors);
        if (Object.keys(errors).length) return;
        ['#c-num', '#c-holder', '#c-exp', '#c-cvv'].forEach((s) => { $(s).value = ''; });
      }
      try {
        D.done = app.book({ hotelId: D.hotel.id, roomTypeId: D.room.id, stay: { checkIn: D.checkIn, checkOut: D.checkOut, guests: D.guests }, guest: D.guest, payment: D.pay, coupon: D.coupon, owner: accounts.current() });
        updateBadge(); D.step = 2; renderPanel();
      } catch (err) {
        toast(err.message);
        if (/dispon/.test(err.message)) { closeOverlay(); if (currentHotel) renderRooms(); }
      }
    };
  }

  function stepDone() {
    const b = D.done; const h = D.hotel; const no = b.roomNumber;
    $('#stepbody').style.gridColumn = '1 / -1';
    $('#stepbody').innerHTML = `<div class="box done"><div class="ck" aria-hidden="true">✓</div>
      <h2 style="font-size:28px">Reserva confirmada</h2>
      <p class="muted">O comprovante seria enviado para ${esc(U.maskEmailPrivate(b.guest.email))} (na versão de demonstração, nenhum e-mail é enviado).</p>
      <p class="muted" style="margin-top:12px">Código da reserva</p><div class="code">${esc(b.code)}</div>
      <p class="muted">Seu apartamento</p><div class="roomno">${esc(no)}</div>
      <h3 style="font-size:20px;margin-top:10px">Como acessar o apartamento</h3>
      <ol class="stepsl"><li>Chegue a partir de ${U.formatDate(b.checkIn)}, às ${POLICY.checkInHour}h.</li><li>Vá direto ao apartamento ${esc(no)} e aponte a câmera do celular para o QR Code da porta.</li><li>Confirme os 3 últimos dígitos do seu CPF. A porta é liberada em seguida.</li></ol>
      <p class="small muted" style="max-width:54ch;margin:4px auto 8px">Sem sinal de internet? Use o PIN de apoio <b style="font-family:var(--mono)">${esc(b.backupPin)}</b> no teclado da porta.</p>
      <dl class="kv"><dt class="muted">Hotel</dt><dd>${esc(h.name)}</dd><dt class="muted">Endereço</dt><dd>${esc(h.address)}, ${esc(h.city)}</dd><dt class="muted">Apartamento</dt><dd>${esc(D.room.name)}</dd><dt class="muted">Pagamento</dt><dd>${esc(HB.booking.PAYMENT_METHODS[b.payment])} · ${brl(b.total)}</dd></dl>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn" id="to-trips">Minhas reservas</button><button type="button" class="btn secondary" id="to-home">Nova busca</button></div></div>`;
    $('#to-trips').onclick = () => { closeOverlay(); go('minhas-reservas'); };
    $('#to-home').onclick = () => { closeOverlay(); go('hoteis'); };
  }


  /* ---------- conta do cliente ---------- */
  function renderAccount() {
    const me = accounts.current();
    const hello = $('#acct-hello'); const btn = $('#acct-btn');
    hello.hidden = !me; hello.textContent = me ? `Olá, ${String(me.name).split(' ')[0]}` : '';
    btn.textContent = me ? 'Sair' : 'Entrar';
    btn.setAttribute('aria-label', me ? 'Sair da conta' : 'Entrar ou criar conta');
    updateBadge();
    if (!$('#v-trips').hidden) renderTrips();
  }
  function openAuth(view, after) {
    const ov = $('#overlay'); ov.className = 'overlay center'; ov.hidden = false; document.body.style.overflow = 'hidden';
    const fld = (id, label, type, ph, auto) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${ph ? `placeholder="${ph}"` : ''} autocomplete="${auto}"><span class="err" data-e="${id.slice(2)}"></span></div>`;
    const tabs = (v) => `<div class="tabs" role="tablist" style="margin:0 0 14px"><button type="button" class="chip" role="tab" aria-pressed="${v === 'in'}" data-v="in">Entrar</button><button type="button" class="chip" role="tab" aria-pressed="${v === 'up'}" data-v="up">Criar conta</button></div>`;
    const note = accounts.mode === 'local' ? '<p class="small muted">Modo demonstração: as contas ficam apenas neste navegador.</p>' : '';
    function paint(v) {
      const form = v === 'up' ? `${fld('a-name', 'Nome completo', 'text', '', 'name')}${fld('a-email', 'E-mail', 'email', '', 'email')}${fld('a-password', 'Senha', 'password', 'Mínimo de 8 caracteres, com maiúscula, minúscula e número', 'new-password')}<p class="small muted">Ao criar a conta você concorda com os <a href="#termos">Termos de Uso</a> e a <a href="#privacidade">Política de Privacidade</a>.</p>`
        : v === 'reset' ? `<p class="muted">Informe o e-mail da conta para receber o link de redefinição.</p>${fld('a-email', 'E-mail', 'email', '', 'email')}`
          : `${fld('a-email', 'E-mail', 'email', '', 'email')}${fld('a-password', 'Senha', 'password', '', 'current-password')}<p class="small"><button type="button" class="link" data-v="reset">Esqueci minha senha</button></p>`;
      ov.innerHTML = `<div class="box modal" role="dialog" aria-modal="true" aria-labelledby="at" style="max-width:440px"><div class="phead"><h2 id="at" style="font-size:24px">${v === 'reset' ? 'Recuperar senha' : v === 'up' ? 'Criar conta' : 'Entrar'}</h2><button type="button" class="x" id="aclose" aria-label="Fechar">✕</button></div>
        ${v === 'reset' ? '' : tabs(v)}<form id="aform" class="stack" novalidate>${form}<div class="alert error" data-general role="alert" hidden></div><div class="alert ok" data-info role="status" hidden></div>${note}
        <button type="submit" class="btn" id="asubmit">${v === 'up' ? 'Criar conta' : v === 'reset' ? 'Enviar link' : 'Entrar'}</button>${v === 'reset' ? '<button type="button" class="btn secondary" data-v="in">Voltar</button>' : ''}</form></div>`;
      $('#aclose').onclick = closeOverlay;
      ov.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => paint(b.dataset.v); });
      const first = ov.querySelector('input'); if (first) first.focus();
      const form$ = $('#aform');
      form$.onsubmit = async (e) => {
        e.preventDefault();
        const g = form$.querySelector('[data-general]'); const info = form$.querySelector('[data-info]'); const sb = $('#asubmit');
        g.hidden = true; info.hidden = true; form$.querySelectorAll('[data-e]').forEach((x) => { x.textContent = ''; });
        const val = (id) => { const el = $(id); return el ? el.value : ''; };
        sb.disabled = true;
        try {
          const r = v === 'up' ? await accounts.signUp({ name: val('#a-name'), email: val('#a-email'), password: val('#a-password') })
            : v === 'reset' ? await accounts.resetPassword(val('#a-email'))
              : await accounts.signIn({ email: val('#a-email'), password: val('#a-password') });
          if (!r.ok) {
            if (r.fields) Object.entries(r.fields).forEach(([k, m]) => { const el = form$.querySelector(`[data-e="${k === 'password' ? 'password' : k}"]`); if (el) el.textContent = m; });
            g.hidden = false; g.textContent = r.error; return;
          }
          if (v === 'reset') { info.hidden = false; info.textContent = r.message; return; }
          if (r.needsConfirm) { paint('in'); const i2 = ov.querySelector('[data-info]'); i2.hidden = false; i2.textContent = 'Conta criada. Enviamos um link de confirmação para o seu e-mail; confirme e depois entre.'; return; }
          closeOverlay(); toast(v === 'up' ? 'Conta criada. Bem-vindo(a)!' : 'Você entrou na sua conta.');
          if (after) after();
        } catch (err) { g.hidden = false; g.textContent = err.message || 'Não foi possível concluir.'; } finally { sb.disabled = false; }
      };
    }
    paint(view);
  }
  $('#acct-btn').onclick = async () => {
    if (accounts.current()) { await accounts.signOut(); toast('Você saiu da conta.'); if (!$('#v-trips').hidden) renderTrips(); } else openAuth('in');
  };
  accounts.onChange(renderAccount);
  accounts.ready().then(renderAccount);

  /* ---------- minhas reservas ---------- */
  function updateBadge() {
    const n = myBookings().filter(HB.booking.isActive).length;
    const b = $('#trip-count'); b.hidden = !n; b.textContent = n;
  }
  /** Reservas da conta conectada (e as antigas, sem dono, feitas antes do login existir). */
  function myBookings() {
    const me = accounts.current();
    return app.store.listBookings().filter((b) => !b.ownerId || (me && b.ownerId === me.id));
  }
  function renderTrips() {
    if (!accounts.current()) {
      $('#trips').innerHTML = '<div class="empty">Entre na sua conta para ver e gerenciar suas reservas.<br><button type="button" class="btn" style="margin-top:14px" data-login>Entrar ou criar conta</button></div>';
      return;
    }
    const all = myBookings();
    $('#trips').innerHTML = all.length ? all.map((b) => {
      const h = app.hotel(b.hotelId); const r = h && app.roomView(h, b.roomTypeId);
      const active = HB.booking.isActive(b); const terms = HB.booking.cancellationTerms(b, clock.today());
      return `<article class="trip">
        <div class="pic">${picture(h.scene, h.hue, 't' + b.code, CAT.photoKeyFor(h), 480)}</div>
        <div class="info"><p><span class="status ${active ? 'ok' : 'bad'}">${active ? 'Confirmada' : 'Cancelada'}</span> <span class="small muted">${esc(b.code)}</span></p>
          <h3 style="font-size:21px">${esc(h.name)}</h3>
          <p class="small muted">${esc(r ? r.name : '')} · ${b.guests} ${pl(b.guests, 'hóspede', 'hóspedes')} · ${U.formatDate(b.checkIn)} → ${U.formatDate(b.checkOut)} · ${b.nights} ${pl(b.nights, 'noite', 'noites')}</p>
          <p class="small muted">Total ${brl(b.total)} · ${esc(b.guest.name)} · ${esc(U.maskEmailPrivate(b.guest.email))}${active && terms.allowed && terms.free ? ` · cancelamento sem custo até ${U.formatDate(terms.freeUntil)}` : ''}</p>
          ${active ? `<p><b>Apartamento ${esc(b.roomNumber)}</b> <span class="small muted">· ${b.checkedInAt ? 'Check-in realizado' : 'Check-in pelo QR Code da porta'}</span></p>` : ''}</div>
        <div class="act">${active ? `<button type="button" class="btn sm" data-plate="${esc(b.code)}">Simular chegada</button>` : ''}${terms.allowed ? `<button type="button" class="btn danger sm" data-cancel="${esc(b.code)}">Cancelar reserva</button>` : ''}<button type="button" class="btn secondary sm" data-open="${h.id}">Ver hotel</button></div></article>`;
    }).join('') : '<div class="empty">Você ainda não possui reservas.<br><button type="button" class="btn" style="margin-top:14px" data-go="hoteis">Pesquisar hotéis</button></div>';
  }
  function confirmCancel(code) {
    const b = app.store.getBooking(code); if (!b) return;
    const t = HB.booking.cancellationTerms(b, clock.today()); if (!t.allowed) { toast(t.reason); return; }
    const ov = $('#overlay'); ov.className = 'overlay center'; ov.hidden = false; document.body.style.overflow = 'hidden';
    const refundTxt = b.payment === 'hotel' ? 'Não houve cobrança antecipada.' : `Estorno de ${brl(t.refund)} na forma de pagamento utilizada, em até 5 dias úteis.`;
    ov.innerHTML = `<div class="box" role="alertdialog" aria-modal="true" aria-labelledby="ct" style="max-width:440px;margin:16px"><h3 id="ct" style="font-size:22px">Cancelar a reserva ${esc(code)}?</h3>
      <p style="margin-top:8px">${t.free ? 'O cancelamento é gratuito.' : `Faltam menos de ${POLICY.freeCancellationDays * 24} horas para a entrada: será retida a primeira diária (${brl(t.fee)}).`} ${refundTxt}</p>
      <div class="actions"><button type="button" class="btn secondary" id="no">Manter reserva</button><button type="button" class="btn danger" id="yes">Confirmar cancelamento</button></div></div>`;
    $('#no').focus(); $('#no').onclick = closeOverlay;
    $('#yes').onclick = () => { try { app.cancelBooking(code, 'cliente'); } catch (e) { toast(e.message); } closeOverlay(); updateBadge(); renderTrips(); toast('Reserva cancelada.'); };
  }

  /* ---------- porta ---------- */
  const doorUrl = (hid, no) => `${location.href.split('#')[0]}#porta-${hid}-${no}`;
  function showPlate(code) {
    const b = app.store.getBooking(code); if (!b) return;
    const h = app.hotel(b.hotelId);
    const ov = $('#overlay'); ov.className = 'overlay center'; ov.hidden = false; document.body.style.overflow = 'hidden';
    ov.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="plt" style="max-width:380px;margin:16px;text-align:center">
      <h3 id="plt" style="font-size:20px">Simulação: chegada ao apartamento</h3>
      <p class="small muted" style="margin:6px 0 12px">Esta é a placa fixada na porta. No hotel, você lê o QR Code com a câmera do próprio celular.</p>
      <div class="plate"><p class="small" style="opacity:.8">${esc(h.name)}</p><div class="no">${esc(b.roomNumber)}</div><div class="qr">${qrSvg(doorUrl(h.id, b.roomNumber))}</div><p class="small" style="opacity:.85">Aponte a câmera para entrar</p></div>
      <div class="actions"><button type="button" class="btn secondary" id="pl-x">Fechar</button><button type="button" class="btn" id="pl-scan">Ler QR Code</button></div></div>`;
    $('#pl-x').onclick = closeOverlay;
    $('#pl-scan').onclick = () => { closeOverlay(); location.hash = `porta-${h.id}-${b.roomNumber}`; };
  }
  const MAX_DOOR_FAILS = 5; const DOOR_LOCK_MIN = 5;
  const doorState = (code) => (app.store.getPrefs().doorFails || {})[code] || { n: 0, until: 0 };
  const setDoorState = (code, s) => { const all = { ...(app.store.getPrefs().doorFails || {}) }; all[code] = s; app.store.setPrefs({ doorFails: all }); };

  function doorShell(inner) {
    return `<div class="doorcard">${inner}<div class="demo"><input type="checkbox" id="demo-day" ${demoDay ? 'checked' : ''}><label for="demo-day">Demonstração: simular que hoje é a data de entrada</label></div></div>`;
  }
  function renderDoor(hid, no) {
    const el = $('#v-door'); const h = app.hotel(hid);
    const rerender = () => renderDoor(hid, no);
    const bind = () => { const c = $('#demo-day'); if (c) c.onchange = () => { demoDay = c.checked; rerender(); }; };
    const head = h ? `<p class="small muted">${esc(h.name)}</p><div class="no" style="font:600 60px var(--display)">${esc(no)}</div>` : '';
    if (!h) { el.innerHTML = `<div class="doorcard"><div class="box"><h2>QR Code não reconhecido</h2><p class="muted" style="margin:8px 0 14px">Este código não pertence a nenhum apartamento do E-BoxHotel.</p><button type="button" class="btn" data-go="hoteis">Ir para o início</button></div></div>`; return; }
    const cand = app.store.listBookings().find((b) => HB.booking.isActive(b) && b.hotelId === hid && b.roomNumber === no);
    clock.override = demoDay && cand ? cand.checkIn : null;
    const st = HB.booking.checkInStatus({ bookings: app.store.listBookings(), hotelId: hid, roomNumber: no, todayIso: clock.today() });
    const msg = {
      'not-found': ['Reserva não localizada', 'Não encontramos uma reserva ativa para este apartamento neste aparelho. Abra o QR Code no mesmo celular em que a reserva foi feita.'],
      'wrong-room': ['Este não é o seu apartamento', st.other ? `Sua reserva neste hotel é para o apartamento ${esc(st.other.roomNumber)}.` : ''],
      'too-early': ['Ainda não é a data da sua entrada', st.booking ? `O acesso é liberado em ${U.formatDate(st.booking.checkIn)}, a partir das ${POLICY.checkInHour}h.` : ''],
      ended: ['Estadia encerrada', st.booking ? `A reserva terminou em ${U.formatDate(st.booking.checkOut)}. Este QR Code não libera mais a porta.` : ''],
    }[st.status];
    if (msg) { el.innerHTML = doorShell(`<div class="box">${head}<h2 style="font-size:24px;margin-top:8px">${msg[0]}</h2><p class="muted" style="margin:8px 0 14px">${msg[1]}</p><button type="button" class="btn secondary" data-go="minhas-reservas">Minhas reservas</button></div>`); bind(); return; }
    const b = st.booking; const ds = doorState(b.code); const lockLeft = ds.until > Date.now() ? Math.ceil((ds.until - Date.now()) / 60000) : 0;
    el.innerHTML = doorShell(`<form class="box" id="dform" novalidate>${head}
      <h2 style="font-size:24px;margin:8px 0 4px">Bem-vindo(a), ${esc(U.firstName(b.guest.name))}</h2>
      <p class="small muted">${esc((app.roomView(h, b.roomTypeId) || {}).name)} · ${U.formatDate(b.checkIn)} → ${U.formatDate(b.checkOut)}</p>
      ${lockLeft ? `<p class="alert error" style="margin-top:14px" role="alert">Muitas tentativas incorretas. Tente novamente em ${lockLeft} min ou procure o atendimento do hotel.</p>` : `<div class="field" style="text-align:left;margin:14px 0"><label for="d-cpf">Confirme os 3 últimos dígitos do CPF</label><input id="d-cpf" inputmode="numeric" maxlength="3" autocomplete="off"><span class="err" id="d-e"></span></div><button class="btn block" type="submit">Liberar porta</button>`}</form>`);
    bind();
    const inp = $('#d-cpf'); if (!inp) return;
    inp.focus({ preventScroll: true }); inp.oninput = () => { inp.value = U.onlyDigits(inp.value); };
    $('#dform').onsubmit = (e) => {
      e.preventDefault();
      if (!HB.booking.verifyCheckinDigits(b, inp.value)) {
        const n = ds.n + 1; const lock = n >= MAX_DOOR_FAILS;
        setDoorState(b.code, { n: lock ? 0 : n, until: lock ? Date.now() + DOOR_LOCK_MIN * 60000 : 0 });
        if (lock) { rerender(); return; }
        $('#d-e').textContent = `Dígitos incorretos. ${MAX_DOOR_FAILS - n} tentativa(s) restante(s).`; return;
      }
      setDoorState(b.code, { n: 0, until: 0 });
      if (!b.checkedInAt) app.registerCheckIn(b.code, 'hóspede');
      let s = POLICY.doorUnlockSeconds;
      const draw = () => {
        el.innerHTML = doorShell(`<div class="unlocked" role="status"><p class="small" style="opacity:.9">${esc(h.name)}</p><div class="no">Apartamento ${esc(no)}</div>
          <h2 style="font-size:28px;margin:6px 0">${s > 0 ? 'Porta liberada' : 'Porta travada novamente'}</h2>
          <p>${s > 0 ? `Empurre a porta. Ela será travada em ${s}s.` : 'Para entrar novamente, leia o QR Code outra vez.'}</p></div>
          <p class="small muted" style="margin-top:14px">Saída até ${U.formatDate(b.checkOut)}, às ${POLICY.checkOutHour}h. Basta fechar a porta ao sair; não há chave para devolver.</p>`);
        bind();
      };
      draw();
      unlockTimer = setInterval(() => { s -= 1; draw(); if (s <= 0) clearInterval(unlockTimer); }, 1000);
    };
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.go) return go(d.go);
    if (t.id === 'brand') return go('hoteis');
    if (d.hotel || d.open) return openHotel(d.hotel || d.open);
    if (d.login !== undefined) return openAuth('in');
    if (d.room) return startBooking(d.room);
    if (d.cancel) return confirmCancel(d.cancel);
    if (d.plate) return showPlate(d.plate);
    if (t.id === 'back') { show('home'); renderGrid(); return; }
    if (t.id === 'close') return closeOverlay();
    if (d.star !== undefined) { S.star4 = !S.star4; t.setAttribute('aria-pressed', S.star4); renderGrid(); }
    if (d.amen) { S.amen.has(d.amen) ? S.amen.delete(d.amen) : S.amen.add(d.amen); t.setAttribute('aria-pressed', S.amen.has(d.amen)); renderGrid(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#overlay').hidden) closeOverlay(); });
  $('#search').addEventListener('submit', (e) => { e.preventDefault(); if (readSearch()) renderGrid(); });
  $('#q-in').addEventListener('change', () => { const i = $('#q-in').value; if (i) { $('#q-out').min = U.addDays(i, 1); if ($('#q-out').value <= i) $('#q-out').value = U.addDays(i, 2); } });
  $('#f-price').addEventListener('input', (e) => { S.maxPrice = Number(e.target.value); $('#f-price-o').textContent = S.maxPrice >= 1200 ? 'R$ 1.200+' : brl(S.maxPrice).replace(',00', ''); renderGrid(); });
  $('#f-sort').addEventListener('change', (e) => { S.sort = e.target.value; renderGrid(); });
  $('#v-hotel').addEventListener('change', (e) => {
    if (!['d-in', 'd-out', 'd-g'].includes(e.target.id)) return;
    const i = $('#d-in').value; if (e.target.id === 'd-in' && i && $('#d-out').value <= i) $('#d-out').value = U.addDays(i, 1);
    const o = $('#d-out').value; const msg = HB.validators.validateStay(i, o, clock.today(), POLICY.maxNights);
    $('#d-err').textContent = msg || ''; if (msg) return;
    S.checkIn = i; S.checkOut = o; S.guests = Number($('#d-g').value);
    $('#q-in').value = i; $('#q-out').value = o; $('#q-g').value = S.guests;
    renderRooms();
  });
  window.addEventListener('hashchange', route);

  HB.ui.initTheme(app);
  $('#storage-warning').innerHTML = HB.ui.storageWarning(persistent);
  initSearch(); updateBadge(); route();
  root.HB.client = { app }; // depuração e testes de interface
})(typeof window !== 'undefined' ? window : globalThis);
