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
    lat: -33.3865, lng: -71.6720,
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
    lat: -33.4083, lng: -71.7042,
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
    lat: -33.3819, lng: -71.6806,
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
    estado: 'Preocupación menor',
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
    id: 'litre', nombre: 'Litre', cientifico: 'Litrea caustica',
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
/* solo para incentivar. Estilo cercano y motivador.                           */
window.LA_ALIENTO = [
  '¡Vas muy bien! Cada paso te acerca a algo nuevo.',
  'Respira hondo el aire del mar y sigue a tu ritmo.',
  'Paso a paso se recorre la costa. ¡Tú puedes!',
  'Lo estás haciendo genial. Disfruta el camino.',
  'El mejor ritmo es el tuyo. Sigue avanzando.',
  'Cada metro cuenta. ¡Ánimo, que vas increíble!',
  'Mira lo lejos que has llegado. ¡Sigue así!',
  'La naturaleza te acompaña. Continúa con energía.',
  'Un pie delante del otro y la aventura se despliega.',
  '¡Qué bien lo haces! Hoy el litoral es tuyo.',
  'Tómate tu tiempo: esto no es una carrera, es una experiencia.',
  'Fuerza y calma: esa mezcla te lleva lejos.',
  'El horizonte te espera. Sigue avanzando.',
  'Cada zona trae una sorpresa. ¡Vamos por la siguiente!',
  'Estás conectando con el mar y con tu propio ritmo. Sigue.',
  '¡Ánimo! Lo mejor del camino es recorrerlo.',
  'Tu energía se nota. Continúa disfrutando.',
  'Escucha el mar, siente la brisa y sigue adelante.',
  'Vas por buen camino, de verdad. ¡No te detengas!',
  'Que nada te frene: la costa tiene mucho por mostrarte.'
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
