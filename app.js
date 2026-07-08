/* ============================================================================
   LITORAL ADVENTURE · Lógica de la app (offline-first, sin dependencias)
   ============================================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pointById = id => LA_POINTS.find(p => p.id === id);

/* ---------- Utilidades ---------- */
function haversine(a, b, c, d){                 // metros entre (a,b) y (c,d)
  const R = 6371000, r = Math.PI/180;
  const dLat = (c-a)*r, dLng = (d-b)*r;
  const s = Math.sin(dLat/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function fmtDist(m){ return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km'; }
function esc(t=''){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const estadoClass = e => /peligro/i.test(e) ? 'st-peligro' : /vulnerable/i.test(e) ? 'st-vulnerable' : 'st-menor';
const protLabel = {
  exclusion:  {t:'Zona de exclusión', c:'exclusion',  txt:'No desembarcar · observar desde el agua'},
  estricta:   {t:'Conservación estricta', c:'estricta', txt:'No salir del sendero habilitado'},
  observacion:{t:'Área de observación', c:'', txt:'Observa sin intervenir'},
  libre:      {t:'Acceso libre controlado', c:'', txt:''},
  sendero:    {t:'Sendero habilitado', c:'', txt:''}
};

/* ---------- Estado global ---------- */
const state = {
  view: 'inicio',
  pos: null,               // {lat,lng}
  speciesFilter: 'todos',
  alertedNow: new Set(),   // ids de puntos ya alertados (para no repetir)
  mode: 'pie',             // 'pie' | 'bici'  (bici = radio de aviso mayor)
  currentZone: null,       // zona activa en el modo En Ruta
  lastPos: null,           // última posición GPS (para medir avance)
  distAccum: 0,            // metros acumulados desde el último aliento
  lastAliento: 0,          // timestamp del último aliento
  lastAlientoIdx: -1       // para no repetir frase seguida
};

/* ---------- Guía por voz (text-to-speech, gratis y offline) ---------------- */
const TTS = {
  on: true,
  voice: null,
  supported: ('speechSynthesis' in window),
  init(){
    if (!TTS.supported) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      TTS.voice = vs.find(v => /es[-_]CL/i.test(v.lang))
               || vs.find(v => /es[-_](419|MX|US|AR|PE)/i.test(v.lang))
               || vs.find(v => /^es/i.test(v.lang)) || null;
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  },
  speak(text){
    if (!TTS.supported || !TTS.on) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (TTS.voice) u.voice = TTS.voice;
    u.lang = (TTS.voice && TTS.voice.lang) || 'es-CL';
    u.rate = 0.97; u.pitch = 1;
    speechSynthesis.speak(u);
  },
  stop(){ if (TTS.supported) speechSynthesis.cancel(); }
};
TTS.init();

/* ---------- Colección de especies avistadas (gamificación) ----------------- */
const COL_KEY = 'la_collection_v1';
function loadCol(){ try { return JSON.parse(localStorage.getItem(COL_KEY)) || []; } catch { return []; } }
function saveCol(a){ localStorage.setItem(COL_KEY, JSON.stringify(a)); }
function isSeen(id){ return loadCol().includes(id); }
function markSeen(id){ const c = loadCol(); if (!c.includes(id)){ c.push(id); saveCol(c); } }
function markUnseen(id){ saveCol(loadCol().filter(x => x !== id)); }
function toggleSeen(id){ isSeen(id) ? markUnseen(id) : markSeen(id); return isSeen(id); }

/* ruta de la foto real (Wikimedia, descargada en assets/species) */
const imgFor = id => `assets/species/${id}.jpg`;
const imgCredit = id => (window.LA_IMG && LA_IMG[id]) || null;

/* radio de geocerca según modo (en bici se avisa antes porque vas más rápido) */
const modeRadius = pt => pt.geofence * (state.mode === 'bici' ? 2.6 : 1);

/* ============================================================================
   ROUTER
   ============================================================================ */
function go(view){
  state.view = view;
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === view));
  const v = $('#view');
  v.innerHTML = VIEWS[view] ? VIEWS[view]() : '<p class="muted">Vista no encontrada.</p>';
  window.scrollTo(0,0);
  if (AFTER[view]) AFTER[view]();
}
$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (b) go(b.dataset.view);
});

/* ============================================================================
   VISTAS (devuelven HTML)
   ============================================================================ */
const VIEWS = {};

/* ---- INICIO ---- */
VIEWS.inicio = () => `
  <section class="hero">
    <h1>Vive Algarrobo desde el mar 🌊</h1>
    <p>Tu guía eco offline: rutas, especies, mareas y las travesías educativas en SUP a la Isla de los Pingüinos.</p>
  </section>

  <div class="stat-row">
    <div class="stat"><b>${LA_ROUTES.length}</b><span>rutas</span></div>
    <div class="stat"><b>${LA_SPECIES.length}</b><span>especies</span></div>
    <div class="stat"><b>${LA_POINTS.length}</b><span>puntos clave</span></div>
  </div>

  <div class="card" style="display:flex;align-items:center;gap:12px">
    <span style="font-size:26px">📴</span>
    <div><b style="font-size:14px">Funciona sin conexión</b>
      <p class="muted">Descarga la guía una vez y úsala en terreno aunque no tengas señal.</p></div>
  </div>

  <h2 class="section-title">Explora</h2>
  <div class="quick-grid">
    <button class="quick quick--go" data-goto="enruta"><span class="ico">🎧</span><b>Recorrido guiado</b><small>Tu guía de voz de flora y fauna en terreno</small></button>
    <button class="quick" data-goto="mapa"><span class="ico">🧭</span><b>Mapa y rutas</b><small>Navega y recibe alertas de zonas protegidas</small></button>
    <button class="quick" data-goto="especies"><span class="ico">🔍</span><b>Guía de especies</b><small>Fauna marina y costera de Algarrobo</small></button>
    <button class="quick" data-goto="cuaderno"><span class="ico">📖</span><b>Cuaderno de campo</b><small>Registra tus avistamientos</small></button>
    <button class="quick" data-goto="travesias"><span class="ico">🐧</span><b>Travesías SUP</b><small>Reserva tu experiencia educativa</small></button>
  </div>

  <h2 class="section-title">🌊 Mareas de hoy <span class="pill st-menor" style="font-weight:600">demo</span></h2>
  ${tideStripHTML()}
  <p class="note">Datos de marea de ejemplo. En producción se cargan de la tabla oficial del SHOA para Algarrobo y quedan guardados para uso offline.</p>
`;

/* ---- MAPA ---- */
VIEWS.mapa = () => `
  <h2 class="section-title">🧭 Mapa y navegación</h2>
  <div class="map-wrap">
    ${mapSVG()}
    <div class="gps-readout" id="gpsReadout">
      <span>📍</span><span>Ubicación: <b id="gpsText">activando GPS…</b></span>
    </div>
  </div>
  <button class="btn" id="startGuided" style="margin-bottom:14px">🎧 Iniciar recorrido guiado</button>
  <div class="legend">
    <span><i style="background:var(--la-danger)"></i>Exclusión</span>
    <span><i style="background:#b5651d"></i>Conservación estricta</span>
    <span><i style="background:var(--la-teal)"></i>Observación</span>
    <span><i style="background:var(--la-green)"></i>Sendero</span>
  </div>

  <h2 class="section-title">Rutas oficiales</h2>
  ${LA_ROUTES.map(r => `
    <div class="card route-card" data-route="${r.id}" style="cursor:pointer">
      <div class="bar" style="background:${r.color}"></div>
      <div style="flex:1">
        <h3>${esc(r.nombre)}</h3>
        <p class="muted">${esc(r.interes)}</p>
        <div class="route-meta">
          <span class="pill st-menor">${r.distancia_km} km</span>
          <span class="pill st-menor">⏱ ${esc(r.duracion)}</span>
          <span class="pill st-vulnerable">${esc(r.dificultad)}</span>
          <span class="pill st-menor">${({pie:'🚶 A pie',bici:'🚴 En bici',ambas:'🚶🚴 A pie y bici'})[LA_ROUTE_TYPE[r.id]]||''}</span>
        </div>
      </div>
    </div>`).join('')}
`;

/* ---- EN RUTA (guía virtual por voz) ---- */
VIEWS.enruta = () => {
  const total = LA_SPECIES.length, seen = loadCol().length;
  const pct = total ? Math.round(seen/total*100) : 0;
  return `
    <h2 class="section-title">🎧 Recorrido guiado</h2>
    <p class="muted" style="margin-bottom:12px">Activa el GPS y camina o pedalea: tu guía te irá contando por voz la flora y fauna de cada zona.</p>

    <div class="er-controls">
      <div class="seg" id="modeSeg">
        <button data-mode="pie"  class="${state.mode==='pie'?'on':''}">🚶 A pie</button>
        <button data-mode="bici" class="${state.mode==='bici'?'on':''}">🚴 En bici</button>
      </div>
      <button class="voice-toggle ${TTS.on?'on':''}" id="voiceToggle" aria-label="Voz">${TTS.on?'🔊':'🔇'}</button>
    </div>
    ${TTS.supported ? '' : '<p class="note">Tu navegador no soporta voz; verás la narración en texto.</p>'}

    <div class="progress-card">
      <div class="progress-head"><b>Tu colección</b><span>${seen} / ${total} especies</span></div>
      <div class="progress-bar"><i style="width:${pct}%"></i></div>
    </div>

    <div id="alientoBox" class="aliento-box" aria-live="polite"></div>

    <div id="zonePanel">${state.currentZone ? zonePanelHTML(state.currentZone) : zoneIdleHTML()}</div>

    <div class="card demo-box">
      <label for="simZone">🧪 Modo prueba — simula llegar a una zona (para probar sin estar en Algarrobo)</label>
      <select id="simZone">
        <option value="">Elige una zona…</option>
        ${LA_POINTS.map(p=>`<option value="${p.id}">${p.icono} ${esc(p.nombre.split('(')[0].trim())}</option>`).join('')}
      </select>
      <button class="btn secondary small" id="testAliento" style="margin-top:10px">💪 Escuchar una frase de aliento</button>
    </div>

    <div class="gps-readout" style="border:1px solid var(--la-line);border-radius:12px;margin-top:6px">
      <span>📍</span><span id="erGps">activando GPS…</span>
    </div>
  `;
};

function zoneIdleHTML(){
  return `<div class="zone-idle"><span class="big">🧭</span><b>Acércate a una zona</b>
    <p class="muted">Cuando entres al área de un punto de interés, tu guía empezará a hablar y aquí aparecerá su flora y fauna. ¿Estás lejos? Usa el modo prueba de abajo.</p></div>`;
}

function zonePanelHTML(id){
  const p = pointById(id); if (!p) return zoneIdleHTML();
  const narr = LA_NARRATION[id] || p.resumen;
  const sp = LA_SPECIES.filter(s => s.donde.includes(id));
  const fauna = sp.filter(s => s.reino !== 'flora');
  const flora = sp.filter(s => s.reino === 'flora');
  const cardHTML = s => `
    <div class="er-species ${isSeen(s.id)?'seen':''}">
      <div class="er-thumb" data-openspecies="${s.id}">
        <img src="${imgFor(s.id)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
        <span class="dex-emoji" style="display:none">${s.emoji}</span>
      </div>
      <div style="flex:1" data-openspecies="${s.id}"><b>${esc(s.nombre)}</b><br><i style="font-size:12px;color:var(--la-ink-2)">${esc(s.cientifico)}</i></div>
      <button class="see-btn" data-see="${s.id}">${isSeen(s.id)?'✓ Visto':'👁 ¡Lo vi!'}</button>
    </div>`;
  return `
    <div class="zone-live">
      <div class="zone-live__head"><span class="live-dot"></span> EN ZONA</div>
      <h3>${p.icono} ${esc(p.nombre.split('(')[0].trim())}</h3>
      <p class="narration">${esc(narr)}</p>
      <button class="btn secondary small" id="replayNarr">🔊 Repetir narración</button>
      ${fauna.length?`<h4 class="er-group">🐾 Fauna aquí</h4>${fauna.map(cardHTML).join('')}`:''}
      ${flora.length?`<h4 class="er-group">🌿 Flora aquí</h4>${flora.map(cardHTML).join('')}`:''}
    </div>`;
}

function enterZone(id, narrate){
  if (!pointById(id)) return;
  state.currentZone = id;
  const panel = $('#zonePanel');
  if (panel){ panel.innerHTML = zonePanelHTML(id); wireZonePanel(); }
  if (narrate) TTS.speak(LA_NARRATION[id] || pointById(id).resumen);
  if (navigator.vibrate) navigator.vibrate(60);
}

function wireZonePanel(){
  const rp = $('#replayNarr');
  if (rp) rp.onclick = () => { if (state.currentZone) TTS.speak(LA_NARRATION[state.currentZone] || pointById(state.currentZone).resumen); };
  $$('[data-see]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    markSeen(b.dataset.see);
    b.textContent = '✓ Visto';
    const row = b.closest('.er-species'); if (row) row.classList.add('seen');
    updateProgress();
  });
  $$('[data-openspecies]').forEach(el => el.onclick = () => openSpeciesSheet(el.dataset.openspecies));
}

function updateProgress(){
  const total = LA_SPECIES.length, seen = loadCol().length;
  const head = $('.progress-head span'); if (head) head.textContent = `${seen} / ${total} especies`;
  const bar = $('.progress-bar i'); if (bar) bar.style.width = (total?Math.round(seen/total*100):0) + '%';
}

/* Aliento del guía: frase motivadora (neutra) mientras se avanza.
   Rota el tono y evita repetir las frases recientes → sensación de variedad. */
const _alientoHist = [];
function alentar(){
  if (!LA_ALIENTO || !LA_ALIENTO.length) return;
  const lastTono = state.lastAlientoIdx >= 0 && LA_ALIENTO[state.lastAlientoIdx]
    ? LA_ALIENTO[state.lastAlientoIdx].tono : null;

  const all = LA_ALIENTO.map((_, idx) => idx);
  let pool = all.filter(idx => !_alientoHist.includes(idx));   // fuera las recientes
  if (!pool.length) pool = all;
  const otroTono = pool.filter(idx => LA_ALIENTO[idx].tono !== lastTono);
  if (otroTono.length) pool = otroTono;                        // preferir otro tono

  const i = pool[Math.floor(Math.random() * pool.length)];
  state.lastAlientoIdx = i;
  _alientoHist.push(i);
  if (_alientoHist.length > 8) _alientoHist.shift();           // memoria de 8 frases

  const frase = LA_ALIENTO[i].frase;
  const box = $('#alientoBox');
  if (box){
    box.textContent = '💪 ' + frase;
    box.classList.add('show');
    clearTimeout(alentar._t);
    alentar._t = setTimeout(() => box.classList.remove('show'), 6000);
  }
  TTS.speak(frase);
  state.lastAliento = Date.now();
}

/* ---- ESPECIES · Pokédex ---- */
VIEWS.especies = () => {
  const grupos = ['todos', ...new Set(LA_SPECIES.map(s => s.grupo))];
  const list = LA_SPECIES.filter(s => state.speciesFilter === 'todos' || s.grupo === state.speciesFilter);
  const total = LA_SPECIES.length, seen = loadCol().length;
  const pct = total ? Math.round(seen/total*100) : 0;
  return `
    <h2 class="section-title">📕 Pokédex de especies</h2>
    <div class="progress-card">
      <div class="progress-head"><b>Tu registro</b><span id="dexCount">${seen} / ${total} registradas</span></div>
      <div class="progress-bar"><i id="dexBar" style="width:${pct}%"></i></div>
    </div>
    <p class="muted" style="margin:2px 2px 10px">Colecciona la flora y fauna de Algarrobo. Marca <b>Lo vi</b> cuando la encuentres; las que aún no ves salen en silueta. Toca una para ver su ficha.</p>
    <div class="filter-row">
      ${grupos.map(g => `<button class="chip ${state.speciesFilter===g?'active':''}" data-filter="${esc(g)}">${g==='todos'?'Todas':esc(g)}</button>`).join('')}
    </div>
    <div class="dex-grid">
      ${list.map(s => {
        const num = String(LA_SPECIES.indexOf(s)+1).padStart(2,'0');
        const seenIt = isSeen(s.id);
        return `
        <div class="dex-card ${seenIt?'seen':'unseen'}" data-species="${s.id}">
          <span class="dex-num">#${num}</span>
          <div class="dex-img">
            <img src="${imgFor(s.id)}" alt="${esc(s.nombre)}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
            <span class="dex-emoji" style="display:none">${s.emoji}</span>
            ${seenIt?'':'<span class="dex-lock">?</span>'}
          </div>
          <div class="dex-name">${esc(s.nombre)}</div>
          <button class="dex-toggle ${seenIt?'on':''}" data-toggle="${s.id}">${seenIt?'✓ Lo vi':'○ No lo vi'}</button>
        </div>`;
      }).join('')}
    </div>
  `;
};

function updateDexCounter(){
  const total = LA_SPECIES.length, seen = loadCol().length;
  const c = $('#dexCount'); if (c) c.textContent = `${seen} / ${total} registradas`;
  const b = $('#dexBar'); if (b) b.style.width = (total?Math.round(seen/total*100):0) + '%';
}

/* ---- CUADERNO ---- */
VIEWS.cuaderno = () => {
  const logs = loadLogs();
  return `
    <h2 class="section-title">📖 Cuaderno de campo</h2>
    <div class="card">
      <form class="field-form" id="logForm">
        <div>
          <label for="fSpecies">Especie observada</label>
          <select id="fSpecies" required>
            <option value="">Selecciona…</option>
            ${LA_SPECIES.map(s => `<option value="${s.id}">${s.emoji} ${esc(s.nombre)}</option>`).join('')}
            <option value="otra">➕ Otra / no listada</option>
          </select>
        </div>
        <div>
          <label for="fPlace">Lugar</label>
          <select id="fPlace">
            <option value="">(usar mi ubicación GPS)</option>
            ${LA_POINTS.map(p => `<option value="${p.id}">${p.icono} ${esc(p.nombre)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="fNotes">Notas</label>
          <textarea id="fNotes" placeholder="¿Cuántos viste? ¿Qué estaban haciendo? ¿Clima?"></textarea>
        </div>
        <button class="btn" type="submit">＋ Guardar avistamiento</button>
      </form>
    </div>

    <h2 class="section-title">Tus registros ${logs.length?`<span class="pill st-menor">${logs.length}</span>`:''}</h2>
    <div id="logList">
      ${logs.length ? logs.map(logCardHTML).join('') :
        `<div class="empty"><span class="big">🐧</span>Aún no registras avistamientos.<br>¡Sal a explorar y anota lo que veas!</div>`}
    </div>
    ${logs.length ? `<button class="btn secondary small" id="exportLogs">⬇ Exportar mis registros</button>` : ''}
  `;
};

/* ---- TRAVESÍAS ---- */
VIEWS.travesias = () => {
  const destacada = LA_EXPERIENCES.find(e => e.destacada) || LA_EXPERIENCES[0];
  const resto = LA_EXPERIENCES.filter(e => e !== destacada);
  return `
    <div class="exp-hero">
      <span class="exp-badge">EXPERIENCIA ESTRELLA</span>
      <h2>${destacada.emoji} ${esc(destacada.nombre)}</h2>
      <p>${esc(destacada.descripcion)}</p>
    </div>
    <div class="card">
      <div class="route-meta" style="margin-bottom:10px">
        <span class="pill st-menor">⏱ ${esc(destacada.duracion)}</span>
        <span class="pill st-vulnerable">${esc(destacada.nivel)}</span>
      </div>
      <div class="includes">${destacada.incluye.map(i => `<span>✓ ${esc(i)}</span>`).join('')}</div>
      <button class="btn wa" data-book="${destacada.id}">💬 Reservar por WhatsApp</button>
    </div>

    <h2 class="section-title">Otras experiencias</h2>
    ${resto.map(e => `
      <div class="card">
        <h3>${e.emoji} ${esc(e.nombre)}</h3>
        <p class="muted" style="margin:4px 0 8px">${esc(e.descripcion)}</p>
        <div class="route-meta"><span class="pill st-menor">⏱ ${esc(e.duracion)}</span><span class="pill st-vulnerable">${esc(e.nivel)}</span></div>
        <div class="btn-row"><button class="btn wa small" data-book="${e.id}">💬 Reservar</button></div>
      </div>`).join('')}

    <div class="card" style="text-align:center">
      <b>Litoral Adventure</b>
      <p class="muted">Equipo local que vive y aprende del mar. Aventura, educación y respeto por el océano.</p>
      ${LA_CONTACT.sernatur ? `<div style="margin:10px 0"><span class="pill st-menor">✓ Registro SERNATUR vigente</span></div>` : ''}
      <div class="contact-list">
        <a href="tel:${LA_CONTACT.telefono.replace(/\s/g,'')}">📞 ${esc(LA_CONTACT.telefono)}</a>
        <a href="mailto:${LA_CONTACT.email}">✉️ ${esc(LA_CONTACT.email)}</a>
        <a href="https://www.google.com/maps?q=${encodeURIComponent(LA_CONTACT.direccion)}" target="_blank" rel="noopener">📍 ${esc(LA_CONTACT.direccion)}</a>
      </div>
      <div class="socials">
        <a href="${LA_CONTACT.instagram}" target="_blank" rel="noopener">Instagram</a>
        <a href="${LA_CONTACT.tiktok}" target="_blank" rel="noopener">TikTok</a>
        <a href="${LA_CONTACT.web}" target="_blank" rel="noopener">Sitio web</a>
      </div>
    </div>
  `;
};

/* ============================================================================
   AFTER: listeners que dependen del DOM ya inyectado
   ============================================================================ */
const AFTER = {};

AFTER.inicio = () => {
  $$('.quick').forEach(b => b.onclick = () => go(b.dataset.goto));
};

AFTER.mapa = () => {
  $$('.map-point').forEach(g => g.onclick = () => openPointSheet(g.dataset.point));
  $$('[data-route]').forEach(c => c.onclick = () => openRouteSheet(c.dataset.route));
  const sg = $('#startGuided'); if (sg) sg.onclick = () => go('enruta');
  requestGeo();               // activa GPS y pinta el "tú estás aquí"
};

AFTER.enruta = () => {
  wireZonePanel();
  const seg = $('#modeSeg');
  if (seg) seg.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b){ state.mode = b.dataset.mode; go('enruta'); } });
  const vt = $('#voiceToggle');
  if (vt) vt.onclick = () => { TTS.on = !TTS.on; if (!TTS.on) TTS.stop(); go('enruta'); };
  const sim = $('#simZone');
  if (sim) sim.onchange = () => { if (sim.value) enterZone(sim.value, true); };
  const ta = $('#testAliento');
  if (ta) ta.onclick = () => alentar();
  requestGeo();
};

AFTER.especies = () => {
  $$('.chip').forEach(c => c.onclick = () => { state.speciesFilter = c.dataset.filter; go('especies'); });
  $$('.dex-card').forEach(card => card.onclick = () => openSpeciesSheet(card.dataset.species));
  $$('[data-toggle]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const on = toggleSeen(b.dataset.toggle);
    const card = b.closest('.dex-card');
    card.classList.toggle('seen', on);
    card.classList.toggle('unseen', !on);
    b.classList.toggle('on', on);
    b.textContent = on ? '✓ Lo vi' : '○ No lo vi';
    const imgWrap = card.querySelector('.dex-img');
    const lock = imgWrap.querySelector('.dex-lock');
    if (on && lock) lock.remove();
    else if (!on && !lock){ const l = document.createElement('span'); l.className = 'dex-lock'; l.textContent = '?'; imgWrap.appendChild(l); }
    updateDexCounter();
  });
};

AFTER.cuaderno = () => {
  const form = $('#logForm');
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const sp = $('#fSpecies').value;
    if (!sp){ return; }
    const placeId = $('#fPlace').value;
    const species = LA_SPECIES.find(s => s.id === sp);
    const log = {
      id: Date.now(),
      speciesId: sp,
      speciesName: sp === 'otra' ? 'Especie no listada' : (species ? species.nombre : sp),
      emoji: sp === 'otra' ? '❓' : (species ? species.emoji : '🔎'),
      place: placeId ? pointById(placeId).nombre : (state.pos ? `GPS ${state.pos.lat.toFixed(4)}, ${state.pos.lng.toFixed(4)}` : 'Sin ubicación'),
      notes: $('#fNotes').value.trim(),
      ts: new Date().toISOString()
    };
    const logs = loadLogs(); logs.unshift(log); saveLogs(logs);
    go('cuaderno');
  };
  const exp = $('#exportLogs');
  if (exp) exp.onclick = exportLogs;
};

AFTER.travesias = () => {
  $$('[data-book]').forEach(b => b.onclick = () => bookWhatsApp(b.dataset.book));
};

/* ============================================================================
   MAPA SVG (esquemático, funciona 100% offline)
   ============================================================================ */
function mapSVG(){
  // posiciones esquemáticas en el lienzo (no proyección real; la distancia
  // real se calcula por GPS con haversine sobre lat/lng verdaderas)
  const P = {
    'mirador-canelo':  {x:200, y:90},
    'isla-pinguinos':  {x:120, y:60},
    'punta-penablanca':{x:150, y:210},
    'quebrada-rosas':  {x:250, y:230},
    'humedal-tunquen': {x:110, y:320}
  };
  const routePath = r => r.puntos.map(id => P[id]).filter(Boolean);
  const routes = LA_ROUTES.map(r => {
    const pts = routePath(r);
    if (pts.length < 2) return '';
    const d = pts.map((p,i) => (i?'L':'M')+p.x+' '+p.y).join(' ');
    return `<path d="${d}" fill="none" stroke="${r.color}" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round" opacity=".9"/>`;
  }).join('');
  const points = LA_POINTS.map(p => {
    const c = P[p.id]; if (!c) return '';
    const col = p.proteccion==='exclusion' ? 'var(--la-danger)'
              : p.proteccion==='estricta'  ? '#b5651d'
              : p.proteccion==='observacion' ? 'var(--la-teal)' : 'var(--la-green)';
    return `<g class="map-point" data-point="${p.id}" transform="translate(${c.x},${c.y})">
      <circle class="hit" r="22"/>
      <circle r="9" fill="${col}" stroke="#fff" stroke-width="2.5"/>
      <text x="0" y="4" font-size="10" text-anchor="middle">${p.icono}</text>
      <text x="0" y="26" font-size="9" text-anchor="middle" fill="var(--la-ink)" font-weight="600">${esc(p.nombre.split('(')[0].trim().slice(0,16))}</text>
    </g>`;
  }).join('');

  return `<svg class="map-svg" viewBox="0 0 340 380" xmlns="http://www.w3.org/2000/svg">
    <!-- océano / costa esquemática -->
    <path d="M0 0 H340 V150 Q250 170 230 250 Q215 320 180 380 H0 Z" fill="#eef7d9" opacity=".85"/>
    <path d="M0 0 H340 V150 Q250 170 230 250 Q215 320 180 380 H0 Z" fill="none" stroke="#bcd18a" stroke-width="2"/>
    <text x="300" y="360" font-size="11" fill="#4a7ea8" text-anchor="end" opacity=".7">Océano Pacífico</text>
    <text x="30" y="30" font-size="11" fill="#7a8c46" opacity=".7">Algarrobo</text>
    ${routes}
    ${points}
    <g id="userDot" style="display:none">
      <circle r="18" fill="var(--la-deep)" opacity=".18"><animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite"/></circle>
      <circle r="6" fill="var(--la-deep)" stroke="#fff" stroke-width="2"/>
    </g>
  </svg>`;
}

/* ============================================================================
   GEOLOCALIZACIÓN + GEOCERCAS
   ============================================================================ */
let geoWatch = null;
function requestGeo(){
  const txt = $('#gpsText');
  if (!('geolocation' in navigator)){ if(txt) txt.textContent = 'GPS no disponible'; return; }
  if (geoWatch !== null) return;              // ya está observando
  geoWatch = navigator.geolocation.watchPosition(onGeo, onGeoErr, {
    enableHighAccuracy:true, maximumAge:5000, timeout:15000
  });
}
function onGeo(p){
  state.pos = { lat:p.coords.latitude, lng:p.coords.longitude };
  const txt = $('#gpsText');
  // punto más cercano
  let nearest = null, nd = Infinity;
  LA_POINTS.forEach(pt => {
    const d = haversine(state.pos.lat, state.pos.lng, pt.lat, pt.lng);
    if (d < nd){ nd = d; nearest = pt; }
    // geocerca
    if (d <= pt.geofence && !state.alertedNow.has(pt.id)){
      state.alertedNow.add(pt.id); fireGeoAlert(pt);
    }
    if (d > pt.geofence * 1.6) state.alertedNow.delete(pt.id);  // re-armar al alejarse
  });
  if (txt && nearest) txt.innerHTML = `a <b>${fmtDist(nd)}</b> de ${esc(nearest.nombre.split('(')[0].trim())}`;
  positionUserDot(nearest, nd);

  // lector de posición del modo En Ruta
  const erGps = $('#erGps');
  if (erGps && nearest) erGps.innerHTML = `a <b>${fmtDist(nd)}</b> de ${esc(nearest.nombre.split('(')[0].trim())}`;

  // guía virtual: narrar automáticamente al entrar a una zona (radio según modo)
  if (state.view === 'enruta' && nearest && nd <= modeRadius(nearest) && nearest.id !== state.currentZone){
    enterZone(nearest.id, true);
  }

  // aliento mientras se avanza: acumula distancia recorrida entre lecturas GPS
  if (state.lastPos){
    const step = haversine(state.lastPos.lat, state.lastPos.lng, state.pos.lat, state.pos.lng);
    if (step > 3 && step < 500) state.distAccum += step;   // filtra ruido/saltos de GPS
  }
  state.lastPos = { lat: state.pos.lat, lng: state.pos.lng };

  const fueraDeZona = !nearest || nd > modeRadius(nearest);
  if (state.view === 'enruta' && fueraDeZona && state.distAccum >= 250 && (Date.now() - state.lastAliento) > 45000){
    state.distAccum = 0;
    alentar();
  }
}
function onGeoErr(){
  const txt = $('#gpsText');
  if (txt) txt.textContent = 'Activa el GPS para ver tu posición';
}
function positionUserDot(nearest, nd){
  // aproxima la posición del usuario en el mapa esquemático cerca del punto más cercano
  const dot = $('#userDot'); if (!dot || !nearest) return;
  const P = {'mirador-canelo':[200,90],'isla-pinguinos':[120,60],'punta-penablanca':[150,210],'quebrada-rosas':[250,230],'humedal-tunquen':[110,320]};
  const base = P[nearest.id]; if(!base) return;
  const off = Math.min(nd/40, 28);
  dot.setAttribute('transform', `translate(${base[0]+off*0.4},${base[1]+off*0.6})`);
  dot.style.display = 'block';
}

function fireGeoAlert(pt){
  const el = $('#geoAlert'), meta = protLabel[pt.proteccion] || {};
  $('#geoAlertIcon').textContent = pt.proteccion==='exclusion' ? '🚫' : pt.proteccion==='estricta' ? '🌱' : '📍';
  $('#geoAlertTitle').textContent = `${meta.t || 'Zona'}: ${pt.nombre.split('(')[0].trim()}`;
  $('#geoAlertMsg').textContent = meta.txt || pt.resumen;
  el.className = 'geo-alert ' + (meta.c || '');
  el.hidden = false;
  if (navigator.vibrate) navigator.vibrate([80,40,80]);
  clearTimeout(fireGeoAlert._t);
  fireGeoAlert._t = setTimeout(() => { el.hidden = true; }, 9000);
}
$('#geoAlertClose').onclick = () => { $('#geoAlert').hidden = true; };

/* ============================================================================
   SHEETS (detalle emergente)
   ============================================================================ */
function openSheet(html){
  closeSheet();
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop'; bd.id = 'sheetBackdrop';
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  bd.addEventListener('click', e => { if (e.target === bd) closeSheet(); });
  document.body.appendChild(bd);
  return bd;
}
function closeSheet(){ const b = $('#sheetBackdrop'); if (b) b.remove(); }

function openSpeciesSheet(id){
  const s = LA_SPECIES.find(x => x.id === id); if (!s) return;
  const lugares = s.donde.map(pid => pointById(pid)).filter(Boolean).map(p => `${p.icono} ${esc(p.nombre.split('(')[0].trim())}`).join(', ');
  const num = String(LA_SPECIES.indexOf(s)+1).padStart(2,'0');
  const cred = imgCredit(s.id);
  const seenIt = isSeen(s.id);
  openSheet(`
    <div class="sheet-hero ${seenIt?'':'locked'}">
      <img src="${imgFor(s.id)}" alt="${esc(s.nombre)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <span class="sheet-hero__emoji" style="display:none">${s.emoji}</span>
      <span class="dex-num">#${num}</span>
    </div>
    <h2>${esc(s.nombre)}</h2>
    <i style="color:var(--la-ink-2)">${esc(s.cientifico)}</i>
    <div style="margin:8px 0"><span class="pill ${estadoClass(s.estado)}">${esc(s.estado)}</span> <span class="pill st-menor">${esc(s.grupo)}</span></div>

    <button class="btn ${seenIt?'':'secondary'}" id="sheetSeen">${seenIt?'✓ Lo vi — quitar':'👁 Marcar “Lo vi”'}</button>

    <div class="detail-block"><h4>Ficha</h4><p class="muted">${esc(s.ficha)}</p></div>
    ${s.sonido?`<div class="detail-block"><h4>🔊 Sonido</h4><p class="muted">${esc(s.sonido)}</p></div>`:''}
    <div class="detail-block"><h4>📅 Mejor época</h4><p class="muted">${esc(s.mejor_epoca)}</p></div>
    <div class="detail-block"><h4>📍 Dónde verla</h4><p class="muted">${lugares}</p></div>
    ${cred?`<p class="img-credit">📷 ${esc(cred.credit)}${cred.license?' · '+esc(cred.license):''} · <a href="${cred.source}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`:''}
    <div class="btn-row"><button class="btn secondary" id="sheetLog">📖 Anotar avistamiento</button><button class="btn secondary" onclick="closeSheet()">Cerrar</button></div>
  `);
  const sb = $('#sheetSeen');
  if (sb) sb.onclick = () => {
    const on = toggleSeen(s.id);
    sb.textContent = on ? '✓ Lo vi — quitar' : '👁 Marcar “Lo vi”';
    sb.classList.toggle('secondary', !on);
    $('.sheet-hero')?.classList.toggle('locked', !on);
    syncDexCard(s.id);
  };
  const b = $('#sheetLog'); if (b) b.onclick = () => { closeSheet(); go('cuaderno'); setTimeout(()=>{ const sel=$('#fSpecies'); if(sel){sel.value=s.id;} },60); };
}

/* refleja el estado ver/no-ver en la tarjeta de la Pokédex (si está en pantalla) */
function syncDexCard(id){
  const card = document.querySelector(`.dex-card[data-species="${id}"]`);
  if (!card) return;
  const on = isSeen(id);
  card.classList.toggle('seen', on); card.classList.toggle('unseen', !on);
  const btn = card.querySelector('[data-toggle]');
  if (btn){ btn.classList.toggle('on', on); btn.textContent = on ? '✓ Lo vi' : '○ No lo vi'; }
  const imgWrap = card.querySelector('.dex-img'); const lock = imgWrap.querySelector('.dex-lock');
  if (on && lock) lock.remove();
  else if (!on && !lock){ const l = document.createElement('span'); l.className = 'dex-lock'; l.textContent = '?'; imgWrap.appendChild(l); }
  updateDexCounter();
}

function openPointSheet(id){
  const p = pointById(id); if (!p) return;
  const meta = protLabel[p.proteccion] || {};
  const species = LA_SPECIES.filter(s => s.donde.includes(id));
  openSheet(`
    <h2>${p.icono} ${esc(p.nombre)}</h2>
    <div style="margin:8px 0"><span class="pill ${p.proteccion==='exclusion'?'st-peligro':'st-vulnerable'}">${esc(meta.t||p.tipo)}</span></div>
    <p class="muted">${esc(p.resumen)}</p>
    <div class="kv"><b>Coordenadas</b><span>${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span></div>
    <div class="kv"><b>Tipo</b><span>${esc(p.tipo)}</span></div>
    ${species.length?`<div class="detail-block"><h4>Especies aquí</h4><p class="muted">${species.map(s=>`${s.emoji} ${esc(s.nombre)}`).join(' · ')}</p></div>`:''}
    <div class="btn-row">
      <a class="btn" href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener">🗺 Abrir en mapas</a>
      <button class="btn secondary" onclick="closeSheet()">Cerrar</button>
    </div>
  `);
}

function openRouteSheet(id){
  const r = LA_ROUTES.find(x => x.id === id); if (!r) return;
  const pts = r.puntos.map(pid => pointById(pid)).filter(Boolean);
  openSheet(`
    <h2>${esc(r.nombre)}</h2>
    <div class="route-meta" style="margin:8px 0">
      <span class="pill st-menor">${r.distancia_km} km</span>
      <span class="pill st-menor">⏱ ${esc(r.duracion)}</span>
      <span class="pill st-vulnerable">${esc(r.dificultad)}</span>
    </div>
    <div class="detail-block"><h4>Puntos de interés</h4><p class="muted">${esc(r.interes)}</p></div>
    <div class="detail-block"><h4>Recorrido</h4>${pts.map(p=>`<p class="muted">${p.icono} ${esc(p.nombre.split('(')[0].trim())}</p>`).join('')}</div>
    <div class="btn-row"><button class="btn secondary" onclick="closeSheet()">Cerrar</button></div>
  `);
}

/* ============================================================================
   CUADERNO (localStorage)
   ============================================================================ */
const LS_KEY = 'la_field_logs_v1';
function loadLogs(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function saveLogs(l){ localStorage.setItem(LS_KEY, JSON.stringify(l)); }
function logCardHTML(l){
  const d = new Date(l.ts);
  const fecha = d.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}) + ' · ' + d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  return `<div class="card log-item">
    <div class="le">${l.emoji}</div>
    <div style="flex:1">
      <h3 style="font-size:15px">${esc(l.speciesName)}</h3>
      <small>📍 ${esc(l.place)} · ${fecha}</small>
      ${l.notes?`<p class="muted" style="margin-top:4px">${esc(l.notes)}</p>`:''}
    </div>
    <button class="btn secondary small" onclick="delLog(${l.id})" aria-label="Eliminar">🗑</button>
  </div>`;
}
function delLog(id){ saveLogs(loadLogs().filter(l => l.id !== id)); go('cuaderno'); }
function exportLogs(){
  const logs = loadLogs();
  const blob = new Blob([JSON.stringify(logs,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'litoral-adventure-cuaderno.json';
  a.click(); URL.revokeObjectURL(a.href);
}

/* ============================================================================
   MAREAS
   ============================================================================ */
function tideStripHTML(){
  return `<div class="tide-strip">${LA_TIDES_DEMO.map(t => `
    <div class="tide ${t.tipo}">
      <div class="t">${t.hora}</div>
      <div class="a">${t.altura}</div>
      <span class="lbl">${t.tipo==='baja'?'▼ Baja':'▲ Alta'}</span>
    </div>`).join('')}</div>`;
}

/* ============================================================================
   RESERVA POR WHATSAPP
   ============================================================================ */
function bookWhatsApp(expId){
  const e = LA_EXPERIENCES.find(x => x.id === expId);
  const msg = encodeURIComponent(
    `¡Hola Litoral Adventure! 🌊 Quiero reservar: ${e ? e.nombre : 'una experiencia'}.\n`+
    `¿Qué fechas y horarios tienen disponibles?`
  );
  window.open(`https://wa.me/${LA_CONTACT.whatsapp}?text=${msg}`, '_blank');
}

/* ============================================================================
   ESTADO DE RED
   ============================================================================ */
function updateNet(){
  const el = $('#netStatus'), lbl = $('#netLabel');
  const on = navigator.onLine;
  el.classList.toggle('online', on);
  lbl.textContent = on ? 'online' : 'offline';
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

/* ============================================================================
   BOOT
   ============================================================================ */
updateNet();
go('inicio');

/* Service worker (offline) — falla en silencio en file:// */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* expone helpers usados en onclick inline */
window.closeSheet = closeSheet;
window.delLog = delLog;
