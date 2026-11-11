// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import textureImg from './assets/relief/gc-texture.png';
import heightmapImg from './assets/relief/gc-heightmap.png';
import { 
  loadWeatherData, 
  updateSpritesForHour, 
  fetchLiveWeatherData,
  initLabelRenderer,
  setupMunicipiosLabels,
  setupTerritoryLines,
  toggleMunicipioLabels,
  toggleMunicipioLines,
  updateMunicipioLabelVisibility,
  createAlignedHeightmapCanvas,
  municipalityLinesReady,
  thermalReady,
  weatherTexturesReady,
  TERRAIN_TEXTURE_WIDTH,
  TERRAIN_TEXTURE_HEIGHT,
  TERRAIN_WIDTH,
  TERRAIN_HEIGHT,
  TERRAIN_TEXTURE_REPEAT,
  TERRAIN_TEXTURE_OFFSET,
  getTerrainSurfaceHeight,
  terrainCenter,
  thermalTexture,
  csvDateRange
} from './api.js';

// 1. Escena, Cámara y Renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

const labelRenderer = initLabelRenderer(document.body);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 8;
controls.maxDistance = 180;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.copy(terrainCenter);

camera.position.copy(controls.target).add(new THREE.Vector3(0, 180, 200));
let activeCamera = camera;
const orthographicFrustumHeight = 110;
const camera2D = new THREE.OrthographicCamera(
  -orthographicFrustumHeight * camera.aspect / 2,
  orthographicFrustumHeight * camera.aspect / 2,
  orthographicFrustumHeight / 2,
  -orthographicFrustumHeight / 2,
  0.1,
  1000
);
camera2D.up.set(0, 0, -1);

// 2. Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 150, 50);
scene.add(dirLight);

// 3. Terreno 3D
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(textureImg);
let terrain;
let resolveTerrainReady;
let rejectTerrainReady;
const terrainReady = new Promise((resolve, reject) => {
  resolveTerrainReady = resolve;
  rejectTerrainReady = reject;
});

const heightmap = textureLoader.load(heightmapImg, (loadedHeightmap) => {
  try {
    const source = loadedHeightmap.image;
    const heightCanvas = createAlignedHeightmapCanvas(
      source,
      TERRAIN_TEXTURE_WIDTH,
      TERRAIN_TEXTURE_HEIGHT
    );
    const heightContext = heightCanvas.getContext('2d');
    const heightPixels = heightContext.getImageData(0, 0, heightCanvas.width, heightCanvas.height).data;
    const positions = terrain.geometry.attributes.position;
    const uvAttribute = terrain.geometry.attributes.uv;
    const sampleUv = new THREE.Vector2();

    for (let i = 0; i < positions.count; i++) {
      sampleUv.set(uvAttribute.getX(i), uvAttribute.getY(i));
      
      // Muestreo aplicando exactamente el mismo repeat y offset que la textura
      const uvX = sampleUv.x * TERRAIN_TEXTURE_REPEAT + TERRAIN_TEXTURE_OFFSET;
      const uvY = sampleUv.y * TERRAIN_TEXTURE_REPEAT + TERRAIN_TEXTURE_OFFSET;

      const sourceX = uvX * (heightCanvas.width - 1);
      const sourceY = (1 - uvY) * (heightCanvas.height - 1);

      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(x0 + 1, heightCanvas.width - 1);
      const y1 = Math.min(y0 + 1, heightCanvas.height - 1);
      const xBlend = sourceX - x0;
      const yBlend = sourceY - y0;

      const topLeft = heightPixels[(y0 * heightCanvas.width + x0) * 4];
      const topRight = heightPixels[(y0 * heightCanvas.width + x1) * 4];
      const bottomLeft = heightPixels[(y1 * heightCanvas.width + x0) * 4];
      const bottomRight = heightPixels[(y1 * heightCanvas.width + x1) * 4];

      const top = THREE.MathUtils.lerp(topLeft, topRight, xBlend);
      const bottom = THREE.MathUtils.lerp(bottomLeft, bottomRight, xBlend);
      const elevationRaw = THREE.MathUtils.lerp(top, bottom, yBlend) / 255;

      const elevation = Math.sqrt(elevationRaw); 
      positions.setZ(i, elevation * material.displacementScale + material.displacementBias);
    }

    positions.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    terrain.geometry.computeBoundingSphere();
    material.displacementMap = null;
    material.needsUpdate = true;
    resolveTerrainReady();
    
  } catch (error) {
    rejectTerrainReady(error);
  }
}, undefined, rejectTerrainReady);

const zoomFactorX = TERRAIN_TEXTURE_REPEAT;
const zoomFactorY = TERRAIN_TEXTURE_REPEAT;

[texture, heightmap].forEach((tex) => {
  tex.repeat.set(zoomFactorX, zoomFactorY);
  tex.offset.set(TERRAIN_TEXTURE_OFFSET, TERRAIN_TEXTURE_OFFSET);
});

const PLANE_WIDTH = TERRAIN_WIDTH;
const PLANE_HEIGHT = TERRAIN_HEIGHT;

const material = new THREE.MeshStandardMaterial({
  map: texture,
  displacementMap: heightmap,
  displacementScale: 10,
  displacementBias: 0,
  roughness: 0.8
});

terrain = new THREE.Mesh(
  new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT, 256, 256),
  material
);
terrain.rotation.x = -Math.PI / 2;
scene.add(terrain);

const textureFilters = [texture, heightmap];
textureFilters.forEach(tex => {
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
});

thermalTexture.repeat.set(zoomFactorX, zoomFactorY);
thermalTexture.offset.set(TERRAIN_TEXTURE_OFFSET, TERRAIN_TEXTURE_OFFSET);
thermalTexture.anisotropy = maxAnisotropy;

const endCameraPosition = terrainCenter.clone().add(new THREE.Vector3(0, 100, 140));
camera.position.copy(endCameraPosition);
camera.lookAt(terrainCenter);

// 5. Controles UI y Timelapse
const timeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');
const btnPlay = document.getElementById('btn-play');
const btnSpeed = document.getElementById('btn-speed');
const btnDataSource = document.getElementById('btn-datasource');
const timelapseControls = document.getElementById('timelapse-controls');
const datePicker = document.getElementById('date-picker');
const btnCollapse = document.getElementById('btn-collapse');
const uiContainer = document.getElementById('ui-container');

btnCollapse.addEventListener('click', () => {
  const isExpanded = btnCollapse.getAttribute('aria-expanded') === 'true';
  btnCollapse.setAttribute('aria-expanded', String(!isExpanded));
  btnCollapse.setAttribute('aria-label', isExpanded ? 'Expandir menú' : 'Plegar menú');
  btnCollapse.textContent = isExpanded ? '+' : '−';
  uiContainer.classList.toggle('is-collapsed', isExpanded);
});

let isPlaying = false;
let playSpeed = 1;
let lastFrameTime = performance.now();
let currentHourValue = Number(timeSlider.value);
let isLiveMode = false;
let isSceneInitialized = false;
let frameRequest = null;
let labelsNeedOcclusionUpdate = true;
let selectedLayer = 'weather';
let showWeatherIcons = true;
let introAnimationActive = false;
let introStartTime = 0;
const introDuration = 4200;

function requestRender() {
  if (frameRequest === null) {
    frameRequest = requestAnimationFrame(animate);
  }
}

function stopIntroAnimation() {
  if (!introAnimationActive) return;
  introAnimationActive = false;
  removeIntroInputListeners();
  controls.enabled = true;
  controls.target.copy(terrainCenter);
  lastFrameTime = performance.now();
  requestRender();
}

function removeIntroInputListeners() {
  window.removeEventListener('pointerdown', stopIntroAnimation, true);
  window.removeEventListener('wheel', stopIntroAnimation, true);
  window.removeEventListener('keydown', stopIntroAnimation, true);
}

controls.addEventListener('change', () => {
  labelsNeedOcclusionUpdate = true;
  requestRender();
});

// 🔹 CONFIGURACIÓN DINÁMICA DEL RANGO DEL CALENDARIO
function setupDatePickerLimits() {
  if (csvDateRange.min && csvDateRange.max) {
    datePicker.setAttribute('min', csvDateRange.min);
    datePicker.setAttribute('max', csvDateRange.max);
    datePicker.value = csvDateRange.max; // Seleccionamos por defecto el día más reciente
  }
}

function setHour(hourDecimal) {
  currentHourValue = hourDecimal;
  timeSlider.value = hourDecimal;
  const hours = Math.floor(hourDecimal);
  const minutes = Math.floor((hourDecimal % 1) * 60);
  timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  if (isSceneInitialized) {
    updateSpritesForHour(scene, terrain, hourDecimal, selectedLayer, showWeatherIcons, datePicker.value);
  }
  requestRender();
}

timeSlider.addEventListener('input', (e) => {
  setHour(parseFloat(e.target.value));
});

btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? '⏸ Pausa' : '▶ Play';
  lastFrameTime = performance.now();
  requestRender();
});

const speeds = [1, 2, 4, 8];
let speedIdx = 0;
btnSpeed.addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  playSpeed = speeds[speedIdx];
  btnSpeed.textContent = `Vel: x${playSpeed}`;
});

async function setLiveMode(enabled) {
  if (isLiveMode === enabled) return;
  isLiveMode = enabled;
  if (isLiveMode) {
    datePicker.value = formatLocalDate(new Date());
    btnDataSource.textContent = 'Modo: LIVE (Tiempo Real)';
    timelapseControls.style.display = 'none';
    isPlaying = false;
    btnPlay.textContent = '▶ Play';
    try {
      await fetchLiveWeatherData();
      setHour(new Date().getHours());
    } catch (error) {
      console.error('No se pudo activar el modo LIVE:', error);
      isLiveMode = false;
      btnDataSource.textContent = 'Modo: HISTÓRICO (CSV)';
      timelapseControls.style.display = 'block';
    }
  } else {
    btnDataSource.textContent = 'Modo: HISTÓRICO (CSV)';
    timelapseControls.style.display = 'block';
    try {
      await loadWeatherData();
      setupDatePickerLimits();
      setHour(parseFloat(timeSlider.value));
    } catch (error) {
      console.error('No se pudo volver al modo histórico:', error);
      isLiveMode = true;
      btnDataSource.textContent = 'Modo: LIVE (Tiempo Real)';
      timelapseControls.style.display = 'none';
    }
  }
  requestRender();
}

btnDataSource.addEventListener('click', () => setLiveMode(!isLiveMode));
document.getElementById('btn-today').addEventListener('click', () => setLiveMode(true));

datePicker.addEventListener('change', () => {
  if (!isLiveMode && isSceneInitialized) {
    updateSpritesForHour(scene, terrain, currentHourValue, selectedLayer, showWeatherIcons, datePicker.value);
    requestRender();
  }
});

const btnWeatherLayer = document.getElementById('btn-layer-weather');
const btnWindLayer = document.getElementById('btn-layer-wind');
function selectLayer(layer) {
  selectedLayer = layer;
  btnWeatherLayer.classList.toggle('active', layer === 'weather');
  btnWindLayer.classList.toggle('active', layer === 'wind');
  if (isSceneInitialized) {
    updateSpritesForHour(scene, terrain, currentHourValue, selectedLayer, showWeatherIcons, datePicker.value);
  }
  requestRender();
}
btnWeatherLayer.addEventListener('click', () => selectLayer('weather'));
btnWindLayer.addEventListener('click', () => selectLayer('wind'));
const btnIcons = document.getElementById('btn-icons');
btnIcons.addEventListener('click', () => {
  showWeatherIcons = !showWeatherIcons;
  btnIcons.classList.toggle('active', showWeatherIcons);
  if (isSceneInitialized) {
    updateSpritesForHour(scene, terrain, currentHourValue, selectedLayer, showWeatherIcons, datePicker.value);
  }
  requestRender();
});

const btnLabels = document.getElementById('btn-labels');
let showLabels = false;
btnLabels.addEventListener('click', () => {
  showLabels = !showLabels;
  btnLabels.classList.toggle('active', showLabels);
  toggleMunicipioLabels(showLabels);
  labelsNeedOcclusionUpdate = true;
  requestRender();
});

const btnLines = document.getElementById('btn-lines');
let showLines = false;
btnLines.addEventListener('click', () => {
  showLines = !showLines;
  btnLines.classList.toggle('active', showLines);
  toggleMunicipioLines(showLines);
  requestRender();
});

const btnThermal = document.getElementById('btn-thermal');
const legendUI = document.getElementById('thermal-legend');

btnThermal.addEventListener('click', () => {
  const isThermalActive = !btnThermal.classList.contains('active');
  btnThermal.classList.toggle('active', isThermalActive);
  if (legendUI) legendUI.hidden = !isThermalActive;
  if (isThermalActive) {
    if (isSceneInitialized) {
      updateSpritesForHour(scene, terrain, currentHourValue, selectedLayer, showWeatherIcons, datePicker.value);
    }
    material.map = thermalTexture;
  } else {
    material.map = texture;
  }
  material.needsUpdate = true;
  requestRender();
});

let is2D = false;

document.getElementById('btn-mode').addEventListener('click', (event) => {
  is2D = !is2D;
  if (is2D) {
    camera2D.position.copy(controls.target).add(new THREE.Vector3(0, 120, 0));
    camera2D.lookAt(controls.target);
    controls.object = camera2D;
    controls.enableRotate = false;
    controls.minZoom = 0.75;
    controls.maxZoom = 8;
    activeCamera = camera2D;
  } else {
    controls.object = camera;
    camera.position.copy(controls.target).add(new THREE.Vector3(0, 60, 75));
    camera.lookAt(controls.target);
    controls.enableRotate = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    activeCamera = camera;
  }
  event.currentTarget.classList.toggle('active', is2D);
  controls.update();
  labelsNeedOcclusionUpdate = true;
  requestRender();
});

// 6. Loop Principal
function animate(now) {
  frameRequest = null;
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  controls.update();
  if (isSceneInitialized && !is2D) {
    const terrainClearance = 2;
    const terrainHeight = getTerrainSurfaceHeight(
      terrain,
      activeCamera.position.x,
      activeCamera.position.z
    );
    if (activeCamera.position.y < terrainHeight + terrainClearance) {
      activeCamera.position.y = terrainHeight + terrainClearance;
      activeCamera.lookAt(controls.target);
    }
  }

  if (!isLiveMode && isPlaying) {
    let currentHour = currentHourValue;
    currentHour += (delta * playSpeed) / 5; 

    if (currentHour >= 24) {
      const [year, month, day] = datePicker.value.split('-').map(Number);
      const currentDate = new Date(year, month - 1, day);
      currentDate.setDate(currentDate.getDate() + 1);
      const nextDateStr = formatLocalDate(currentDate);

      // Si la siguiente fecha no supera la fecha máxima del CSV, avanzamos de día
      if (!csvDateRange.max || nextDateStr <= csvDateRange.max) {
        datePicker.value = nextDateStr;
        currentHour = 0;
      } else {
        currentHour = 23.99;
        isPlaying = false;
        btnPlay.textContent = '▶ Play';
      }
    }
    setHour(currentHour);
  }

  if (introAnimationActive) {
    const progress = Math.min((now - introStartTime) / introDuration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const startCamPos = terrainCenter.clone().add(new THREE.Vector3(40, 220, 260));
    const targetCamPos = endCameraPosition; 

    camera.position.lerpVectors(startCamPos, targetCamPos, easedProgress);
    
    const subtleAngle = (1 - easedProgress) * 0.25; 
    camera.position.x += Math.sin(subtleAngle) * 30;

    camera.lookAt(terrainCenter);
    labelsNeedOcclusionUpdate = true;

    if (progress === 1) {
      introAnimationActive = false;
      removeIntroInputListeners();
      controls.enabled = true;
      camera.position.copy(endCameraPosition);
      camera.lookAt(terrainCenter);
    } else {
      requestRender();
    }
  }
  if (labelsNeedOcclusionUpdate && isSceneInitialized) {
    updateMunicipioLabelVisibility(activeCamera, terrain, showLabels);
    labelsNeedOcclusionUpdate = false;
  }
  renderer.render(scene, activeCamera);
  labelRenderer.render(scene, activeCamera);
  if (!isLiveMode && isPlaying) requestRender();
}

// Inicialización completa
Promise.all([
  loadWeatherData(),
  terrainReady,
  municipalityLinesReady,
  thermalReady,
  weatherTexturesReady
]).then(() => {
  setupDatePickerLimits(); // 👈 Capamos el calendario dinámicamente según el CSV
  setupMunicipiosLabels(scene, terrain);
  setupTerritoryLines(scene, terrain);
  toggleMunicipioLabels(showLabels);
  toggleMunicipioLines(showLines);
  btnLabels.classList.toggle('active', showLabels);
  btnLines.classList.toggle('active', showLines);
  isSceneInitialized = true;
  setHour(12);
  controls.enabled = false;
  introAnimationActive = true;
  introStartTime = performance.now();
  lastFrameTime = introStartTime;
  window.addEventListener('pointerdown', stopIntroAnimation, { once: true, capture: true });
  window.addEventListener('wheel', stopIntroAnimation, { once: true, capture: true });
  window.addEventListener('keydown', stopIntroAnimation, { once: true, capture: true });
  requestRender();
}).catch(error => {
  console.error('No se pudo iniciar el visor del terreno:', error);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const aspect = window.innerWidth / window.innerHeight;
  camera2D.left = -orthographicFrustumHeight * aspect / 2;
  camera2D.right = orthographicFrustumHeight * aspect / 2;
  camera2D.top = orthographicFrustumHeight / 2;
  camera2D.bottom = -orthographicFrustumHeight / 2;
  camera2D.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelsNeedOcclusionUpdate = true;
  requestRender();
});

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}