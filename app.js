/* ============================================================================
   LITORAL ADVENTURE · Lógica de la app (offline-first, sin dependencias)
   ============================================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pointById = id => LA_POINTS.find(p => p.id === id);

/* posiciones esquemáticas de cada punto en el lienzo del mapa (compartidas) */
const MAP_XY = {
  'mirador-canelo':  { x: 200, y: 90 },
  'isla-pinguinos':  { x: 120, y: 60 },
  'punta-penablanca':{ x: 150, y: 210 },
  'quebrada-rosas':  { x: 250, y: 230 },
  'humedal-tunquen': { x: 110, y: 320 }
};

/* ---------- Utilidades ---------- */
function haversine(a, b, c, d){                 // metros entre (a,b) y (c,d)
  const R = 6371000, r = Math.PI/180;
  const dLat = (c-a)*r, dLng = (d-b)*r;
  const s = Math.sin(dLat/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function fmtDist(m){ return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km'; }
function esc(t=''){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const estadoClass = e => /peligro/i.test(e) ? 'st-peligro' : /(vulnerable|casi amenaz)/i.test(e) ? 'st-vulnerable' : 'st-menor';
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
  lastAlientoIdx: -1,      // para no repetir frase seguida
  recorridoActivo: false   // ¿ya pasó la charla del guía y empezó el recorrido?
};

/* ¿ya vio el tutorial completo alguna vez? */
const ONB_KEY = 'la_onboarded_v1';
const yaOnboarded = () => localStorage.getItem(ONB_KEY) === '1';
const marcarOnboarded = () => localStorage.setItem(ONB_KEY, '1');

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

/* ---------- Zonas visitadas ---------- */
const ZON_KEY = 'la_zonas_v1';
function loadZonas(){ try { return JSON.parse(localStorage.getItem(ZON_KEY)) || []; } catch { return []; } }
function addZona(id){ const z = loadZonas(); if (!z.includes(id)){ z.push(id); localStorage.setItem(ZON_KEY, JSON.stringify(z)); } }

/* ---------- Quiz ---------- */
const QUIZ_KEY = 'la_quiz_v1';
function loadQuiz(){ try { return JSON.parse(localStorage.getItem(QUIZ_KEY)) || {}; } catch { return {}; } }
function setQuiz(id, idx, correct){ const q = loadQuiz(); q[id] = { idx, correct }; localStorage.setItem(QUIZ_KEY, JSON.stringify(q)); }

/* ---------- Logros / insignias ---------- */
const LOG_KEY = 'la_logros_v1';
const LOGRO_CHECK = {
  'comprometido':        () => yaOnboarded(),
  'primer-avistamiento': () => loadCol().length >= 1,
  'observador':          () => loadCol().length >= 5,
  'as-aves':             () => LA_SPECIES.filter(s => /Aves/.test(s.grupo)).every(s => isSeen(s.id)),
  'jardin-nativo':       () => LA_SPECIES.filter(s => s.reino === 'flora').every(s => isSeen(s.id)),
  'explorador':          () => loadZonas().length >= LA_POINTS.length,
  'sabio':               () => { const q = loadQuiz(); return Object.keys(LA_QUIZ).every(z => q[z] && q[z].correct); },
  'naturalista':         () => loadCol().length >= LA_SPECIES.length
};
const earnedLogros = () => (window.LA_LOGROS || []).filter(l => LOGRO_CHECK[l.id] && LOGRO_CHECK[l.id]()).map(l => l.id);
function celebrarLogros(){
  const ahora = earnedLogros();
  let prev; try { prev = JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { prev = []; }
  const nuevos = ahora.filter(id => !prev.includes(id));
  localStorage.setItem(LOG_KEY, JSON.stringify(ahora));
  nuevos.forEach((id, i) => {
    const l = LA_LOGROS.find(x => x.id === id);
    if (l) setTimeout(() => celebrate(l.titulo, l.icono, '🏅 ¡Logro desbloqueado!'), 500 + i * 1700);
  });
  return nuevos;
}

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

  <h2 class="section-title">🏅 Tus logros <span class="pill st-menor" style="font-weight:600">${earnedLogros().length}/${LA_LOGROS.length}</span></h2>
  <div class="badge-grid">
    ${LA_LOGROS.map(l => { const on = earnedLogros().includes(l.id); return `<div class="badge ${on?'on':'off'}"><span class="badge-ic">${on?l.icono:'🔒'}</span><b>${esc(l.titulo)}</b><small>${esc(l.desc)}</small></div>`; }).join('')}
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
  if (!state.recorridoActivo) return enrutaIntroHTML();
  const total = LA_SPECIES.length, seen = loadCol().length;
  const pct = total ? Math.round(seen/total*100) : 0;
  return `
    <h2 class="section-title">🎧 Recorrido en marcha</h2>
    <p class="muted" style="margin-bottom:12px">Camina o pedalea: el mapa detecta tu zona y tu guía te cuenta qué hay. 🌿 Con respeto y cuidado.</p>

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

/* mini-mapa que se dispara al entrar a una zona: resalta el punto actual */
function zoneMapSVG(zoneId){
  const coast = `<path d="M0 0 H340 V150 Q250 170 230 250 Q215 320 180 380 H0 Z" fill="#eef7d9" opacity=".85"/>`
    + `<path d="M0 0 H340 V150 Q250 170 230 250 Q215 320 180 380 H0 Z" fill="none" stroke="#bcd18a" stroke-width="2"/>`;
  const pts = LA_POINTS.map(p => {
    const c = MAP_XY[p.id]; if (!c) return '';
    if (p.id === zoneId){
      return `<g transform="translate(${c.x},${c.y})">
        <circle r="26" fill="var(--la-teal)" opacity=".18"><animate attributeName="r" values="16;30;16" dur="2s" repeatCount="indefinite"/></circle>
        <circle r="12" fill="var(--la-deep)" stroke="#fff" stroke-width="3"/>
        <text x="0" y="4" font-size="12" text-anchor="middle">${p.icono}</text>
        <text x="0" y="32" font-size="11" text-anchor="middle" fill="var(--la-ink)" font-weight="700">Estás aquí</text>
      </g>`;
    }
    return `<g transform="translate(${c.x},${c.y})" opacity=".35"><circle r="6" fill="#8aa0a6" stroke="#fff" stroke-width="1.5"/></g>`;
  }).join('');
  return `<svg class="map-svg" viewBox="0 0 340 380" xmlns="http://www.w3.org/2000/svg">${coast}`
    + `<text x="300" y="360" font-size="11" fill="#4a7ea8" text-anchor="end" opacity=".6">Océano Pacífico</text>${pts}</svg>`;
}

function zonePanelHTML(id){
  const p = pointById(id); if (!p) return zoneIdleHTML();
  const narr = LA_NARRATION[id] || p.resumen;
  const ind = (window.LA_INDICACION || {})[id];
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
      <div class="zone-map">${zoneMapSVG(id)}</div>
      <p class="narration">${esc(narr)}</p>
      <button class="btn secondary small" id="replayNarr">🔊 Repetir narración</button>
      ${ind ? `<div class="zone-ind">
        <div class="ind-row"><span>🔭</span><p>${esc(ind.observa)}</p></div>
        <div class="ind-row"><span>🧭</span><p>${esc(ind.rumbo)}</p></div>
        <div class="ind-row care"><span>💚</span><p><b>Cuida:</b> ${esc(ind.cuidado)}</p></div>
      </div>` : ''}
      ${fauna.length?`<h4 class="er-group">🐾 Fauna aquí</h4>${fauna.map(cardHTML).join('')}`:''}
      ${flora.length?`<h4 class="er-group">🌿 Flora aquí</h4>${flora.map(cardHTML).join('')}`:''}
      ${quizHTML(id)}
    </div>`;
}

/* Mini-quiz educativo por zona */
function quizHTML(id){
  const q = (window.LA_QUIZ || {})[id]; if (!q) return '';
  const ans = loadQuiz()[id];
  return `<div class="quiz" data-quiz="${id}">
    <h4 class="er-group">🧠 Pon a prueba lo aprendido</h4>
    <p class="quiz-q">${esc(q.pregunta)}</p>
    <div class="quiz-opts">
      ${q.opciones.map((o, idx) => {
        let cls = ''; if (ans){ if (idx === q.correcta) cls = 'ok'; else if (ans.idx === idx) cls = 'no'; }
        return `<button class="quiz-opt ${cls}" data-opt="${idx}"${ans?' disabled':''}>${esc(o)}</button>`;
      }).join('')}
    </div>
    <div class="quiz-fb"${ans?'':' hidden'}>${ans?`<b>${ans.correct?'✅ ¡Correcto!':'💡 ¡Casi!'}</b> ${esc(q.explicacion)}`:''}</div>
  </div>`;
}
function wireQuiz(root){
  (root || document).querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
    const quizEl = b.closest('.quiz'); const id = quizEl.dataset.quiz; const q = LA_QUIZ[id];
    const idx = +b.dataset.opt, correct = idx === q.correcta;
    setQuiz(id, idx, correct);
    quizEl.outerHTML = quizHTML(id);
    wireQuiz(document);
    if (correct && navigator.vibrate) navigator.vibrate(30);
    celebrarLogros();
  });
}

function enterZone(id, narrate){
  if (!pointById(id)) return;
  addZona(id);
  state.currentZone = id;
  const panel = $('#zonePanel');
  if (panel){ panel.innerHTML = zonePanelHTML(id); wireZonePanel(); }
  if (narrate) TTS.speak(LA_NARRATION[id] || pointById(id).resumen);
  if (navigator.vibrate) navigator.vibrate(60);
  celebrarLogros();
}

function wireZonePanel(){
  const rp = $('#replayNarr');
  if (rp) rp.onclick = () => { if (state.currentZone) TTS.speak(LA_NARRATION[state.currentZone] || pointById(state.currentZone).resumen); };
  $$('[data-see]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = b.dataset.see, was = isSeen(id);
    markSeen(id);
    b.textContent = '✓ Visto';
    const row = b.closest('.er-species'); if (row) row.classList.add('seen');
    updateProgress();
    if (!was){ const s = LA_SPECIES.find(x => x.id === id); celebrate(s ? s.nombre : '', s ? s.emoji : ''); }
    celebrarLogros();
  });
  $$('[data-openspecies]').forEach(el => el.onclick = () => openSpeciesSheet(el.dataset.openspecies));
  wireQuiz(document);
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

/* ===== Charla del guía (onboarding + tutorial) ===== */
function codigoListHTML(){
  return `<ul class="codigo-list">${LA_CODIGO.map(c =>
    `<li><span class="ci">${c.icono}</span><div><b>${esc(c.titulo)}</b><p>${esc(c.texto)}</p></div></li>`
  ).join('')}</ul>`;
}
function modeChooserHTML(){
  return `<div class="seg onboard-seg">
      <button data-mode="pie"  class="${state.mode==='pie'?'on':''}">🚶 A pie</button>
      <button data-mode="bici" class="${state.mode==='bici'?'on':''}">🚴 En bici</button>
    </div>
    <p class="muted" style="margin-top:10px">Puedes cambiarlo cuando quieras durante el recorrido.</p>`;
}
function enrutaIntroHTML(){
  return `
    <div class="er-intro">
      <div class="er-intro__hero">
        <span class="er-intro__emoji">🎧</span>
        <h2>Recorrido guiado</h2>
        <p>Tu guía te acompaña por voz: te cuenta la flora y fauna de cada zona, te da indicaciones y te anima mientras avanzas.</p>
      </div>
      <div class="card er-intro__pact">
        <b>🌿 Antes de partir</b>
        <p class="muted">Recibirás una breve charla del guía y el Código del Explorador, para recorrer cuidando y respetando este lugar.</p>
      </div>
      <button class="btn" id="comenzarRecorrido">▶ Comenzar recorrido guiado</button>
      <button class="btn secondary" id="verCodigo" style="margin-top:10px">🌿 Ver el Código del Explorador</button>
    </div>`;
}
function openCodigoSheet(){
  openSheet(`<h2>🌿 Código del Explorador</h2>
    <p class="muted">Cuidar y respetar también es parte de la aventura.</p>
    ${codigoListHTML()}
    <div class="btn-row"><button class="btn" onclick="closeSheet()">¡Entendido!</button></div>`);
}
function buildPasos(full){
  const pasos = [
    { ic:'👋', t:'¡Bienvenida a bordo!',
      voz:'¡Hola! Soy tu guía en Litoral Adventure. Antes de partir, conversemos un momento.',
      html:`<p class="muted">Vas a recorrer un lugar único de la costa de Algarrobo. Yo te acompaño en cada paso para que lo vivas y lo cuides.</p>` },
    { ic:'🌿', t:'Código del Explorador',
      voz:'Recuerda lo más importante: observamos sin intervenir, con respeto y cuidado por cada ser vivo.',
      html: codigoListHTML() }
  ];
  if (full){
    pasos.push({ ic:'🗺️', t:'Cómo funciona el recorrido',
      voz:'A medida que avances, el mapa detectará tu zona y te contaré qué hay a tu alrededor.',
      html:`<ul class="tut">
        <li><span>📍</span> Al entrar a una zona, el <b>mapa se activa</b> y te doy indicaciones.</li>
        <li><span>🔊</span> Escucharás la <b>narración por voz</b> de la flora y fauna del lugar.</li>
        <li><span>💪</span> Te <b>animaré</b> mientras avanzas.</li>
      </ul>` });
    pasos.push({ ic:'📕', t:'Arma tu Pokédex',
      voz:'Cuando descubras una especie, márcala como “Lo vi” para coleccionarla en tu Pokédex.',
      html:`<ul class="tut">
        <li><span>👁</span> Toca <b>“¡Lo vi!”</b> cuando avistes una especie.</li>
        <li><span>🖼️</span> Se revela su <b>foto real</b> y sube tu colección.</li>
        <li><span>📖</span> También puedes anotarla en tu <b>Cuaderno de campo</b>.</li>
      </ul>` });
  }
  pasos.push({ ic:'🚶🚴', t:'¿Cómo te mueves hoy?',
    voz:'¿Vas a pie o en bicicleta?',
    html: modeChooserHTML() });
  pasos.push({ ic:'🤝', t:'Tu compromiso', final:true,
    voz:'¿Te comprometes a cuidar y respetar este lugar mientras lo recorres?',
    html:`<p>Me comprometo a <b>observar sin intervenir</b>, seguir las indicaciones y <b>dejar todo como lo encontré</b>. 🌊</p>` });
  return pasos;
}
function startRecorrido(){
  const pasos = buildPasos(!yaOnboarded());
  let i = 0;
  const ov = document.createElement('div');
  ov.className = 'onboard'; ov.id = 'onboard';
  document.body.appendChild(ov);

  function finish(){
    TTS.stop();
    marcarOnboarded();
    state.recorridoActivo = true;
    ov.remove();
    go('enruta');
    requestGeo();
    celebrarLogros();
    setTimeout(() => { if (TTS.on) TTS.speak('¡Listo! Empecemos con calma. Disfruta y cuida cada rincón.'); }, 350);
  }
  function render(){
    const p = pasos[i];
    ov.innerHTML = `
      <div class="onboard__card">
        <div class="onboard__top">
          <span class="onboard__ic">${p.ic}</span>
          <button class="onboard__skip" id="obSkip">Saltar</button>
        </div>
        <h2>${esc(p.t)}</h2>
        <div class="onboard__body">${p.html}</div>
        <div class="onboard__dots">${pasos.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
        <div class="onboard__nav">
          ${i>0?`<button class="btn secondary" id="obPrev">Atrás</button>`:''}
          <button class="btn" id="obNext">${p.final?'🤝 Me comprometo · Comenzar':'Siguiente'}</button>
        </div>
      </div>`;
    if (p.voz) TTS.speak(p.voz);
    ov.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      state.mode = b.dataset.mode;
      ov.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#obSkip', ov).onclick = finish;
    const prev = $('#obPrev', ov); if (prev) prev.onclick = () => { i--; render(); };
    $('#obNext', ov).onclick = () => { if (i < pasos.length-1){ i++; render(); } else finish(); };
  }
  render();
}

/* Celebración: especie nueva o logro desbloqueado */
function celebrate(nombre, emoji, titulo){
  const t = document.createElement('div');
  t.className = 'celebrate';
  t.innerHTML = `<div class="celebrate__card"><span class="celebrate__emoji">${emoji||'🎉'}</span><b>${esc(titulo||'¡Nueva especie!')}</b><p>${esc(nombre)}</p></div>`;
  document.body.appendChild(t);
  if (navigator.vibrate) navigator.vibrate([40,30,60]);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2200);
}

AFTER.enruta = () => {
  if (!state.recorridoActivo){
    const cr = $('#comenzarRecorrido'); if (cr) cr.onclick = () => startRecorrido();
    const vc = $('#verCodigo'); if (vc) vc.onclick = () => openCodigoSheet();
    return;
  }
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
    if (on){ const s = LA_SPECIES.find(x => x.id === b.dataset.toggle); celebrate(s ? s.nombre : '', s ? s.emoji : ''); }
    celebrarLogros();
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
  const P = MAP_XY;
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
  const base = MAP_XY[nearest.id]; if(!base) return;
  const off = Math.min(nd/40, 28);
  dot.setAttribute('transform', `translate(${base.x+off*0.4},${base.y+off*0.6})`);
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
  const d = (window.LA_DATOS || {})[s.id];
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

    ${d && d.datos ? `<div class="datos-grid">${d.datos.map(([ic,lab,val]) =>
      `<div class="dato"><span class="dato-ic">${ic}</span><div><small>${esc(lab)}</small><b>${esc(val)}</b></div></div>`).join('')}</div>` : ''}

    <div class="detail-block"><h4>Ficha</h4><p class="muted">${esc(s.ficha)}</p></div>
    ${d && d.curiosidad ? `<div class="sabias"><span class="sabias-ic">💡</span><div><b>¿Sabías que…?</b><p>${esc(d.curiosidad)}</p></div></div>` : ''}
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
    if (on) celebrate(s.nombre, s.emoji);
    celebrarLogros();
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
