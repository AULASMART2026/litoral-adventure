# Litoral Adventure · Guía Eco de Algarrobo

App web **offline-first** (PWA) para Litoral Adventure. Complementa las travesías
educativas en SUP a la Isla de los Pingüinos con un mapa navegable, guía de
especies, cuaderno de campo y reservas por WhatsApp.

## Cómo probarla

Es 100% estática, sin build ni dependencias. Cualquier servidor estático sirve:

```bash
# opción 1
python -m http.server 5500
# opción 2
npx serve .
```

Luego abre `http://localhost:5500`. El GPS y la instalación como app (PWA)
requieren `https://` o `localhost` (no funciona abriendo el archivo con file://).

## ✅ Datos reales ya integrados (ficha SERNATUR vigente)

- **WhatsApp / teléfono:** +56 9 7104 7330
- **Email:** contacto@litoraladventure.cl
- **Dirección:** Los Pinares Nº247, Algarrobo, Región de Valparaíso
- **Redes:** @litoral.adventure (Instagram y TikTok) · litoraladventure.cl

## 🎨 Lo único que falta para dejarla 100% de marca

1. **Logo** → reemplaza `assets/logo.svg` por tu logo real
   (mismo nombre; o usa `logo.png` y cambia la referencia en `index.html`).
   Hoy hay un wordmark placeholder marino con pingüino.
2. **Colores de marca** → edita el bloque `:root` al inicio de `styles.css`
   (`--la-deep`, `--la-teal`, `--la-green`, etc.).
3. **Precios** → agrégalos en `LA_EXPERIENCES` (`data/content.js`).

## ✅ Qué ya funciona

- **📕 Pokédex de especies**: grid con **fotos reales** (Wikimedia Commons, con
  crédito y licencia) estilo Pokédex. Las que aún no ves salen en **silueta**;
  botón **Lo vi / No lo vi** por especie y barra de "registradas". Fotos incluidas
  en la app para uso offline (`assets/species/`).
- **🎧 En Ruta (guía virtual)**: al transitar (a pie o en bici), el GPS detecta la
  zona y **narra por voz** (text-to-speech) su flora y fauna. Botón "¡Lo vi!" que
  arma tu colección con barra de progreso. Incluye **modo prueba** para simular
  llegar a una zona sin estar en Algarrobo.
- **Inicio**: bienvenida, stats, accesos rápidos, mareas del día.
- **Mapa**: mapa esquemático de la costa con los 5 puntos y las 3 rutas.
  GPS real: calcula tu distancia al punto más cercano (haversine) y dispara
  **alertas de geocerca** al entrar a zonas protegidas (con vibración).
- **Especies**: guía filtrable con fichas (descripción, sonido, época, dónde verla).
- **Cuaderno de campo**: registra avistamientos (se guardan en el dispositivo,
  offline) y expórtalos a JSON.
- **Travesías**: experiencias con reserva directa por WhatsApp.
- **Offline**: service worker cachea todo; funciona sin señal tras la 1ª carga.

## ⚠️ Datos a verificar antes de publicar

- **Coordenadas y estado de protección** de cada punto (`data/content.js`):
  contrastar con fuentes oficiales (Ministerio del Medio Ambiente / Santuarios
  de la Naturaleza / sitios Ramsar).
- **Mareas**: hoy son datos DEMO. En producción, cargar la tabla oficial del
  **SHOA** para Algarrobo y cachearla para uso offline.

## 🔭 Roadmap v2 (ideas diferenciadoras)

- Mapa topográfico real con tiles cacheados (Leaflet + OSM/MapTiler offline).
- **Realidad aumentada geocercada**: modelos 3D (pingüino, chungungo) que se
  desbloquean solo al llegar físicamente al punto.
- Identificación por foto/sonido (apoyada en modelos existentes tipo iNaturalist/BirdNET).
- Sincronización de avistamientos a iNaturalist/GBIF (ciencia ciudadana).
- Cruce mareas + fauna: "marea baja 14:20 → momento para ver chungungos".

---
Hecho para Litoral Adventure · *Aventura, educación y mar* 🐧🌊
