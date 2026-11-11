import * as THREE from 'three';
// Importamos el renderizador 2D para HTML overlays
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import csvDataPath from './assets/data/climaData.csv';
import textureImg from './assets/relief/gc-texture.png';
import heightmapImg from './assets/relief/gc-heightmap.png';
import linesImg from './assets/relief/lines.png';

import iconSun from './assets/icons/sun.png';
import iconCloud from './assets/icons/cloud.png';
import iconPartlyCloudy from './assets/icons/partly_cloudy.png';
import iconRain from './assets/icons/rain.png';
import iconThunder from './assets/icons/cloud_thunder.png';
import iconWind from './assets/icons/wind_arrow.png';

const textureLoader = new THREE.TextureLoader();
const weatherTextures = {};
export const weatherTexturesReady = Promise.all([
  iconSun,
  iconCloud,
  iconPartlyCloudy,
  iconRain,
  iconThunder,
  iconWind
].map(source => new Promise((resolve, reject) => {
  textureLoader.load(source, resolve, undefined, reject);
}))).then(([sun, cloud, partlyCloudy, rain, thunder, wind]) => {
  Object.assign(weatherTextures, { sun, cloud, partlyCloudy, rain, thunder, wind });
});

function getWeatherTexture(code) {
  if (code === 0) return weatherTextures.sun;
  if (code >= 1 && code <= 3) return weatherTextures.partlyCloudy;
  if (code >= 45 && code <= 48) return weatherTextures.cloud;
  if (code >= 51 && code <= 82) return weatherTextures.rain;
  if (code >= 95) return weatherTextures.thunder;
  return weatherTextures.sun;
}

let parsedData = [];
const activeSprites = [];
const activeLabels = [];
let labelRenderer;
const boundariesGroup = new THREE.Group();
const geographicBounds = {
  minLon: -15.86,
  maxLon: -15.32,
  minLat: 27.70,
  maxLat: 28.21
};
export const TERRAIN_TEXTURE_WIDTH = 1186;
export const TERRAIN_TEXTURE_HEIGHT = 730;
export const TERRAIN_WIDTH = 180;
export const TERRAIN_HEIGHT = TERRAIN_WIDTH * TERRAIN_TEXTURE_HEIGHT / TERRAIN_TEXTURE_WIDTH;
export const TERRAIN_TEXTURE_REPEAT = 0.6;
export const TERRAIN_TEXTURE_OFFSET = (1 - TERRAIN_TEXTURE_REPEAT) / 2;
const TERRAIN_ZOOM_X = 0.74;
const TERRAIN_ZOOM_Z = 0.81;
const TERRAIN_OFFSET_X = -13;
const TERRAIN_OFFSET_Z = -5;
export const terrainCenter = new THREE.Vector3(TERRAIN_OFFSET_X, 0, TERRAIN_OFFSET_Z);
let linesTexture;
let lastSpriteUpdate = '';

export const municipiosCoords = [
  { municipio: "Agaete", lat: 28.1001, lon: -15.7011 },
  { municipio: "Agüimes", lat: 27.9050, lon: -15.4460 },
  { municipio: "Artenara", lat: 28.0200, lon: -15.6470 },
  { municipio: "Arucas", lat: 28.1189, lon: -15.5230 },
  { municipio: "Firgas", lat: 28.1080, lon: -15.5630 },
  { municipio: "Gáldar", lat: 28.1470, lon: -15.6542 },
  { municipio: "Ingenio", lat: 27.9180, lon: -15.4350 },
  { municipio: "La Aldea de San Nicolás", lat: 27.9840, lon: -15.7810 },
  { municipio: "Las Palmas de Gran Canaria", lat: 28.1235, lon: -15.4363 },
  { municipio: "Mogán", lat: 27.8838, lon: -15.7252 },
  { municipio: "Moya", lat: 28.1110, lon: -15.5820 },
  { municipio: "San Bartolomé de Tirajana", lat: 27.9240, lon: -15.5730 },
  { municipio: "Santa Brígida", lat: 28.0330, lon: -15.4930 },
  { municipio: "Santa Lucía de Tirajana", lat: 27.9110, lon: -15.5410 },
  { municipio: "Santa María de Guía", lat: 28.1400, lon: -15.6330 },
  { municipio: "Tejeda", lat: 27.9958, lon: -15.6161 },
  { municipio: "Telde", lat: 27.9961, lon: -15.4162 },
  { municipio: "Teror", lat: 28.0592, lon: -15.5476 },
  { municipio: "Valleseco", lat: 28.0520, lon: -15.5750 },
  { municipio: "Valsequillo", lat: 27.9860, lon: -15.4970 },
  { municipio: "Vega de San Mateo", lat: 28.0080, lon: -15.5330 }
];

export function latLonToVector3(lat, lon) {
  const pctX = (lon - geographicBounds.minLon) / (geographicBounds.maxLon - geographicBounds.minLon);
  const pctZ = (geographicBounds.maxLat - lat) / (geographicBounds.maxLat - geographicBounds.minLat);
  const x = (pctX - 0.5) * TERRAIN_WIDTH * TERRAIN_ZOOM_X + TERRAIN_OFFSET_X;
  const z = (pctZ - 0.5) * TERRAIN_HEIGHT * TERRAIN_ZOOM_Z + TERRAIN_OFFSET_Z;

  return new THREE.Vector3(x, 0, z);
}

export function getTerrainPosition(terrain, lat, lon, offset = 0) {
  const position = latLonToVector3(lat, lon);
  position.y = getTerrainSurfaceHeight(terrain, position.x, position.z) + offset;
  return position;
}

export function getTerrainSurfaceHeight(terrain, worldX, worldZ) {
  const geometry = terrain.geometry;
  const { width, height, widthSegments, heightSegments } = geometry.parameters;
  const gridX = THREE.MathUtils.clamp(
    ((worldX - terrain.position.x + width / 2) / width) * widthSegments,
    0,
    widthSegments
  );
  const gridY = THREE.MathUtils.clamp(
    ((worldZ - terrain.position.z + height / 2) / height) * heightSegments,
    0,
    heightSegments
  );
  const cellX = Math.min(Math.floor(gridX), widthSegments - 1);
  const cellY = Math.min(Math.floor(gridY), heightSegments - 1);
  const x = gridX - cellX;
  const y = gridY - cellY;
  const rowLength = widthSegments + 1;
  const a = cellX + rowLength * cellY;
  const b = cellX + rowLength * (cellY + 1);
  const c = cellX + 1 + rowLength * (cellY + 1);
  const d = cellX + 1 + rowLength * cellY;
  const positions = geometry.attributes.position;
  const heightA = positions.getZ(a);
  const heightB = positions.getZ(b);
  const heightC = positions.getZ(c);
  const heightD = positions.getZ(d);
  const localHeight = x + y <= 1
    ? heightA * (1 - x - y) + heightB * y + heightD * x
    : heightB * (1 - x) + heightC * (x + y - 1) + heightD * (1 - y);

  return terrain.position.y + localHeight;
}

export function updateMunicipioLabelVisibility(camera, terrain) {
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
  activeLabels.forEach(label => {
    const labelPosition = label.getWorldPosition(new THREE.Vector3());
    const distance = cameraPosition.distanceTo(labelPosition);
    const steps = Math.min(64, Math.max(12, Math.ceil(distance / 2)));
    let isOccluded = false;
    for (let step = 1; step < steps; step++) {
      const progress = step / steps;
      const x = THREE.MathUtils.lerp(cameraPosition.x, labelPosition.x, progress);
      const y = THREE.MathUtils.lerp(cameraPosition.y, labelPosition.y, progress);
      const z = THREE.MathUtils.lerp(cameraPosition.z, labelPosition.z, progress);
      if (y < getTerrainSurfaceHeight(terrain, x, z) - 0.25) {
        isOccluded = true;
        break;
      }
    }
    label.element.style.visibility = isOccluded ? 'hidden' : 'visible';
  });
}

export function createAlignedHeightmapCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const sourceAspect = source.naturalWidth / source.naturalHeight;
  const targetAspect = width / height;
  let sx = 0;
  let sy = 0;
  let sw = source.naturalWidth;
  let sh = source.naturalHeight;
  if (sourceAspect > targetAspect) {
    sw = source.naturalHeight * targetAspect;
    sx = (source.naturalWidth - sw) / 2;
  } else {
    sh = source.naturalWidth / targetAspect;
    sy = (source.naturalHeight - sh) / 2;
  }
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
  // The source heightmap includes Tenerife in the upper-left; this map only covers Gran Canaria.
  context.clearRect(0, 0, width * 0.12, height * 0.30);
  return canvas;
}

// Inicializar el Renderizador de Etiquetas HTML (CSS2D)
export function initLabelRenderer(container) {
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);
  return labelRenderer;
}

// Crear los carteles flotantes con los nombres de los municipios
export function setupMunicipiosLabels(scene, terrain) {
  municipiosCoords.forEach(m => {
    const div = document.createElement('div');
    div.className = 'map-label';
    div.textContent = m.municipio;

    const labelObj = new CSS2DObject(div);
    labelObj.position.copy(getTerrainPosition(terrain, m.lat, m.lon, 1.5));
    scene.add(labelObj);
    activeLabels.push(labelObj);
  });
}

// api.js
export function setupTerritoryLines(scene, terrain) {
  if (!linesTexture) return;

  const geometry = terrain.geometry.clone();
  const positions = geometry.attributes.position;

  // 🔹 1. ALTURA (Flotación sobre las montañas)
  const ALTURA_FLOTACION = 1.8; // Ajusta este valor (0.3, 0.8, 1.2...) para subir/bajar
  for (let i = 0; i < positions.count; i++) {
    positions.setZ(i, positions.getZ(i) + ALTURA_FLOTACION);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const overlay = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: linesTexture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  }));

  overlay.rotation.copy(terrain.rotation);
  overlay.position.copy(terrain.position);

  // 🔹 2. POSICIÓN (Mover Izquierda/Derecha y Norte/Sur)
  overlay.position.x += 1.5; // ➕ Mueve a la DERECHA | ➖ Mueve a la IZQUIERDA
  overlay.position.z += 1.5; // ➕ Mueve al SUR (Abajo) | ➖ Mueve al NORTE (Arriba)

  // 🔹 3. ANCHO Y LARGO (Escalar la malla de las líneas)
  const ESCALA_ANCHO = 0.95; // 1.05 = 5% más ancho (Este-Oeste)
  const ESCALA_LARGO = 1.05; // 1.05 = 5% más largo (Norte-Sur)
  overlay.scale.set(ESCALA_ANCHO, ESCALA_LARGO, 1.0);

  overlay.renderOrder = -1; // Mantiene las líneas por detrás de los iconos
  boundariesGroup.add(overlay);
  scene.add(boundariesGroup);
}

// Alternar visibilidad de Etiquetas y Líneas
// api.js
export function toggleMunicipioLabels(visible) {
  activeLabels.forEach(l => {
    if (l.element) {
      l.element.style.display = visible ? 'block' : 'none';
    }
  });
}

export function toggleMunicipioLines(visible) {
  boundariesGroup.visible = visible;
}

export function toggleLabelsAndLines(visible) {
  toggleMunicipioLabels(visible);
  toggleMunicipioLines(visible);
}

export async function loadWeatherData() {
  try {
    const response = await fetch(csvDataPath);
    if (!response.ok) {
      throw new Error(`No se pudo cargar climaData.csv (${response.status}).`);
    }
    const text = await response.text();
    const lines = text.trim().split('\n');

    parsedData = lines.slice(1).map(line => {
      const values = line.split(',');
      if (values.length < 6) return null;
      const municipio = values[0].replace(/"/g, '');
      return {
        municipio: municipio === 'Las Palmas' ? 'Las Palmas de Gran Canaria' :
          municipio === 'Maspalomas' ? 'San Bartolomé de Tirajana' : municipio,
        lat: parseFloat(values[1]),
        lon: parseFloat(values[2]),
        hora: parseInt(values[3], 10),
        temp: parseFloat(values[4]),
        codigo_clima: parseInt(values[5], 10),
        viento_vel: parseFloat(values[6] || 0),
        viento_dir: parseFloat(values[7] || 0)
      };
    }).filter(Boolean);
    lastRenderedThermalHour = null;
    lastSpriteUpdate = '';
  } catch (error) {
    console.error("Error al cargar climaData.csv:", error);
    throw error;
  }
}

export async function fetchLiveWeatherData() {
  const previousData = parsedData;
  parsedData = [];
  lastRenderedThermalHour = null;
  lastSpriteUpdate = '';
  const currentHour = new Date().getHours();
  const results = await Promise.all(municipiosCoords.map(async m => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&current_weather=true`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo respondió ${res.status}`);
      }
      const data = await res.json();
      
      return {
        municipio: m.municipio,
        lat: m.lat,
        lon: m.lon,
        hora: currentHour,
        temp: data.current_weather.temperature,
        codigo_clima: data.current_weather.weathercode,
        viento_vel: data.current_weather.windspeed,
        viento_dir: data.current_weather.winddirection
      };
    } catch (e) {
      console.error(`Error API para ${m.municipio}:`, e);
      return null;
    }
  }));
  parsedData = results.filter(Boolean);
  if (parsedData.length === 0) {
    parsedData = previousData;
    throw new Error('No se pudieron obtener datos meteorológicos LIVE.');
  }
}
function getMunicipalityWeather(municipio, currentHourData) {
  const exactMatch = currentHourData.find(item => item.municipio === municipio.municipio);
  if (exactMatch) return exactMatch;
  if (currentHourData.length === 0) return null;

  const nearby = currentHourData.map(item => {
    const latitudeDistance = item.lat - municipio.lat;
    const longitudeDistance = (item.lon - municipio.lon) * Math.cos(municipio.lat * Math.PI / 180);
    return {
      item,
      distanceSquared: latitudeDistance ** 2 + longitudeDistance ** 2
    };
  }).sort((a, b) => a.distanceSquared - b.distanceSquared).slice(0, 3);

  const weightedValue = key => {
    let totalWeight = 0;
    let totalValue = 0;
    nearby.forEach(({ item, distanceSquared }) => {
      const weight = 1 / Math.max(distanceSquared, 0.000001);
      totalWeight += weight;
      totalValue += item[key] * weight;
    });
    return totalValue / totalWeight;
  };

  return {
    municipio: municipio.municipio,
    lat: municipio.lat,
    lon: municipio.lon,
    temp: weightedValue('temp'),
    viento_vel: weightedValue('viento_vel'),
    viento_dir: nearby[0].item.viento_dir,
    codigo_clima: nearby[0].item.codigo_clima
  };
}

export function updateSpritesForHour(scene, terrain, hourDecimal, layer = 'weather', visible = true) {
  const baseHour = Math.floor(hourDecimal);
  const updateKey = `${baseHour}-${layer}-${visible}`;
  if (updateKey === lastSpriteUpdate) return;
  lastSpriteUpdate = updateKey;
  const currentHourData = parsedData.filter(d => d.hora === baseHour);

  municipiosCoords.forEach(municipio => {
    const item = getMunicipalityWeather(municipio, currentHourData);
    let entry = activeSprites.find(spriteEntry => spriteEntry.municipio === municipio.municipio);
    if (!entry && item) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        transparent: true,
        depthTest: true,
        depthWrite: false
      }));
      sprite.position.copy(getTerrainPosition(terrain, municipio.lat, municipio.lon, 3));
      scene.add(sprite);
      entry = { sprite, municipio: municipio.municipio };
      activeSprites.push(entry);
    }
    if (!entry) return;
    if (!item) {
      entry.sprite.visible = false;
      return;
    }
    const map = layer === 'wind'
      ? weatherTextures.wind
      : getWeatherTexture(item.codigo_clima);
    if (!entry.sprite.material.map) {
      entry.sprite.material.needsUpdate = true;
    }
    entry.sprite.material.map = map;
    entry.sprite.material.rotation = layer === 'wind'
      ? THREE.MathUtils.degToRad(270 - (item.viento_dir || 0))
      : 0;
    const windSize = 3 + Math.min(Math.max(item.viento_vel || 0, 0), 30) / 10;
    const spriteSize = layer === 'wind' ? windSize : 5;
    entry.sprite.scale.set(spriteSize, spriteSize, 1);
    entry.sprite.visible = visible;
  });

  updateHeatmapTexture(hourDecimal);
}

const thermalCanvas = document.createElement('canvas');
let thermalCtx = thermalCanvas.getContext('2d');
const heatCanvas = document.createElement('canvas');
let heatContext = heatCanvas.getContext('2d');
export const thermalTexture = new THREE.CanvasTexture(thermalCanvas);
thermalTexture.repeat.set(TERRAIN_TEXTURE_REPEAT, TERRAIN_TEXTURE_REPEAT);
thermalTexture.offset.set(TERRAIN_TEXTURE_OFFSET, TERRAIN_TEXTURE_OFFSET);
thermalTexture.magFilter = THREE.LinearFilter;
thermalTexture.minFilter = THREE.LinearMipmapLinearFilter;
thermalTexture.generateMipmaps = true;
let satelliteImage;
let islandMaskCanvas;
let lastThermalHour = 12;
let lastRenderedThermalHour = null;
let thermalInitialized = false;

function loadImage(source, description) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${description}`));
    image.src = source;
  });
}

export const municipalityLinesReady = loadImage(linesImg, 'los límites municipales')
  .then(image => {
    const detectionCanvas = document.createElement('canvas');
    detectionCanvas.width = 960;
    detectionCanvas.height = 960;
    const detectionContext = detectionCanvas.getContext('2d');
    detectionContext.drawImage(image, 0, 0, detectionCanvas.width, detectionCanvas.height);
    const detectionPixels = detectionContext.getImageData(
      0, 0, detectionCanvas.width, detectionCanvas.height
    ).data;
    let minX = detectionCanvas.width;
    let minY = detectionCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < detectionCanvas.height; y++) {
      for (let x = 0; x < detectionCanvas.width; x++) {
        if (detectionPixels[(y * detectionCanvas.width + x) * 4 + 3] < 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) {
      throw new Error('La textura de límites municipales está vacía.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = TERRAIN_TEXTURE_WIDTH;
    canvas.height = TERRAIN_TEXTURE_HEIGHT;
    const context = canvas.getContext('2d');
    const scaleX = image.naturalWidth / detectionCanvas.width;
    const scaleY = image.naturalHeight / detectionCanvas.height;
    context.drawImage(
      image,
      minX * scaleX,
      minY * scaleY,
      (maxX - minX + 1) * scaleX,
      (maxY - minY + 1) * scaleY,
      canvas.width * 0.29,
      canvas.height * 0.24,
      canvas.width * 0.31,
      canvas.height * 0.49
    );
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] === 0) continue;
      imageData.data[i] = 56;
      imageData.data[i + 1] = 189;
      imageData.data[i + 2] = 248;
    }
    context.putImageData(imageData, 0, 0);
    linesTexture = new THREE.CanvasTexture(canvas);
    linesTexture.repeat.set(TERRAIN_TEXTURE_REPEAT, TERRAIN_TEXTURE_REPEAT);
    linesTexture.offset.set(TERRAIN_TEXTURE_OFFSET, TERRAIN_TEXTURE_OFFSET);
    linesTexture.colorSpace = THREE.SRGBColorSpace;
    return linesTexture;
  });

export const thermalReady = Promise.all([
  loadImage(textureImg, 'la textura del terreno'),
  loadImage(heightmapImg, 'el mapa de elevación')
]).then(([image, heightmap]) => {
  satelliteImage = image;
  thermalCanvas.width = image.naturalWidth;
  thermalCanvas.height = image.naturalHeight;
  thermalCtx = thermalCanvas.getContext('2d');
  heatCanvas.width = Math.ceil(thermalCanvas.width / 2);
  heatCanvas.height = Math.ceil(thermalCanvas.height / 2);
  heatContext = heatCanvas.getContext('2d');
  thermalTexture.needsUpdate = true;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = image.naturalWidth;
  maskCanvas.height = image.naturalHeight;
  const maskContext = maskCanvas.getContext('2d');
  const alignedHeightmap = createAlignedHeightmapCanvas(heightmap, maskCanvas.width, maskCanvas.height);
  maskContext.drawImage(alignedHeightmap, 0, 0);
  const elevationPixels = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
  const pixelCount = maskCanvas.width * maskCanvas.height;
  const landPixels = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const maskPixels = maskContext.createImageData(maskCanvas.width, maskCanvas.height);

  for (let i = 0; i < pixelCount; i++) {
    landPixels[i] = elevationPixels[i * 4] > 8 ? 1 : 0;
  }

  const textureX = thermalTexture.repeat.x;
  const textureY = thermalTexture.repeat.y;
  let landComponents = 0;
  municipiosCoords.forEach(m => {
    const worldPosition = latLonToVector3(m.lat, m.lon);
    const uvX = worldPosition.x / TERRAIN_WIDTH + 0.5;
    const uvY = 0.5 - worldPosition.z / TERRAIN_HEIGHT;
    const imageX = Math.round((uvX * textureX + thermalTexture.offset.x) * maskCanvas.width);
    const imageY = Math.round((1 - (uvY * textureY + thermalTexture.offset.y)) * maskCanvas.height);
    let seed = -1;
    let nearestDistance = Infinity;

    for (let y = Math.max(0, imageY - 48); y < Math.min(maskCanvas.height, imageY + 49); y++) {
      for (let x = Math.max(0, imageX - 48); x < Math.min(maskCanvas.width, imageX + 49); x++) {
        const distance = (x - imageX) ** 2 + (y - imageY) ** 2;
        const index = y * maskCanvas.width + x;
        if (landPixels[index] && distance < nearestDistance) {
          seed = index;
          nearestDistance = distance;
        }
      }
    }

    if (seed < 0 || visited[seed]) return;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    visited[seed] = 1;
    landComponents++;

    while (head < tail) {
      const index = queue[head++];
      const x = index % maskCanvas.width;
      const y = Math.floor(index / maskCanvas.width);
      maskPixels.data[index * 4 + 3] = 255;
      if (x > 0 && landPixels[index - 1] && !visited[index - 1]) {
        visited[index - 1] = 1;
        queue[tail++] = index - 1;
      }
      if (x < maskCanvas.width - 1 && landPixels[index + 1] && !visited[index + 1]) {
        visited[index + 1] = 1;
        queue[tail++] = index + 1;
      }
      if (y > 0 && landPixels[index - maskCanvas.width] && !visited[index - maskCanvas.width]) {
        visited[index - maskCanvas.width] = 1;
        queue[tail++] = index - maskCanvas.width;
      }
      if (y < maskCanvas.height - 1 && landPixels[index + maskCanvas.width] && !visited[index + maskCanvas.width]) {
        visited[index + maskCanvas.width] = 1;
        queue[tail++] = index + maskCanvas.width;
      }
    }
  });

  if (landComponents === 0) {
    throw new Error('No se pudo encontrar la isla en el mapa de elevación.');
  }
  maskContext.putImageData(maskPixels, 0, 0);
  islandMaskCanvas = maskCanvas;
  thermalInitialized = true;
  updateHeatmapTexture(lastThermalHour);
}).catch(error => {
  console.error('Error al preparar la capa térmica:', error);
  throw error;
});

function temperatureToRgb(temp) {
  const stops = [
    { temperature: 8, color: [34, 197, 94] },
    { temperature: 16, color: [250, 204, 21] },
    { temperature: 24, color: [249, 115, 22] },
    { temperature: 30, color: [239, 68, 68] },
    { temperature: 34, color: [185, 28, 28] },
    { temperature: 37, color: [127, 29, 29] },
    { temperature: 40, color: [91, 48, 34] }
  ];
  const clampedTemperature = THREE.MathUtils.clamp(temp, 8, 40);
  const upperIndex = stops.findIndex(stop => stop.temperature >= clampedTemperature);
  const upper = stops[upperIndex];
  const lower = stops[Math.max(0, upperIndex - 1)];
  const mix = (clampedTemperature - lower.temperature) /
    Math.max(upper.temperature - lower.temperature, 1);
  return lower.color.map((channel, index) =>
    Math.round(THREE.MathUtils.lerp(channel, upper.color[index], mix))
  );
}

export function updateHeatmapTexture(hourDecimal) {
  lastThermalHour = hourDecimal;
  if (!thermalInitialized || !satelliteImage || !islandMaskCanvas) return;
  const baseHour = Math.floor(hourDecimal);
  if (baseHour === lastRenderedThermalHour) return;
  const currentHourData = parsedData.filter(d => d.hora === baseHour);

  thermalCtx.clearRect(0, 0, thermalCanvas.width, thermalCanvas.height);
  thermalCtx.drawImage(satelliteImage, 0, 0, thermalCanvas.width, thermalCanvas.height);

  heatContext.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
  heatContext.drawImage(islandMaskCanvas, 0, 0, heatCanvas.width, heatCanvas.height);
  const heatPixels = heatContext.getImageData(0, 0, heatCanvas.width, heatCanvas.height);
  const stations = municipiosCoords.map(m => {
    const item = getMunicipalityWeather(m, currentHourData);
    const position = latLonToVector3(m.lat, m.lon);
    return item ? { x: position.x, z: position.z, temp: item.temp } : null;
  }).filter(Boolean);

  if (stations.length === 0) return;
  for (let y = 0; y < heatCanvas.height; y++) {
    for (let x = 0; x < heatCanvas.width; x++) {
      const pixel = (y * heatCanvas.width + x) * 4;
      if (heatPixels.data[pixel + 3] === 0) continue;
      const sourceX = (x + 0.5) * thermalCanvas.width / heatCanvas.width;
      const sourceY = (y + 0.5) * thermalCanvas.height / heatCanvas.height;
      const uvX = (sourceX / thermalCanvas.width - thermalTexture.offset.x) / thermalTexture.repeat.x;
      const uvY = 1 - (sourceY / thermalCanvas.height - thermalTexture.offset.y) / thermalTexture.repeat.y;
      const worldX = (uvX - 0.5) * TERRAIN_WIDTH;
      const worldZ = (0.5 - uvY) * TERRAIN_HEIGHT;
      let weightedTemperature = 0;
      let totalWeight = 0;
      stations.forEach(station => {
        const distanceSquared = (worldX - station.x) ** 2 + (worldZ - station.z) ** 2;
        const weight = 1 / Math.max(distanceSquared, 0.01);
        weightedTemperature += station.temp * weight;
        totalWeight += weight;
      });
      const [red, green, blue] = temperatureToRgb(weightedTemperature / totalWeight);
      heatPixels.data[pixel] = red;
      heatPixels.data[pixel + 1] = green;
      heatPixels.data[pixel + 2] = blue;
    }
  }
  heatContext.putImageData(heatPixels, 0, 0);
  thermalCtx.globalAlpha = 0.7;
  thermalCtx.drawImage(heatCanvas, 0, 0, thermalCanvas.width, thermalCanvas.height);
  thermalCtx.globalAlpha = 1;
  thermalTexture.needsUpdate = true;
  lastRenderedThermalHour = baseHour;
}