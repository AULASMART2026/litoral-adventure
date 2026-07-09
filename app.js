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
  recorridoActivo: false,  // ¿ya pasó la charla del guía y empezó el recorrido?
  pendingFoto: null,       // foto (dataURL) pendiente de guardar en el cuaderno
  lang: (localStorage.getItem('la_lang') || 'es')  // idioma: 'es' | 'en'
};

/* Redimensiona y comprime una foto a JPEG pequeño (para caber en localStorage) */
function resizePhoto(file, maxDim, cb){
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(c.toDataURL('image/jpeg', 0.6)); } catch { cb(null); }
    };
    img.onerror = () => cb(null);
    img.src = e.target.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

/* ¿ya vio el tutorial completo alguna vez? */
const ONB_KEY = 'la_onboarded_v1';
const yaOnboarded = () => localStorage.getItem(ONB_KEY) === '1';
const marcarOnboarded = () => localStorage.setItem(ONB_KEY, '1');

/* ---------- Guía por voz (text-to-speech, gratis y offline) ---------------- */
const TTS = {
  on: true,
  voice: null,
  supported: ('speechSynthesis' in window),
  pickForLang(){
    if (!TTS.supported) return;
    const vs = speechSynthesis.getVoices();
    if (state.lang === 'en'){
      TTS.voice = vs.find(v => /en[-_](US|GB|AU)/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    } else {
      TTS.voice = vs.find(v => /es[-_]CL/i.test(v.lang))
               || vs.find(v => /es[-_](419|MX|US|AR|PE)/i.test(v.lang))
               || vs.find(v => /^es/i.test(v.lang)) || null;
    }
  },
  init(){
    if (!TTS.supported) return;
    TTS.pickForLang();
    speechSynthesis.onvoiceschanged = () => TTS.pickForLang();
  },
  speak(text){
    if (!TTS.supported || !TTS.on) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (TTS.voice) u.voice = TTS.voice;
    u.lang = (TTS.voice && TTS.voice.lang) || (state.lang === 'en' ? 'en-US' : 'es-CL');
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
const audioFor = id => (window.LA_AUDIO && LA_AUDIO[id]) || null;

/* ---------- Bilingüe (ES / EN) ---------- */
const LANG_KEY = 'la_lang';
function t(k){ const e = (window.LA_UI || {})[k]; return e ? (e[state.lang === 'en' ? 1 : 0] || e[0] || k) : k; }
const EN = () => state.lang === 'en' ? (window.LA_EN || {}) : null;
function spTr(s, field){ const o = EN() && EN().species && EN().species[s.id]; return (o && o[field] !== undefined) ? o[field] : s[field]; }
function spDatos(s){ const o = EN() && EN().species && EN().species[s.id]; if (o && o.datos) return o.datos; const d = (window.LA_DATOS || {})[s.id]; return d ? d.datos : null; }
function spCuri(s){ const o = EN() && EN().species && EN().species[s.id]; if (o && o.curiosidad) return o.curiosidad; const d = (window.LA_DATOS || {})[s.id]; return d ? d.curiosidad : null; }
function ptTr(p, field){ const o = EN() && EN().puntos && EN().puntos[p.id]; return (o && o[field] !== undefined) ? o[field] : p[field]; }
function rTr(r, field){ const o = EN() && EN().rutas && EN().rutas[r.id]; return (o && o[field] !== undefined) ? o[field] : r[field]; }
function narrOf(id){ const e = EN(); return (e && e.narracion && e.narracion[id]) || LA_NARRATION[id]; }
function indOf(id){ const e = EN(); return (e && e.indicacion && e.indicacion[id]) || (window.LA_INDICACION || {})[id]; }
function codigoList(){ const e = EN(); return LA_CODIGO.map((c, i) => ({ icono: c.icono,
  titulo: (e && e.codigo && e.codigo[i]) ? e.codigo[i].titulo : c.titulo,
  texto:  (e && e.codigo && e.codigo[i]) ? e.codigo[i].texto  : c.texto })); }
function quizOf(id){ const q = (window.LA_QUIZ || {})[id]; if (!q) return null; const en = EN() && EN().quiz && EN().quiz[id];
  return en ? { pregunta: en.pregunta, opciones: en.opciones, explicacion: en.explicacion, correcta: q.correcta } : q; }
function logroTr(l, field){ const o = EN() && EN().logros && EN().logros[l.id]; return (o && o[field] !== undefined) ? o[field] : l[field]; }
function eTr(x, field){ const o = EN() && EN().experiencias && EN().experiencias[x.id]; return (o && o[field] !== undefined) ? o[field] : x[field]; }
function alientoList(){ const e = EN(); if (e && e.aliento) return e.aliento.map((f, i) => ({ tono: LA_ALIENTO[i].tono, frase: f })); return LA_ALIENTO; }

function setLang(l){
  state.lang = l;
  localStorage.setItem(LANG_KEY, l);
  if (TTS.pickForLang) TTS.pickForLang();
  applyChrome();
  go(state.view);
}
function applyChrome(){
  const lt = $('#langToggle'); if (lt) lt.textContent = state.lang === 'en' ? 'ES' : 'EN';
  const icons = { inicio:'🏠', mapa:'🧭', enruta:'🎧', especies:'🔍', cuaderno:'📖', travesias:'🐧' };
  $$('.tab').forEach(tab => { const v = tab.dataset.view; if (icons[v]) tab.innerHTML = `<span>${icons[v]}</span>${t('nav_'+v)}`; });
  const nl = $('#netLabel'); if (nl) nl.textContent = navigator.onLine ? t('online') : t('offline');
}

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
    if (l) setTimeout(() => celebrate(logroTr(l, 'titulo'), l.icono, t('logro_desbloqueado')), 500 + i * 1700);
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
    <h1>${t('hero_t')}</h1>
    <p>${t('hero_p')}</p>
  </section>

  <div class="stat-row">
    <div class="stat"><b>${LA_ROUTES.length}</b><span>${t('stat_rutas')}</span></div>
    <div class="stat"><b>${LA_SPECIES.length}</b><span>${t('stat_especies')}</span></div>
    <div class="stat"><b>${LA_POINTS.length}</b><span>${t('stat_puntos')}</span></div>
  </div>

  <div class="card" style="display:flex;align-items:center;gap:12px">
    <span style="font-size:26px">📴</span>
    <div><b style="font-size:14px">${t('offline_t')}</b>
      <p class="muted">${t('offline_p')}</p></div>
  </div>

  <h2 class="section-title">${t('explora')}</h2>
  <div class="quick-grid">
    <button class="quick quick--go" data-goto="enruta"><span class="ico">🎧</span><b>${t('q_enruta_t')}</b><small>${t('q_enruta_d')}</small></button>
    <button class="quick" data-goto="mapa"><span class="ico">🧭</span><b>${t('q_mapa_t')}</b><small>${t('q_mapa_d')}</small></button>
    <button class="quick" data-goto="especies"><span class="ico">🔍</span><b>${t('q_especies_t')}</b><small>${t('q_especies_d')}</small></button>
    <button class="quick" data-goto="cuaderno"><span class="ico">📖</span><b>${t('q_cuaderno_t')}</b><small>${t('q_cuaderno_d')}</small></button>
    <button class="quick" data-goto="travesias"><span class="ico">🐧</span><b>${t('q_travesias_t')}</b><small>${t('q_travesias_d')}</small></button>
  </div>

  <h2 class="section-title">${t('tus_logros')} <span class="pill st-menor" style="font-weight:600">${earnedLogros().length}/${LA_LOGROS.length}</span></h2>
  <div class="badge-grid">
    ${LA_LOGROS.map(l => { const on = earnedLogros().includes(l.id); return `<div class="badge ${on?'on':'off'}"><span class="badge-ic">${on?l.icono:'🔒'}</span><b>${esc(logroTr(l,'titulo'))}</b><small>${esc(logroTr(l,'desc'))}</small></div>`; }).join('')}
  </div>

  <h2 class="section-title">${t('mareas_hoy')} <span class="pill st-menor" style="font-weight:600">${t('demo')}</span></h2>
  ${tideStripHTML()}
  <p class="note">${t('mareas_note')}</p>

  <button class="btn secondary" id="openQR" style="margin-top:18px">${t('gen_qr')}</button>
`;

/* ---- MAPA ---- */
VIEWS.mapa = () => {
  const rtLbl = state.lang === 'en'
    ? { pie:'🚶 Walking', bici:'🚴 Cycling', ambas:'🚶🚴 Walking & cycling' }
    : { pie:'🚶 A pie',  bici:'🚴 En bici', ambas:'🚶🚴 A pie y bici' };
  return `
  <h2 class="section-title">${t('mapa_t')}</h2>
  <div class="map-wrap">
    ${mapSVG()}
    <div class="gps-readout" id="gpsReadout">
      <span>📍</span><span>${t('ubicacion')}: <b id="gpsText">${t('activando_gps')}</b></span>
    </div>
  </div>
  <button class="btn" id="startGuided" style="margin-bottom:14px">${t('iniciar_guiado')}</button>
  <div class="legend">
    <span><i style="background:var(--la-danger)"></i>${t('leg_exclusion')}</span>
    <span><i style="background:#b5651d"></i>${t('leg_estricta')}</span>
    <span><i style="background:var(--la-teal)"></i>${t('leg_obs')}</span>
    <span><i style="background:var(--la-green)"></i>${t('leg_sendero')}</span>
  </div>

  <h2 class="section-title">${t('rutas_oficiales')}</h2>
  ${LA_ROUTES.map(r => `
    <div class="card route-card" data-route="${r.id}" style="cursor:pointer">
      <div class="bar" style="background:${r.color}"></div>
      <div style="flex:1">
        <h3>${esc(rTr(r,'nombre'))}</h3>
        <p class="muted">${esc(rTr(r,'interes'))}</p>
        <div class="route-meta">
          <span class="pill st-menor">${r.distancia_km} km</span>
          <span class="pill st-menor">⏱ ${esc(rTr(r,'duracion'))}</span>
          <span class="pill st-vulnerable">${esc(rTr(r,'dificultad'))}</span>
          <span class="pill st-menor">${rtLbl[LA_ROUTE_TYPE[r.id]]||''}</span>
        </div>
      </div>
    </div>`).join('')}
`;
};

/* ---- EN RUTA (guía virtual por voz) ---- */
VIEWS.enruta = () => {
  if (!state.recorridoActivo) return enrutaIntroHTML();
  const total = LA_SPECIES.length, seen = loadCol().length;
  const pct = total ? Math.round(seen/total*100) : 0;
  return `
    <h2 class="section-title">${t('rec_marcha')}</h2>
    <p class="muted" style="margin-bottom:12px">${t('rec_marcha_p')}</p>

    <div class="er-controls">
      <div class="seg" id="modeSeg">
        <button data-mode="pie"  class="${state.mode==='pie'?'on':''}">${t('a_pie')}</button>
        <button data-mode="bici" class="${state.mode==='bici'?'on':''}">${t('en_bici')}</button>
      </div>
      <button class="voice-toggle ${TTS.on?'on':''}" id="voiceToggle" aria-label="Voz">${TTS.on?'🔊':'🔇'}</button>
    </div>

    <div class="progress-card">
      <div class="progress-head"><b>${t('tu_coleccion')}</b><span>${seen} / ${total} ${t('especies_w')}</span></div>
      <div class="progress-bar"><i style="width:${pct}%"></i></div>
    </div>

    <div id="alientoBox" class="aliento-box" aria-live="polite"></div>

    <div id="zonePanel">${state.currentZone ? zonePanelHTML(state.currentZone) : zoneIdleHTML()}</div>

    <div class="card demo-box">
      <label for="simZone">${t('modo_prueba')}</label>
      <select id="simZone">
        <option value="">${t('elige_zona')}</option>
        ${LA_POINTS.map(p=>`<option value="${p.id}">${p.icono} ${esc(ptTr(p,'nombre').split('(')[0].trim())}</option>`).join('')}
      </select>
      <button class="btn secondary small" id="testAliento" style="margin-top:10px">${t('escuchar_aliento')}</button>
    </div>

    <div class="gps-readout" style="border:1px solid var(--la-line);border-radius:12px;margin-top:6px">
      <span>📍</span><span id="erGps">${t('activando_gps')}</span>
    </div>
  `;
};

function zoneIdleHTML(){
  return `<div class="zone-idle"><span class="big">🧭</span><b>${t('zona_idle_t')}</b>
    <p class="muted">${t('zona_idle_p')}</p></div>`;
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
        <text x="0" y="32" font-size="11" text-anchor="middle" fill="var(--la-ink)" font-weight="700">${t('estas_aqui')}</text>
      </g>`;
    }
    return `<g transform="translate(${c.x},${c.y})" opacity=".35"><circle r="6" fill="#8aa0a6" stroke="#fff" stroke-width="1.5"/></g>`;
  }).join('');
  return `<svg class="map-svg" viewBox="0 0 340 380" xmlns="http://www.w3.org/2000/svg">${coast}`
    + `<text x="300" y="360" font-size="11" fill="#4a7ea8" text-anchor="end" opacity=".6">Océano Pacífico</text>${pts}</svg>`;
}

function zonePanelHTML(id){
  const p = pointById(id); if (!p) return zoneIdleHTML();
  const narr = narrOf(id) || ptTr(p, 'resumen');
  const ind = indOf(id);
  const sp = LA_SPECIES.filter(s => s.donde.includes(id));
  const fauna = sp.filter(s => s.reino !== 'flora');
  const flora = sp.filter(s => s.reino === 'flora');
  const seenLbl = isSeen0 => isSeen0 ? (state.lang==='en'?'✓ Seen':'✓ Visto') : (state.lang==='en'?'👁 Seen it!':'👁 ¡Lo vi!');
  const cardHTML = s => `
    <div class="er-species ${isSeen(s.id)?'seen':''}">
      <div class="er-thumb" data-openspecies="${s.id}">
        <img src="${imgFor(s.id)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
        <span class="dex-emoji" style="display:none">${s.emoji}</span>
      </div>
      <div style="flex:1" data-openspecies="${s.id}"><b>${esc(spTr(s,'nombre'))}</b><br><i style="font-size:12px;color:var(--la-ink-2)">${esc(s.cientifico)}</i></div>
      <button class="see-btn" data-see="${s.id}">${seenLbl(isSeen(s.id))}</button>
    </div>`;
  return `
    <div class="zone-live">
      <div class="zone-live__head"><span class="live-dot"></span> ${t('en_zona')}</div>
      <h3>${p.icono} ${esc(ptTr(p,'nombre').split('(')[0].trim())}</h3>
      <div class="zone-map">${zoneMapSVG(id)}</div>
      <p class="narration">${esc(narr)}</p>
      <button class="btn secondary small" id="replayNarr">${t('repetir')}</button>
      ${ind ? `<div class="zone-ind">
        <div class="ind-row"><span>🔭</span><p>${esc(ind.observa)}</p></div>
        <div class="ind-row"><span>🧭</span><p>${esc(ind.rumbo)}</p></div>
        <div class="ind-row care"><span>💚</span><p><b>${t('cuida')}:</b> ${esc(ind.cuidado)}</p></div>
      </div>` : ''}
      ${fauna.length?`<h4 class="er-group">${t('fauna_aqui')} <span class="pill st-menor">${fauna.length}</span></h4>${fauna.slice(0,12).map(cardHTML).join('')}${fauna.length>12?`<p class="muted" style="text-align:center;font-size:12px">${state.lang==='en'?`+${fauna.length-12} more in the Pokédex →`:`+${fauna.length-12} más en la Pokédex →`}</p>`:''}`:''}
      ${flora.length?`<h4 class="er-group">${t('flora_aqui')}</h4>${flora.map(cardHTML).join('')}`:''}
      ${quizHTML(id)}
    </div>`;
}

/* Mini-quiz educativo por zona */
function quizHTML(id){
  const q = quizOf(id); if (!q) return '';
  const ans = loadQuiz()[id];
  return `<div class="quiz" data-quiz="${id}">
    <h4 class="er-group">${t('quiz_title')}</h4>
    <p class="quiz-q">${esc(q.pregunta)}</p>
    <div class="quiz-opts">
      ${q.opciones.map((o, idx) => {
        let cls = ''; if (ans){ if (idx === q.correcta) cls = 'ok'; else if (ans.idx === idx) cls = 'no'; }
        return `<button class="quiz-opt ${cls}" data-opt="${idx}"${ans?' disabled':''}>${esc(o)}</button>`;
      }).join('')}
    </div>
    <div class="quiz-fb"${ans?'':' hidden'}>${ans?`<b>${ans.correct?t('quiz_ok'):t('quiz_casi')}</b> ${esc(q.explicacion)}`:''}</div>
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
  if (narrate) TTS.speak(narrOf(id) || ptTr(pointById(id), 'resumen'));
  if (navigator.vibrate) navigator.vibrate(60);
  celebrarLogros();
}

function wireZonePanel(){
  const rp = $('#replayNarr');
  if (rp) rp.onclick = () => { if (state.currentZone) TTS.speak(narrOf(state.currentZone) || ptTr(pointById(state.currentZone), 'resumen')); };
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

  const frase = alientoList()[i].frase;
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
  const grpEN = {'Aves marinas':'Seabirds','Mamíferos marinos':'Marine mammals','Aves playeras':'Shorebirds','Aves de humedal':'Wetland birds','Flora nativa':'Native plants','Flora de humedal':'Wetland plants','Mamíferos terrestres':'Land mammals','Reptiles':'Reptiles','Anfibios':'Amphibians','Peces costeros':'Coastal fish','Invertebrados marinos':'Marine invertebrates'};
  const grpLabel = g => g === 'todos' ? t('todas') : (state.lang === 'en' ? (grpEN[g] || g) : g);
  return `
    <h2 class="section-title">${t('pokedex_t')}</h2>
    <div class="progress-card">
      <div class="progress-head"><b>${t('tu_registro')}</b><span id="dexCount">${seen} / ${total} ${t('registradas')}</span></div>
      <div class="progress-bar"><i id="dexBar" style="width:${pct}%"></i></div>
    </div>
    <p class="muted" style="margin:2px 2px 10px">${t('pokedex_p')}</p>
    <div class="filter-row">
      ${grupos.map(g => `<button class="chip ${state.speciesFilter===g?'active':''}" data-filter="${esc(g)}">${esc(grpLabel(g))}</button>`).join('')}
    </div>
    <div class="dex-grid">
      ${list.map(s => {
        const num = String(LA_SPECIES.indexOf(s)+1).padStart(2,'0');
        const seenIt = isSeen(s.id);
        return `
        <div class="dex-card ${seenIt?'seen':'unseen'}" data-species="${s.id}">
          <span class="dex-num">#${num}</span>
          <div class="dex-img">
            <img src="${imgFor(s.id)}" alt="${esc(spTr(s,'nombre'))}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
            <span class="dex-emoji" style="display:none">${s.emoji}</span>
            ${seenIt?'':'<span class="dex-lock">?</span>'}
          </div>
          <div class="dex-name">${esc(spTr(s,'nombre'))}</div>
          <button class="dex-toggle ${seenIt?'on':''}" data-toggle="${s.id}">${seenIt?t('lo_vi'):t('no_lo_vi')}</button>
        </div>`;
      }).join('')}
    </div>
  `;
};

function updateDexCounter(){
  const total = LA_SPECIES.length, seen = loadCol().length;
  const c = $('#dexCount'); if (c) c.textContent = `${seen} / ${total} ${t('registradas')}`;
  const b = $('#dexBar'); if (b) b.style.width = (total?Math.round(seen/total*100):0) + '%';
}

/* ---- CUADERNO ---- */
VIEWS.cuaderno = () => {
  const logs = loadLogs();
  return `
    <h2 class="section-title">${t('cuaderno_t')}</h2>
    <div class="card">
      <form class="field-form" id="logForm">
        <div>
          <label for="fSpecies">${t('especie_obs')}</label>
          <select id="fSpecies" required>
            <option value="">${t('selecciona')}</option>
            ${LA_SPECIES.map(s => `<option value="${s.id}">${s.emoji} ${esc(spTr(s,'nombre'))}</option>`).join('')}
            <option value="otra">${t('otra')}</option>
          </select>
        </div>
        <div>
          <label for="fPlace">${t('lugar')}</label>
          <select id="fPlace">
            <option value="">${t('usar_gps')}</option>
            ${LA_POINTS.map(p => `<option value="${p.id}">${p.icono} ${esc(ptTr(p,'nombre'))}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="fNotes">${t('notas')}</label>
          <textarea id="fNotes" placeholder="${t('notas_ph')}"></textarea>
        </div>
        <div>
          <label for="fFoto">${t('foto_op')}</label>
          <input type="file" id="fFoto" accept="image/*" capture="environment">
          <div id="fotoPrev" class="foto-prev" hidden><img id="fotoImg" alt="preview"></div>
        </div>
        <button class="btn" type="submit">${t('guardar_av')}</button>
      </form>
    </div>

    <h2 class="section-title">${t('tus_registros')} ${logs.length?`<span class="pill st-menor">${logs.length}</span>`:''}</h2>
    <div id="logList">
      ${logs.length ? logs.map(logCardHTML).join('') :
        `<div class="empty"><span class="big">🐧</span>${t('vacio_t')}<br>${t('vacio_p')}</div>`}
    </div>
    ${logs.length ? `<button class="btn secondary small" id="exportLogs">${t('exportar')}</button>` : ''}
  `;
};

/* ---- TRAVESÍAS ---- */
VIEWS.travesias = () => {
  const destacada = LA_EXPERIENCES.find(e => e.destacada) || LA_EXPERIENCES[0];
  const resto = LA_EXPERIENCES.filter(e => e !== destacada);
  return `
    <div class="exp-hero">
      <span class="exp-badge">${t('exp_estrella')}</span>
      <h2>${destacada.emoji} ${esc(eTr(destacada,'nombre'))}</h2>
      <p>${esc(eTr(destacada,'descripcion'))}</p>
    </div>
    <div class="card">
      <div class="route-meta" style="margin-bottom:10px">
        <span class="pill st-menor">⏱ ${esc(destacada.duracion)}</span>
        <span class="pill st-vulnerable">${esc(eTr(destacada,'nivel'))}</span>
      </div>
      <div class="includes">${eTr(destacada,'incluye').map(i => `<span>✓ ${esc(i)}</span>`).join('')}</div>
      <button class="btn wa" data-book="${destacada.id}">${t('reservar_wa')}</button>
    </div>

    <h2 class="section-title">${t('otras_exp')}</h2>
    ${resto.map(e => `
      <div class="card">
        <h3>${e.emoji} ${esc(eTr(e,'nombre'))}</h3>
        <p class="muted" style="margin:4px 0 8px">${esc(eTr(e,'descripcion'))}</p>
        <div class="route-meta"><span class="pill st-menor">⏱ ${esc(e.duracion)}</span><span class="pill st-vulnerable">${esc(eTr(e,'nivel'))}</span></div>
        <div class="btn-row"><button class="btn wa small" data-book="${e.id}">${t('reservar')}</button></div>
      </div>`).join('')}

    <div class="card" style="text-align:center">
      <b>Litoral Adventure</b>
      <p class="muted">${t('la_lema')}</p>
      ${LA_CONTACT.sernatur ? `<div style="margin:10px 0"><span class="pill st-menor">${t('sernatur_ok')}</span></div>` : ''}
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
  const q = $('#openQR'); if (q) q.onclick = openQRSheet;
};

AFTER.mapa = () => {
  $$('.map-point').forEach(g => g.onclick = () => openPointSheet(g.dataset.point));
  $$('[data-route]').forEach(c => c.onclick = () => openRouteSheet(c.dataset.route));
  const sg = $('#startGuided'); if (sg) sg.onclick = () => go('enruta');
  requestGeo();               // activa GPS y pinta el "tú estás aquí"
};

/* ===== Charla del guía (onboarding + tutorial) ===== */
function codigoListHTML(){
  return `<ul class="codigo-list">${codigoList().map(c =>
    `<li><span class="ci">${c.icono}</span><div><b>${esc(c.titulo)}</b><p>${esc(c.texto)}</p></div></li>`
  ).join('')}</ul>`;
}
function modeChooserHTML(){
  return `<div class="seg onboard-seg">
      <button data-mode="pie"  class="${state.mode==='pie'?'on':''}">${t('a_pie')}</button>
      <button data-mode="bici" class="${state.mode==='bici'?'on':''}">${t('en_bici')}</button>
    </div>
    <p class="muted" style="margin-top:10px">${state.lang==='en'?'You can change it anytime during the tour.':'Puedes cambiarlo cuando quieras durante el recorrido.'}</p>`;
}
function enrutaIntroHTML(){
  return `
    <div class="er-intro">
      <div class="er-intro__hero">
        <span class="er-intro__emoji">🎧</span>
        <h2>${t('q_enruta_t')}</h2>
        <p>${t('rec_intro_p')}</p>
      </div>
      <div class="card er-intro__pact">
        <b>${t('antes_partir')}</b>
        <p class="muted">${t('antes_partir_p')}</p>
      </div>
      <button class="btn" id="comenzarRecorrido">${t('comenzar')}</button>
      <button class="btn secondary" id="verCodigo" style="margin-top:10px">${t('ver_codigo')}</button>
    </div>`;
}
function openQRSheet(){
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  openSheet(`<h2>${t('qr_t')}</h2>
    <p class="muted">${t('qr_p')}</p>
    <div class="qr-list">
      ${LA_POINTS.map(p => `<div class="qr-item">
        <div class="qr-box" data-qr="${base}?zona=${p.id}"></div>
        <b>${p.icono} ${esc(ptTr(p,'nombre').split('(')[0].trim())}</b>
        <small>${esc(base)}?zona=${p.id}</small>
      </div>`).join('')}
    </div>
    <div class="btn-row"><button class="btn" onclick="window.print()">${t('imprimir')}</button><button class="btn secondary" onclick="closeSheet()">${t('cerrar')}</button></div>`);
  $$('.qr-box').forEach(el => {
    try { new QRCode(el, { text: el.dataset.qr, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M }); }
    catch { el.textContent = 'QR no disponible'; }
  });
}

function openCodigoSheet(){
  openSheet(`<h2>${t('codigo_t')}</h2>
    <p class="muted">${t('codigo_sub')}</p>
    ${codigoListHTML()}
    <div class="btn-row"><button class="btn" onclick="closeSheet()">${t('entendido')}</button></div>`);
}
function buildPasos(full){
  const en = state.lang === 'en';
  const L = (es, eng) => en ? eng : es;
  const pasos = [
    { ic:'👋', t: t('bienvenida_t'),
      voz: L('¡Hola! Soy tu guía en Litoral Adventure. Antes de partir, conversemos un momento.',
             'Hi! I’m your guide at Litoral Adventure. Before we set off, let’s talk for a moment.'),
      html:`<p class="muted">${L('Vas a recorrer un lugar único de la costa de Algarrobo. Yo te acompaño en cada paso para que lo vivas y lo cuides.',
             'You’re about to explore a unique place on the Algarrobo coast. I’ll be with you every step so you can enjoy it and care for it.')}</p>` },
    { ic:'🌿', t: t('codigo_t').replace('🌿 ',''),
      voz: L('Recuerda lo más importante: observamos sin intervenir, con respeto y cuidado por cada ser vivo.',
             'Remember the most important thing: we observe without intervening, with respect and care for every living being.'),
      html: codigoListHTML() }
  ];
  if (full){
    pasos.push({ ic:'🗺️', t: L('Cómo funciona el recorrido','How the tour works'),
      voz: L('A medida que avances, el mapa detectará tu zona y te contaré qué hay a tu alrededor.',
             'As you move, the map will detect your zone and I’ll tell you what’s around you.'),
      html:`<ul class="tut">
        <li><span>📍</span> ${L('Al entrar a una zona, el <b>mapa se activa</b> y te doy indicaciones.','When you enter a zone, the <b>map activates</b> and I give you directions.')}</li>
        <li><span>🔊</span> ${L('Escucharás la <b>narración por voz</b> de la flora y fauna del lugar.','You’ll hear the <b>voice narration</b> of the local wildlife.')}</li>
        <li><span>💪</span> ${L('Te <b>animaré</b> mientras avanzas.','I’ll <b>cheer you on</b> as you go.')}</li>
      </ul>` });
    pasos.push({ ic:'📕', t: L('Arma tu Pokédex','Build your Pokédex'),
      voz: L('Cuando descubras una especie, márcala como “Lo vi” para coleccionarla en tu Pokédex.',
             'When you discover a species, mark it as “Seen it” to collect it in your Pokédex.'),
      html:`<ul class="tut">
        <li><span>👁</span> ${L('Toca <b>“¡Lo vi!”</b> cuando avistes una especie.','Tap <b>“Seen it!”</b> when you spot a species.')}</li>
        <li><span>🖼️</span> ${L('Se revela su <b>foto real</b> y sube tu colección.','Its <b>real photo</b> is revealed and your collection grows.')}</li>
        <li><span>📖</span> ${L('También puedes anotarla en tu <b>Cuaderno de campo</b>.','You can also log it in your <b>Field journal</b>.')}</li>
      </ul>` });
  }
  pasos.push({ ic:'🚶🚴', t: L('¿Cómo te mueves hoy?','How are you moving today?'),
    voz: L('¿Vas a pie o en bicicleta?','Are you walking or cycling?'),
    html: modeChooserHTML() });
  pasos.push({ ic:'🤝', t: t('compromiso_t'), final:true,
    voz: L('¿Te comprometes a cuidar y respetar este lugar mientras lo recorres?',
           'Do you commit to caring for and respecting this place as you explore it?'),
    html:`<p>${L('Me comprometo a <b>observar sin intervenir</b>, seguir las indicaciones y <b>dejar todo como lo encontré</b>. 🌊',
           'I commit to <b>observing without intervening</b>, following the directions and <b>leaving everything as I found it</b>. 🌊')}</p>` });
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
    setTimeout(() => { if (TTS.on) TTS.speak(state.lang==='en'?'All set! Let’s start calmly. Enjoy and care for every corner.':'¡Listo! Empecemos con calma. Disfruta y cuida cada rincón.'); }, 350);
  }
  function render(){
    const p = pasos[i];
    ov.innerHTML = `
      <div class="onboard__card">
        <div class="onboard__top">
          <span class="onboard__ic">${p.ic}</span>
          <button class="onboard__skip" id="obSkip">${t('saltar')}</button>
        </div>
        <h2>${esc(p.t)}</h2>
        <div class="onboard__body">${p.html}</div>
        <div class="onboard__dots">${pasos.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
        <div class="onboard__nav">
          ${i>0?`<button class="btn secondary" id="obPrev">${t('atras')}</button>`:''}
          <button class="btn" id="obNext">${p.final?t('me_comprometo'):t('siguiente')}</button>
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
  const toast = document.createElement('div');
  toast.className = 'celebrate';
  toast.innerHTML = `<div class="celebrate__card"><span class="celebrate__emoji">${emoji||'🎉'}</span><b>${esc(titulo||t('nueva_especie'))}</b><p>${esc(nombre)}</p></div>`;
  document.body.appendChild(toast);
  if (navigator.vibrate) navigator.vibrate([40,30,60]);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 2200);
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
    b.textContent = on ? t('lo_vi') : t('no_lo_vi');
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
  state.pendingFoto = null;
  const foto = $('#fFoto');
  if (foto) foto.onchange = () => {
    const f = foto.files && foto.files[0];
    if (!f){ state.pendingFoto = null; $('#fotoPrev').hidden = true; return; }
    resizePhoto(f, 900, url => {
      state.pendingFoto = url;
      if (url){ $('#fotoImg').src = url; $('#fotoPrev').hidden = false; }
    });
  };
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
      speciesName: sp === 'otra' ? t('especie_no_listada') : (species ? spTr(species,'nombre') : sp),
      emoji: sp === 'otra' ? '❓' : (species ? species.emoji : '🔎'),
      place: placeId ? ptTr(pointById(placeId),'nombre') : (state.pos ? `GPS ${state.pos.lat.toFixed(4)}, ${state.pos.lng.toFixed(4)}` : t('sin_ubicacion')),
      notes: $('#fNotes').value.trim(),
      foto: state.pendingFoto || null,
      ts: new Date().toISOString()
    };
    const logs = loadLogs(); logs.unshift(log);
    if (!saveLogs(logs)){                 // cuota superada → guardar sin foto
      log.foto = null; saveLogs(logs);
    }
    state.pendingFoto = null;
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
  if (txt && nearest) txt.innerHTML = `${state.lang==='en'?'':'a '}<b>${fmtDist(nd)}</b> ${state.lang==='en'?'from':'de'} ${esc(ptTr(nearest,'nombre').split('(')[0].trim())}`;
  positionUserDot(nearest, nd);

  // lector de posición del modo En Ruta
  const erGps = $('#erGps');
  if (erGps && nearest) erGps.innerHTML = `${state.lang==='en'?'':'a '}<b>${fmtDist(nd)}</b> ${state.lang==='en'?'from':'de'} ${esc(ptTr(nearest,'nombre').split('(')[0].trim())}`;

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
  const lugares = s.donde.map(pid => pointById(pid)).filter(Boolean).map(p => `${p.icono} ${esc(ptTr(p,'nombre').split('(')[0].trim())}`).join(', ');
  const num = String(LA_SPECIES.indexOf(s)+1).padStart(2,'0');
  const cred = imgCredit(s.id);
  const datos = spDatos(s), curi = spCuri(s);
  const seenIt = isSeen(s.id);
  openSheet(`
    <div class="sheet-hero ${seenIt?'':'locked'}">
      <img src="${imgFor(s.id)}" alt="${esc(spTr(s,'nombre'))}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <span class="sheet-hero__emoji" style="display:none">${s.emoji}</span>
      <span class="dex-num">#${num}</span>
    </div>
    <h2>${esc(spTr(s,'nombre'))}</h2>
    <i style="color:var(--la-ink-2)">${esc(s.cientifico)}</i>
    <div style="margin:8px 0"><span class="pill ${estadoClass(s.estado)}">${esc(spTr(s,'estado'))}</span> <span class="pill st-menor">${esc(spTr(s,'grupo'))}</span></div>

    <button class="btn ${seenIt?'':'secondary'}" id="sheetSeen">${seenIt?t('lo_vi_quitar'):t('marcar_lo_vi')}</button>

    ${datos ? `<div class="datos-grid">${datos.map(([ic,lab,val]) =>
      `<div class="dato"><span class="dato-ic">${ic}</span><div><small>${esc(lab)}</small><b>${esc(val)}</b></div></div>`).join('')}</div>` : ''}

    <div class="detail-block"><h4>${t('ficha')}</h4><p class="muted">${esc(spTr(s,'ficha'))}</p></div>
    ${curi ? `<div class="sabias"><span class="sabias-ic">💡</span><div><b>${t('sabias')}</b><p>${esc(curi)}</p></div></div>` : ''}
    ${s.sonido?`<div class="detail-block"><h4>${t('sonido')}</h4><p class="muted">${esc(spTr(s,'sonido'))}</p>
      ${audioFor(s.id)?`<button class="btn secondary small" id="playSound" style="margin-top:8px">${t('escuchar_sonido')}</button>
        <audio id="sndEl" src="${audioFor(s.id).file}" preload="none"></audio>
        <p class="img-credit" style="text-align:left;margin-top:6px">🎙️ ${esc(audioFor(s.id).credit)}${audioFor(s.id).license?' · '+esc(audioFor(s.id).license):''} · <a href="${audioFor(s.id).source}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`:''}
    </div>`:''}
    <div class="detail-block"><h4>${t('mejor_epoca')}</h4><p class="muted">${esc(spTr(s,'mejor_epoca'))}</p></div>
    <div class="detail-block"><h4>${t('donde_verla')}</h4><p class="muted">${lugares}</p></div>
    ${cred?`<p class="img-credit">📷 ${esc(cred.credit)}${cred.license?' · '+esc(cred.license):''} · <a href="${cred.source}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`:''}
    <div class="btn-row"><button class="btn secondary" id="sheetLog">${t('anotar')}</button><button class="btn secondary" onclick="closeSheet()">${t('cerrar')}</button></div>
  `);
  const sb = $('#sheetSeen');
  if (sb) sb.onclick = () => {
    const on = toggleSeen(s.id);
    sb.textContent = on ? t('lo_vi_quitar') : t('marcar_lo_vi');
    sb.classList.toggle('secondary', !on);
    $('.sheet-hero')?.classList.toggle('locked', !on);
    syncDexCard(s.id);
    if (on) celebrate(s.nombre, s.emoji);
    celebrarLogros();
  };
  const ps = $('#playSound');
  if (ps) ps.onclick = () => {
    const a = $('#sndEl'); if (!a) return;
    if (a.paused){
      a.play().then(() => { ps.textContent = state.lang==='en'?'⏸ Playing…':'⏸ Reproduciendo…'; })
              .catch(() => { ps.textContent = state.lang==='en'?'🔇 Not available on this device':'🔇 No disponible en este equipo'; });
      a.onended = () => { ps.textContent = t('escuchar_sonido'); };
    } else { a.pause(); ps.textContent = t('escuchar_sonido'); }
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
  if (btn){ btn.classList.toggle('on', on); btn.textContent = on ? t('lo_vi') : t('no_lo_vi'); }
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
    <h2>${p.icono} ${esc(ptTr(p,'nombre'))}</h2>
    <div style="margin:8px 0"><span class="pill ${p.proteccion==='exclusion'?'st-peligro':'st-vulnerable'}">${esc(ptTr(p,'tipo'))}</span></div>
    <p class="muted">${esc(ptTr(p,'resumen'))}</p>
    <div class="kv"><b>${t('coordenadas')}</b><span>${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span></div>
    <div class="kv"><b>${t('tipo')}</b><span>${esc(ptTr(p,'tipo'))}</span></div>
    ${species.length?`<div class="detail-block"><h4>${t('especies_aqui')}</h4><p class="muted">${species.map(s=>`${s.emoji} ${esc(spTr(s,'nombre'))}`).join(' · ')}</p></div>`:''}
    <div class="btn-row">
      <a class="btn" href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank" rel="noopener">${t('abrir_mapas')}</a>
      <button class="btn secondary" onclick="closeSheet()">${t('cerrar')}</button>
    </div>
  `);
}

function openRouteSheet(id){
  const r = LA_ROUTES.find(x => x.id === id); if (!r) return;
  const pts = r.puntos.map(pid => pointById(pid)).filter(Boolean);
  openSheet(`
    <h2>${esc(rTr(r,'nombre'))}</h2>
    <div class="route-meta" style="margin:8px 0">
      <span class="pill st-menor">${r.distancia_km} km</span>
      <span class="pill st-menor">⏱ ${esc(rTr(r,'duracion'))}</span>
      <span class="pill st-vulnerable">${esc(rTr(r,'dificultad'))}</span>
    </div>
    <div class="detail-block"><h4>${t('puntos_interes')}</h4><p class="muted">${esc(rTr(r,'interes'))}</p></div>
    <div class="detail-block"><h4>${t('recorrido')}</h4>${pts.map(p=>`<p class="muted">${p.icono} ${esc(ptTr(p,'nombre').split('(')[0].trim())}</p>`).join('')}</div>
    <div class="btn-row"><button class="btn secondary" onclick="closeSheet()">${t('cerrar')}</button></div>
  `);
}

/* ============================================================================
   CUADERNO (localStorage)
   ============================================================================ */
const LS_KEY = 'la_field_logs_v1';
function loadLogs(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function saveLogs(l){ try { localStorage.setItem(LS_KEY, JSON.stringify(l)); return true; } catch { return false; } }
function logCardHTML(l){
  const d = new Date(l.ts);
  const loc = state.lang === 'en' ? 'en-US' : 'es-CL';
  const fecha = d.toLocaleDateString(loc,{day:'2-digit',month:'short'}) + ' · ' + d.toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'});
  return `<div class="card log-item">
    <div class="le">${l.emoji}</div>
    <div style="flex:1">
      <h3 style="font-size:15px">${esc(l.speciesName)}</h3>
      <small>📍 ${esc(l.place)} · ${fecha}</small>
      ${l.notes?`<p class="muted" style="margin-top:4px">${esc(l.notes)}</p>`:''}
      ${l.foto?`<img class="log-foto" src="${l.foto}" alt="Foto del avistamiento">`:''}
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
  return `<div class="tide-strip">${LA_TIDES_DEMO.map(td => `
    <div class="tide ${td.tipo}">
      <div class="t">${td.hora}</div>
      <div class="a">${td.altura}</div>
      <span class="lbl">${td.tipo==='baja'?t('tide_baja'):t('tide_alta')}</span>
    </div>`).join('')}</div>`;
}

/* ============================================================================
   RESERVA POR WHATSAPP
   ============================================================================ */
function bookWhatsApp(expId){
  const e = LA_EXPERIENCES.find(x => x.id === expId);
  const nombre = e ? eTr(e, 'nombre') : (state.lang==='en'?'an experience':'una experiencia');
  const msg = encodeURIComponent(state.lang==='en'
    ? `Hi Litoral Adventure! 🌊 I’d like to book: ${nombre}.\nWhat dates and times do you have available?`
    : `¡Hola Litoral Adventure! 🌊 Quiero reservar: ${nombre}.\n¿Qué fechas y horarios tienen disponibles?`);
  window.open(`https://wa.me/${LA_CONTACT.whatsapp}?text=${msg}`, '_blank');
}

/* ============================================================================
   ESTADO DE RED
   ============================================================================ */
function updateNet(){
  const el = $('#netStatus'), lbl = $('#netLabel');
  const on = navigator.onLine;
  el.classList.toggle('online', on);
  lbl.textContent = on ? t('online') : t('offline');
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

/* ============================================================================
   BOOT
   ============================================================================ */
updateNet();
applyChrome();
{ const _lt = $('#langToggle'); if (_lt) _lt.onclick = () => setLang(state.lang === 'en' ? 'es' : 'en'); }

/* Deep-link (QR en terreno / enlaces): ?zona= ?especie= ?qr= */
(function initFromURL(){
  const p = new URLSearchParams(location.search);
  const zona = p.get('zona'), esp = p.get('especie');
  if (zona && pointById(zona)){
    state.recorridoActivo = true;
    go('enruta');
    enterZone(zona, true);
  } else if (esp && LA_SPECIES.find(s => s.id === esp)){
    go('especies'); openSpeciesSheet(esp);
  } else if (p.get('qr')){
    go('inicio'); openQRSheet();
  } else {
    go('inicio');
  }
})();

/* Service worker (offline) — falla en silencio en file:// */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* expone helpers usados en onclick inline */
window.closeSheet = closeSheet;
window.delLog = delLog;
