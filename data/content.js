/* ============================================================================
   LITORAL ADVENTURE · Contenido de la app (offline-first)
   ----------------------------------------------------------------------------
   Todo el contenido vive aquí para poder editarlo sin tocar la lógica.
   ⚠️ Verificar coordenadas y estado de protección con fuentes oficiales
      (Ministerio del Medio Ambiente, Santuarios de la Naturaleza, SHOA).
   ============================================================================ */

/* --- Puntos clave de la costa de Algarrobo -------------------------------- */
/* geofence: radio en metros para disparar la alerta de proximidad.          */
window.LA_POINTS = [
  {
    id: 'isla-pinguinos',
    nombre: 'Isla de los Pingüinos (Islote Pájaro Niño)',
    lat: -33.3625, lng: -71.6840,
    tipo: 'Santuario de la Naturaleza',
    proteccion: 'exclusion',
    geofence: 300,
    icono: '🐧',
    resumen: 'Colonia de pingüino de Humboldt. Zona de exclusión: se observa desde el agua manteniendo distancia, sin desembarcar.',
    destino_travesia: true
  },
  {
    id: 'humedal-tunquen',
    nombre: 'Humedal de Tunquén',
    lat: -33.4625, lng: -71.7228,
    tipo: 'Humedal prioritario',
    proteccion: 'estricta',
    geofence: 250,
    icono: '🦆',
    resumen: 'Humedal costero con aves acuáticas y vegetación nativa. Conservación estricta: sendero habilitado, no salir de la traza.',
    destino_travesia: false
  },
  {
    id: 'punta-penablanca',
    nombre: 'Punta Peñablanca',
    lat: -33.3650, lng: -71.6942,
    tipo: 'Acantilado costero',
    proteccion: 'observacion',
    geofence: 150,
    icono: '🪨',
    resumen: 'Acantilados con fauna marina. Buen punto para ver chungungos con marea baja.',
    destino_travesia: false
  },
  {
    id: 'mirador-canelo',
    nombre: 'Mirador El Canelo',
    lat: -33.3697, lng: -71.6826,
    tipo: 'Punto de observación',
    proteccion: 'libre',
    geofence: 120,
    icono: '🔭',
    resumen: 'Vista panorámica y aves marinas. Acceso libre controlado.',
    destino_travesia: false
  },
  {
    id: 'quebrada-rosas',
    nombre: 'Quebrada de Las Rosas',
    lat: -33.4194, lng: -71.7083,
    tipo: 'Bosque esclerófilo',
    proteccion: 'sendero',
    geofence: 120,
    icono: '🌿',
    resumen: 'Bosque nativo esclerófilo con sendero habilitado.',
    destino_travesia: false
  }
];

/* --- Ruta grabada del recorrido (loop Algarrobo) --------------------------- */
/* Trazado reconstruido sobre coordenadas reales (Relive de Inty). El guiado    */
/* virtual sigue esta ruta. Reemplazable por un GPX real más adelante.          */
window.LA_RUTA_GRABADA = [
  [-33.3525, -71.6655], [-33.3560, -71.6685], [-33.3595, -71.6720], [-33.3610, -71.6775],
  [-33.3625, -71.6840], [-33.3640, -71.6905], [-33.3650, -71.6942], [-33.3672, -71.6895],
  [-33.3690, -71.6850], [-33.3697, -71.6826], [-33.3735, -71.6820], [-33.3781, -71.6816],
  [-33.3768, -71.6745], [-33.3730, -71.6705], [-33.3692, -71.6681], [-33.3655, -71.6688],
  [-33.3610, -71.6690], [-33.3560, -71.6675], [-33.3525, -71.6655]
];

/* --- Rutas ---------------------------------------------------------------- */
window.LA_ROUTES = [
  {
    id: 'r1',
    nombre: 'Mirador El Canelo → Isla de los Pingüinos',
    distancia_km: 1.8, duracion: '30–40 min', dificultad: 'Baja',
    interes: 'Vista panorámica, aves marinas, colonia de pingüinos',
    puntos: ['mirador-canelo', 'isla-pinguinos'],
    color: '#2bb6c4'
  },
  {
    id: 'r2',
    nombre: 'Sendero del Humedal Tunquén',
    distancia_km: 2.2, duracion: '45–60 min', dificultad: 'Media',
    interes: 'Aves acuáticas, vegetación nativa',
    puntos: ['humedal-tunquen'],
    color: '#3fa34d'
  },
  {
    id: 'r3',
    nombre: 'Acantilados de Punta Peñablanca',
    distancia_km: 3.5, duracion: '1 h 15 min', dificultad: 'Media',
    interes: 'Fauna marina, formación geológica, chungungos',
    puntos: ['punta-penablanca', 'quebrada-rosas'],
    color: '#e08a3c'
  }
];

/* --- Tipo de recorrido por ruta --------------------------------------------- */
/* 'pie' = solo a pie · 'bici' = apto en bici · 'ambas' = a pie y en bici       */
window.LA_ROUTE_TYPE = { r1: 'ambas', r2: 'pie', r3: 'bici' };

/* --- Guion de narración del guía virtual (por zona) ------------------------- */
/* Texto que la app lee en voz alta al llegar a cada zona en el modo "En Ruta". */
window.LA_NARRATION = {
  'isla-pinguinos':
    'Estás frente a la Isla de los Pingüinos, un santuario de la naturaleza. En estos roqueríos anida una colonia de pingüinos de Humboldt. Obsérvalos desde el agua, con calma y a distancia: no desembarques ni te acerques a los nidos. Sobre las rocas también verás yecos, unos cormoranes negros, secando sus alas al sol.',
  'mirador-canelo':
    'Bienvenido al mirador El Canelo. Desde aquí tienes una vista panorámica del litoral y de la Isla de los Pingüinos. Mira hacia el mar: es común ver pelícanos volando en fila, rasando el agua antes de zambullirse a pescar.',
  'punta-penablanca':
    'Llegaste a Punta Peñablanca, un acantilado costero. Si el mar está calmo y con marea baja, busca entre las rocas al chungungo, una pequeña nutria marina. En la orilla podrías ver pilpilenes con su pico rojo, y en las dunas crece la doca, con sus flores moradas. Camina con cuidado y no pises los nidos en la arena.',
  'quebrada-rosas':
    'Entras a la Quebrada de Las Rosas, un bosque nativo esclerófilo. A tu alrededor hay quillayes, litres y peumos, árboles adaptados al clima seco de Chile central. Ojo con el litre: a algunas personas les da alergia al tocarlo. Sigue siempre el sendero habilitado para no dañar la vegetación.',
  'humedal-tunquen':
    'Estás en el Humedal de Tunquén, un ecosistema costero muy valioso y de conservación estricta. En sus aguas someras verás garzas grandes cazando inmóviles, y otras aves entre totoras y juncos. Mantente en el sendero y guarda silencio para no espantarlas.'
};

/* --- Código del Explorador (cuidado y respeto) ------------------------------ */
window.LA_CODIGO = [
  { icono: '👀', titulo: 'Observa sin intervenir', texto: 'Mira y fotografía, pero no toques ni persigas a los animales.' },
  { icono: '📏', titulo: 'Mantén distancia', texto: 'Acércate con calma y respeta el espacio de la fauna, sobre todo cerca de nidos.' },
  { icono: '🚫', titulo: 'No alimentes', texto: 'Darles comida los enferma y altera su comportamiento natural.' },
  { icono: '🥾', titulo: 'Sigue los senderos', texto: 'No salgas de las rutas habilitadas: proteges la vegetación y las dunas.' },
  { icono: '🌱', titulo: 'No recolectes', texto: 'Deja flores, conchas y piedras donde están. Llévate solo fotos.' },
  { icono: '🔇', titulo: 'Silencio y calma', texto: 'Baja la voz en zonas sensibles: el ruido asusta a las aves.' },
  { icono: '🗑️', titulo: 'Llévate tu basura', texto: 'Todo lo que traes, vuelve contigo. Deja el lugar mejor de como lo encontraste.' }
];

/* --- Indicaciones del guía por zona (se muestran al entrar) ------------------ */
window.LA_INDICACION = {
  'isla-pinguinos': {
    observa: 'Mira hacia los roqueríos: ahí anidan los pingüinos de Humboldt.',
    rumbo:   'Obsérvalos desde el agua o desde el mirador, sin desembarcar.',
    cuidado: 'Zona de exclusión: mantén distancia y silencio absoluto.'
  },
  'mirador-canelo': {
    observa: 'Asómate al mirador y observa el mar abierto y las aves.',
    rumbo:   'Continúa por el sendero señalizado hacia la costa.',
    cuidado: 'No arrojes basura ni bajes por zonas de riesgo.'
  },
  'punta-penablanca': {
    observa: 'Busca chungongos entre las rocas, mejor con marea baja.',
    rumbo:   'Avanza por el borde del acantilado con precaución.',
    cuidado: 'No pises nidos en la arena ni recolectes conchas vivas.'
  },
  'quebrada-rosas': {
    observa: 'Reconoce quillay, litre y peumo a tu alrededor.',
    rumbo:   'Sigue el sendero habilitado dentro del bosque.',
    cuidado: 'No toques el litre (produce alergia) ni cortes ramas.'
  },
  'humedal-tunquen': {
    observa: 'Observa las aves acuáticas entre totoras y juncos.',
    rumbo:   'Camina solo por la pasarela o el sendero marcado.',
    cuidado: 'Conservación estricta: guarda silencio y no ingreses al agua.'
  }
};

/* --- Datos precisos por especie (objetivos) + dato curioso ------------------ */
/* Cada 'datos' es [icono, etiqueta, valor]. Fuente: fichas de Wikipedia/IUCN.  */
window.LA_DATOS = {
  'pinguino-humboldt': {
    datos: [
      ['📏','Tamaño','56–70 cm de alto'],
      ['⚖️','Peso','4–5 kg'],
      ['🍽️','Dieta','Peces pequeños: anchoveta, sardina'],
      ['🏝️','Hábitat','Costas e islotes rocosos'],
      ['🌎','Distribución','Costa del Pacífico de Perú y Chile'],
      ['🛡️','Conservación','Vulnerable (UICN)']
    ],
    curiosidad: 'Su rebuzno, parecido al de un burro, le dio el apodo de “pájaro niño”. Bajo el agua nada a más de 30 km/h persiguiendo cardúmenes.'
  },
  'chungungo': {
    datos: [
      ['📏','Tamaño','87–115 cm (incluida la cola)'],
      ['⚖️','Peso','3–5 kg'],
      ['🍽️','Dieta','Crustáceos, moluscos, erizos y peces'],
      ['🪨','Hábitat','Roqueríos expuestos al oleaje'],
      ['🌎','Distribución','Costa del Pacífico sur de Sudamérica'],
      ['🛡️','Conservación','En peligro (UICN)']
    ],
    curiosidad: 'Es la nutria más pequeña del mundo y la única que vive exclusivamente en el mar: todas sus parientes son de río.'
  },
  'pelicano': {
    datos: [
      ['📏','Tamaño','Hasta 1,5 m; ~2 m de envergadura'],
      ['⚖️','Peso','7–8 kg'],
      ['🍽️','Dieta','Peces, sobre todo anchoveta'],
      ['🌊','Hábitat','Costas, caletas y roqueríos'],
      ['🌎','Distribución','Costa del Pacífico de Perú y Chile'],
      ['🛡️','Conservación','Casi amenazada (UICN)']
    ],
    curiosidad: 'Su bolsa bajo el pico funciona como una red: puede contener varios litros de agua y peces. Pesca lanzándose en picada desde el aire.'
  },
  'pilpilen': {
    datos: [
      ['📏','Tamaño','42–52 cm'],
      ['⚖️','Peso','400–700 g'],
      ['🍽️','Dieta','Mariscos, crustáceos y gusanos marinos'],
      ['🏖️','Hábitat','Playas, roqueríos y estuarios'],
      ['🌎','Distribución','Costas de América, del norte al sur'],
      ['🛡️','Conservación','Preocupación menor (UICN)']
    ],
    curiosidad: 'Su pico largo y aplanado es una herramienta para abrir conchas y mariscos; por eso también se le llama “ostrero”.'
  },
  'garza-grande': {
    datos: [
      ['📏','Tamaño','80–105 cm; 1,3–1,7 m de envergadura'],
      ['⚖️','Peso','700–1500 g'],
      ['🍽️','Dieta','Peces, anfibios e insectos'],
      ['💧','Hábitat','Humedales, lagunas y orillas'],
      ['🌎','Distribución','Todos los continentes salvo la Antártida'],
      ['🛡️','Conservación','Preocupación menor (UICN)']
    ],
    curiosidad: 'Caza totalmente inmóvil y lanza el cuello como un resorte. En época reproductiva le crecen largas plumas ornamentales en el lomo.'
  },
  'yeco': {
    datos: [
      ['📏','Tamaño','58–73 cm; ~1 m de envergadura'],
      ['⚖️','Peso','1–1,5 kg'],
      ['🍽️','Dieta','Peces (los captura buceando)'],
      ['🌊','Hábitat','Costas, ríos y lagos'],
      ['🌎','Distribución','Del sur de EE.UU. al sur de Sudamérica'],
      ['🛡️','Conservación','Preocupación menor (UICN)']
    ],
    curiosidad: 'Sus plumas no son del todo impermeables: por eso lo ves con las alas abiertas, secándose al sol después de bucear.'
  },
  'quillay': {
    datos: [
      ['📏','Altura','Hasta 15–20 m'],
      ['🌳','Familia','Quillajaceae'],
      ['🏜️','Hábitat','Laderas secas y soleadas'],
      ['🌎','Distribución','Endémico de Chile central'],
      ['🛡️','Conservación','Preocupación menor']
    ],
    curiosidad: 'Su corteza es rica en saponinas: hace espuma como jabón. Hoy se usa en alimentos, cosmética e incluso como componente de vacunas modernas.'
  },
  'litre': {
    datos: [
      ['📏','Altura','2–8 m (arbusto o árbol)'],
      ['🌿','Familia','Anacardiáceas'],
      ['🏜️','Hábitat','Matorral y bosque esclerófilo'],
      ['🌎','Distribución','Endémico de Chile (Coquimbo–Biobío)'],
      ['🛡️','Conservación','Preocupación menor']
    ],
    curiosidad: 'A muchas personas les da alergia con solo tocarlo o dormir bajo su sombra. Es pariente cercano del mango y el pistacho.'
  },
  'peumo': {
    datos: [
      ['📏','Altura','Hasta 10–15 m'],
      ['🌲','Familia','Lauráceas'],
      ['🍃','Hábitat','Quebradas húmedas del matorral chileno'],
      ['🌎','Distribución','Chile central'],
      ['🛡️','Conservación','Preocupación menor']
    ],
    curiosidad: 'Sus frutos rojos son comestibles (se hacía harina de peumo) y sus hojas aromáticas tuvieron muchos usos tradicionales.'
  },
  'doca': {
    datos: [
      ['🌿','Tipo','Planta suculenta rastrera'],
      ['🌱','Familia','Aizoáceas'],
      ['🏖️','Hábitat','Dunas y roqueríos costeros'],
      ['🌎','Distribución','Costas de Sudamérica'],
      ['🛡️','Conservación','Común, no amenazada']
    ],
    curiosidad: 'Sus hojas carnosas guardan agua para resistir la sal y la sequía. Su fruto es comestible, de sabor agridulce.'
  },
  'totora': {
    datos: [
      ['📏','Altura','Hasta 3–4 m'],
      ['🌾','Familia','Typhaceae'],
      ['💧','Hábitat','Humedales y orillas de agua'],
      ['🌎','Distribución','Amplia en zonas templadas y cálidas'],
      ['🛡️','Conservación','Preocupación menor']
    ],
    curiosidad: 'Con sus tallos se tejen esteras y hasta embarcaciones, como los “caballitos de totora”. Además filtra y limpia el agua del humedal.'
  }
};

/* --- Mini-quiz educativo por zona (refuerza cuidado y respeto) --------------- */
window.LA_QUIZ = {
  'isla-pinguinos': {
    pregunta: '¿Cómo se debe observar a los pingüinos de Humboldt?',
    opciones: ['Desde el agua, a distancia y sin desembarcar', 'Subiendo al islote para verlos de cerca', 'Acercándose a los nidos para fotografiar'],
    correcta: 0,
    explicacion: 'Son muy sensibles a la presencia humana: se observan desde el agua o el mirador, sin desembarcar ni acercarse a los nidos.'
  },
  'mirador-canelo': {
    pregunta: '¿Qué ave sueles ver pescar lanzándose en picada frente al mirador?',
    opciones: ['El pelícano', 'El pingüino', 'La garza grande'],
    correcta: 0,
    explicacion: 'El pelícano vuela rasante sobre el mar y se zambulle desde el aire para pescar anchoveta.'
  },
  'punta-penablanca': {
    pregunta: '¿Cuándo es más fácil avistar al chungungo?',
    opciones: ['Con marea baja y mar calmo', 'Al mediodía con marea alta', 'Solamente de noche'],
    correcta: 0,
    explicacion: 'El chungungo asoma entre las rocas sobre todo con marea baja y mar calmo, y al amanecer.'
  },
  'quebrada-rosas': {
    pregunta: '¿Por qué conviene no tocar el litre?',
    opciones: ['Puede provocar alergia en la piel', 'Es una planta en extinción', 'Sus flores son venenosas'],
    correcta: 0,
    explicacion: 'El litre produce alergia (ronchas) a muchas personas con solo tocarlo o estar bajo su sombra.'
  },
  'humedal-tunquen': {
    pregunta: '¿Cuál es la mejor forma de cuidar el humedal?',
    opciones: ['Quedarte en el sendero y guardar silencio', 'Entrar al agua para ver mejor las aves', 'Llevarte totoras de recuerdo'],
    correcta: 0,
    explicacion: 'Es de conservación estricta: quédate en el sendero, guarda silencio y no ingreses al agua ni extraigas plantas.'
  }
};

/* --- Insignias / logros ----------------------------------------------------- */
window.LA_LOGROS = [
  { id:'comprometido',        icono:'🤝', titulo:'Comprometido',      desc:'Completaste la charla del guía.' },
  { id:'primer-avistamiento', icono:'🐾', titulo:'Primer avistamiento', desc:'Registraste tu primera especie.' },
  { id:'observador',          icono:'🔭', titulo:'Observador',        desc:'Avistaste 5 especies.' },
  { id:'as-aves',             icono:'🦅', titulo:'As de las aves',     desc:'Avistaste todas las aves.' },
  { id:'jardin-nativo',       icono:'🌿', titulo:'Jardín nativo',      desc:'Avistaste toda la flora.' },
  { id:'explorador',          icono:'🧭', titulo:'Explorador',        desc:'Visitaste las 5 zonas.' },
  { id:'sabio',               icono:'🧠', titulo:'Sabio del litoral',  desc:'Respondiste bien todos los quiz.' },
  { id:'naturalista',         icono:'📕', titulo:'Naturalista',       desc:'Completaste la Pokédex.' }
];

/* --- Guía de especies locales --------------------------------------------- */
window.LA_SPECIES = [
  {
    id: 'pinguino-humboldt',
    nombre: 'Pingüino de Humboldt',
    cientifico: 'Spheniscus humboldti',
    grupo: 'Aves marinas',
    emoji: '🐧',
    estado: 'Vulnerable',
    donde: ['isla-pinguinos', 'mirador-canelo'],
    ficha: 'Pingüino de tamaño medio (~70 cm) con banda negra en el pecho. Anida en cuevas y grietas de islotes. Muy sensible a la presencia humana: observar siempre desde el agua, sin desembarcar ni acercarse a los nidos.',
    sonido: 'Rebuzno áspero, parecido a un burro, de ahí el nombre "pájaro niño".',
    mejor_epoca: 'Todo el año; reproducción marzo–abril y septiembre–octubre.'
  },
  {
    id: 'chungungo',
    nombre: 'Chungungo (nutria de mar)',
    cientifico: 'Lontra felina',
    grupo: 'Mamíferos marinos',
    emoji: '🦦',
    estado: 'En peligro',
    donde: ['punta-penablanca', 'quebrada-rosas'],
    ficha: 'Pequeña nutria marina que vive en roqueríos costeros. Se alimenta de crustáceos, moluscos y peces. Difícil de ver: busca cabezas asomando entre el oleaje al amanecer o con marea baja.',
    sonido: 'Silbidos y chillidos cortos.',
    mejor_epoca: 'Todo el año, mejor con marea baja y mar calmo.'
  },
  {
    id: 'pelicano',
    nombre: 'Pelícano',
    cientifico: 'Pelecanus thagus',
    grupo: 'Aves marinas',
    emoji: '🦩',
    estado: 'Casi amenazada',
    donde: ['mirador-canelo', 'punta-penablanca'],
    ficha: 'Ave grande de pico enorme con bolsa gular. Vuela en formación rasante sobre el agua y se zambulle para pescar. Común en caletas y roqueríos.',
    sonido: 'Generalmente silencioso; gruñidos en las colonias.',
    mejor_epoca: 'Todo el año.'
  },
  {
    id: 'pilpilen',
    nombre: 'Pilpilén',
    cientifico: 'Haematopus palliatus',
    grupo: 'Aves playeras',
    emoji: '🐦',
    estado: 'Preocupación menor',
    donde: ['humedal-tunquen', 'punta-penablanca'],
    ficha: 'Ave playera negra y blanca con pico y patas rojo-anaranjados. Camina por la orilla buscando moluscos. Nidifica en la arena, por eso hay que evitar pisar zonas de dunas.',
    sonido: 'Silbido agudo y repetido "pil-pil-pil".',
    mejor_epoca: 'Todo el año.'
  },
  {
    id: 'garza-grande',
    nombre: 'Garza grande',
    cientifico: 'Ardea alba',
    grupo: 'Aves de humedal',
    emoji: '🕊️',
    estado: 'Preocupación menor',
    donde: ['humedal-tunquen'],
    ficha: 'Garza blanca de cuello largo. Caza peces y anfibios en aguas someras del humedal, inmóvil hasta lanzar el pico como una flecha.',
    sonido: 'Graznido ronco al alzar el vuelo.',
    mejor_epoca: 'Todo el año en el humedal.'
  },
  {
    id: 'yeco',
    nombre: 'Yeco (cormorán)',
    cientifico: 'Phalacrocorax brasilianus',
    grupo: 'Aves marinas',
    emoji: '🐤',
    estado: 'Preocupación menor',
    donde: ['isla-pinguinos', 'punta-penablanca'],
    ficha: 'Ave negra que bucea para pescar y luego seca sus alas extendidas sobre las rocas. Forma colonias ruidosas en islotes.',
    sonido: 'Gruñidos guturales en la colonia.',
    mejor_epoca: 'Todo el año.'
  },

  /* --- Flora nativa --- */
  {
    id: 'quillay', nombre: 'Quillay', cientifico: 'Quillaja saponaria',
    grupo: 'Flora nativa', emoji: '🌳', estado: 'Preocupación menor',
    donde: ['quebrada-rosas'], reino: 'flora',
    ficha: 'Árbol siempreverde emblemático del bosque esclerófilo chileno. Su corteza contiene saponinas (hace espuma) y por eso se usó como jabón natural. Muy resistente a la sequía.',
    mejor_epoca: 'Floración en primavera y verano.'
  },
  {
    id: 'litre', nombre: 'Litre', cientifico: 'Lithraea caustica',
    grupo: 'Flora nativa', emoji: '🍃', estado: 'Preocupación menor',
    donde: ['quebrada-rosas'], reino: 'flora',
    ficha: '¡Cuidado! A muchas personas les provoca alergia (ronchas) con solo tocarlo o estar bajo su sombra. Arbusto o árbol del matorral esclerófilo, de hojas coriáceas y ovaladas.',
    mejor_epoca: 'Verde todo el año.'
  },
  {
    id: 'peumo', nombre: 'Peumo', cientifico: 'Cryptocarya alba',
    grupo: 'Flora nativa', emoji: '🌲', estado: 'Preocupación menor',
    donde: ['quebrada-rosas'], reino: 'flora',
    ficha: 'Árbol nativo de hoja perenne y aroma característico. Da frutos rojos comestibles en otoño, alimento de aves y zorros. Indica suelos con buena humedad dentro del bosque esclerófilo.',
    mejor_epoca: 'Frutos rojos en otoño.'
  },
  {
    id: 'doca', nombre: 'Doca', cientifico: 'Carpobrotus aequilaterus',
    grupo: 'Flora nativa', emoji: '🌸', estado: 'Preocupación menor',
    donde: ['punta-penablanca', 'humedal-tunquen'], reino: 'flora',
    ficha: 'Planta rastrera de dunas y roqueríos costeros, con hojas carnosas y flores moradas o rosadas. Fija la arena y protege la duna; sus frutos son comestibles.',
    mejor_epoca: 'Floración en primavera.'
  },
  {
    id: 'totora', nombre: 'Totora y juncos', cientifico: 'Typha / Schoenoplectus',
    grupo: 'Flora de humedal', emoji: '🌾', estado: 'Preocupación menor',
    donde: ['humedal-tunquen'], reino: 'flora',
    ficha: 'Plantas acuáticas que forman los totorales del humedal. Son refugio y sitio de nidificación de aves, y filtran naturalmente el agua. Clave para la salud del ecosistema.',
    mejor_epoca: 'Presentes todo el año.'
  }
];

/* --- Frases de aliento del guía virtual ------------------------------------ */
/* Neutras (sin marcar género). El guía las dice por voz mientras avanzas,     */
/* solo para incentivar. Variedad de tonos: 'energia', 'zen', 'chileno',       */
/* 'costa', 'logro'. El motor rota tonos y no repite frases recientes.          */
window.LA_ALIENTO = [
  /* Energético */
  { tono: 'energia', frase: '¡Vamos con todo! Cada paso suma.' },
  { tono: 'energia', frase: '¡Ánimo! Que el envión no se detenga.' },
  { tono: 'energia', frase: 'Fuerza en las piernas y una sonrisa: así se avanza.' },
  { tono: 'energia', frase: '¡Eso! Sigue con esa energía.' },
  { tono: 'energia', frase: 'Un poco más y lo logras. ¡Dale!' },
  { tono: 'energia', frase: '¡Qué ritmo! No aflojes ahora.' },
  { tono: 'energia', frase: 'Energía al máximo: la costa te espera.' },
  /* Zen / reflexivo */
  { tono: 'zen', frase: 'Respira hondo. Estás justo donde debes estar.' },
  { tono: 'zen', frase: 'Suelta la prisa y disfruta el instante.' },
  { tono: 'zen', frase: 'Cada paso, una respiración. Presente y en calma.' },
  { tono: 'zen', frase: 'Escucha el mar y deja que te marque el ritmo.' },
  { tono: 'zen', frase: 'No hay apuro: el camino también es el destino.' },
  { tono: 'zen', frase: 'Siente la brisa, agradece el momento y sigue.' },
  { tono: 'zen', frase: 'Calma y constancia: así fluye todo.' },
  /* Chileno cercano */
  { tono: 'chileno', frase: '¡Vas bacán! Sigue así no más.' },
  { tono: 'chileno', frase: 'De a poquito se llega lejos. ¡Tú puedes!' },
  { tono: 'chileno', frase: '¡Qué buena onda tu ritmo! Dale que vas bien.' },
  { tono: 'chileno', frase: 'Tranqui, sin apuro, que lo estás haciendo increíble.' },
  { tono: 'chileno', frase: 'Un pasito más y ya po, ¡sigamos!' },
  { tono: 'chileno', frase: 'Puro avance y buena onda. ¡Así se hace!' },
  { tono: 'chileno', frase: 'Se agradece tu energía. Vamos con calma no más.' },
  /* Costa / naturaleza */
  { tono: 'costa', frase: 'El mar te acompaña en cada paso. Sigue.' },
  { tono: 'costa', frase: 'Huele a mar y a aventura. ¡Continúa!' },
  { tono: 'costa', frase: 'Las aves ya te vieron pasar. ¡Vas muy bien!' },
  { tono: 'costa', frase: 'Cada roca y cada ola tienen algo que contarte.' },
  { tono: 'costa', frase: 'La costa premia a quien la recorre con respeto.' },
  { tono: 'costa', frase: 'Brisa, sal y horizonte: tu mejor compañía.' },
  { tono: 'costa', frase: 'El Pacífico te recibe a tu propio ritmo.' },
  /* Logro / progreso */
  { tono: 'logro', frase: 'Mira lo lejos que has llegado. ¡Increíble!' },
  { tono: 'logro', frase: 'Cada metro recorrido ya es una victoria.' },
  { tono: 'logro', frase: 'Lo que llevas avanzado no es poco. ¡Sigue sumando!' },
  { tono: 'logro', frase: 'Vas dejando huella, paso a paso.' },
  { tono: 'logro', frase: 'Ese avance se nota. ¡Puro orgullo!' },
  { tono: 'logro', frase: 'Ya recorriste un buen tramo. ¡Y falta lo mejor!' },
  { tono: 'logro', frase: 'Constancia pura: así se conquistan las rutas.' }
];

/* --- Mareas (DEMO) -------------------------------------------------------- */
/* ⚠️ Datos de ejemplo. En producción, cargar tabla oficial del SHOA para     */
/*    Algarrobo/San Antonio y cachear para uso offline.                       */
window.LA_TIDES_DEMO = [
  { hora: '05:12', tipo: 'baja', altura: '0.3 m' },
  { hora: '11:28', tipo: 'alta', altura: '1.5 m' },
  { hora: '17:40', tipo: 'baja', altura: '0.2 m' },
  { hora: '23:55', tipo: 'alta', altura: '1.6 m' }
];

/* --- Travesías / Experiencias (Litoral Adventure) ------------------------- */
/* Datos oficiales (ficha SERNATUR vigente). Solo faltan precios reales.      */
window.LA_CONTACT = {
  whatsapp: '56971047330',                    // +56 9 7104 7330
  telefono: '+56 9 7104 7330',
  email: 'contacto@litoraladventure.cl',
  direccion: 'Los Pinares Nº247, Algarrobo, Región de Valparaíso',
  sernatur: true,                             // registro turístico vigente
  instagram: 'https://instagram.com/litoral.adventure',
  tiktok: 'https://tiktok.com/@litoral.adventure',
  web: 'https://litoraladventure.cl'
};

window.LA_EXPERIENCES = [
  {
    id: 'sup-pinguinos',
    nombre: 'Travesía educativa en SUP a la Isla de los Pingüinos',
    emoji: '🐧',
    duracion: '2 – 2.5 h',
    nivel: 'Principiante bienvenido',
    incluye: ['Tabla SUP + remo', 'Chaleco salvavidas', 'Guía local', 'Briefing de seguridad', 'Educación ambiental'],
    descripcion: 'Nuestra experiencia estrella. Remamos hasta la colonia de pingüinos de Humboldt observando de forma responsable, sin desembarcar ni intervenir. Aprendemos sobre la fauna marina, la historia del lugar y por qué protegerlo.',
    destacada: true
  },
  {
    id: 'sup-costa',
    nombre: 'Clase de SUP en la bahía',
    emoji: '🏄',
    duracion: '1.5 h',
    nivel: 'Todos los niveles',
    incluye: ['Equipo completo', 'Instrucción básica', 'Guía local'],
    descripcion: 'Primer contacto con el stand-up paddle en aguas protegidas de la bahía de Algarrobo. Ideal para partir.',
    destacada: false
  },
  {
    id: 'observacion-costera',
    nombre: 'Salida de observación costera',
    emoji: '🔭',
    duracion: '2 h',
    nivel: 'Familias',
    incluye: ['Guía naturalista', 'Cuaderno de campo', 'Recorrido a pie'],
    descripcion: 'Recorrido guiado por miradores y roqueríos para conocer aves marinas, chungungos y el ecosistema costero.',
    destacada: false
  }
];
