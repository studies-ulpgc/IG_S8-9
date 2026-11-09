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
  toggleLabelsAndLines
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

// INICIALIZAR RENDERIZADOR DE ETIQUETAS (CSS2D - Fase 2)
const labelRenderer = initLabelRenderer(document.body);

// Controles de Cámara
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 15;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI / 2.05;

camera.position.set(0, 180, 200);

// 2. Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 150, 50);
scene.add(dirLight);

// 3. Terreno 3D
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(textureImg);
const heightmap = textureLoader.load(heightmapImg);

const zoomFactorX = 0.6; 
const zoomFactorY = 0.6;

[texture, heightmap].forEach((tex) => {
  tex.repeat.set(zoomFactorX, zoomFactorY);
  tex.offset.set((1 - zoomFactorX) / 2, (1 - zoomFactorY) / 2); 
});

const PLANE_WIDTH = 180;
const PLANE_HEIGHT = 108; 
const geometry = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT, 256, 256);

const material = new THREE.MeshStandardMaterial({
  map: texture,
  displacementMap: heightmap,
  displacementScale: 18,
  displacementBias: -4,
  roughness: 0.8
});

const terrain = new THREE.Mesh(geometry, material);
terrain.rotation.x = -Math.PI / 2;
scene.add(terrain);

// 4. ANIMACIÓN DE ENTRADA
let introAnim = true;
let introProgress = 0;
const startPos = new THREE.Vector3(0, 180, 200);
const endPos = new THREE.Vector3(0, 60, 75);

function updateIntroAnimation() {
  if (!introAnim) return;
  introProgress += 0.015;
  if (introProgress >= 1) {
    introProgress = 1;
    introAnim = false;
  }
  const t = introProgress * introProgress * (3 - 2 * introProgress);
  camera.position.lerpVectors(startPos, endPos, t);
}

// 5. Controles UI y Timelapse
const timeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');
const btnPlay = document.getElementById('btn-play');
const btnSpeed = document.getElementById('btn-speed');
const btnDataSource = document.getElementById('btn-datasource');
const timelapseControls = document.getElementById('timelapse-controls');
const datePicker = document.getElementById('date-picker');

let isPlaying = false;
let playSpeed = 1;
let lastFrameTime = performance.now();
let isLiveMode = false;
let showLabels = true;

function setHour(hourDecimal) {
  timeSlider.value = hourDecimal;
  const hours = Math.floor(hourDecimal);
  const minutes = Math.floor((hourDecimal % 1) * 60);
  timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  updateSpritesForHour(scene, hourDecimal);
}

timeSlider.addEventListener('input', (e) => {
  setHour(parseFloat(e.target.value));
});

btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? '⏸ Pausa' : '▶ Play';
});

const speeds = [1, 2, 4, 8];
let speedIdx = 0;
btnSpeed.addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  playSpeed = speeds[speedIdx];
  btnSpeed.textContent = `Vel: x${playSpeed}`;
});

btnDataSource.addEventListener('click', async () => {
  isLiveMode = !isLiveMode;
  if (isLiveMode) {
    btnDataSource.textContent = 'Modo: LIVE (Tiempo Real)';
    timelapseControls.style.display = 'none';
    isPlaying = false;
    btnPlay.textContent = '▶ Play';
    await fetchLiveWeatherData();
    const currentHour = new Date().getHours();
    setHour(currentHour);
  } else {
    btnDataSource.textContent = 'Modo: HISTÓRICO (CSV)';
    timelapseControls.style.display = 'block';
    await loadWeatherData();
    setHour(parseFloat(timeSlider.value));
  }
});

// Botón Toggle para Etiquetas y Líneas (Fase 2)
const btnLabels = document.getElementById('btn-labels');
btnLabels.addEventListener('click', () => {
  showLabels = !showLabels;
  btnLabels.classList.toggle('active', showLabels);
  toggleLabelsAndLines(showLabels);
});

// Botón Térmico y 2D/3D
let isThermal = false;
let is2D = false;

document.getElementById('btn-thermal').addEventListener('click', () => {
  isThermal = !isThermal;
  material.color.setHex(isThermal ? 0xff7744 : 0xffffff);
});

document.getElementById('btn-mode').addEventListener('click', () => {
  is2D = !is2D;
  if (is2D) {
    camera.position.set(0, 120, 0.01);
    controls.maxPolarAngle = 0;
  } else {
    camera.position.set(0, 60, 75);
    controls.maxPolarAngle = Math.PI / 2.05;
  }
  controls.target.set(0, 0, 0);
  controls.update();
});

// 6. Loop Principal
function animate(now) {
  requestAnimationFrame(animate);
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  updateIntroAnimation();
  controls.update();

  if (!isLiveMode && isPlaying) {
    let currentHour = parseFloat(timeSlider.value);
    currentHour += (delta * playSpeed) / 5; 

    if (currentHour >= 24) {
      currentHour = 0;
      const currentDate = new Date(datePicker.value);
      const todayStr = new Date().toISOString().split('T')[0];

      if (datePicker.value !== todayStr) {
        currentDate.setDate(currentDate.getDate() + 1);
        datePicker.value = currentDate.toISOString().split('T')[0];
      } else {
        isPlaying = false;
        btnPlay.textContent = '▶ Play';
      }
    }
    setHour(currentHour);
  }

  // Renderizar la escena 3D y las etiquetas 2D
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// Inicialización completa
loadWeatherData().then(() => {
  setupMunicipiosLabels(scene);
  setupTerritoryLines(scene);
  setHour(12);
  lastFrameTime = performance.now();
  animate(lastFrameTime);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

//Hacer fase 4
// Que als etiquetas no se vean detrás de las montañas
//Que los iconos estén un poco encima del relieve
//Modo 2d
//Poder acercar y que se vea nítido, y separar enf rnajas los municipios
//Animación inicial
//Poder acercarse y ver más detalles de la zona si te acercas, y que se vea nítido