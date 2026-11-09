import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import textureImg from './assets/relief/gc-texture.png';
import heightmapImg from './assets/relief/gc-heightmap.png';
import { loadWeatherData, updateSpritesForHour, fetchLiveWeatherData } from './api.js';

// 1. Escena, Cámara y Renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
// Posición cercana para enfocar la isla EN GRANDE
camera.position.set(0, 60, 75);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 2. Controles de Cámara (Google Maps)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 15;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI / 2.05;

// 3. Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 150, 50);
scene.add(dirLight);

// 4. Terreno 3D Ampliado
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(textureImg);
const heightmap = textureLoader.load(heightmapImg);

// Ejemplo: Mostrar solo el 60% central del ancho y alto de la imagen
const zoomFactorX = 0.6; 
const zoomFactorY = 0.6;

[texture, heightmap].forEach((tex) => {
  tex.repeat.set(zoomFactorX, zoomFactorY);
  // Centramos el recorte (ajusta estos valores de 0 a 1 hasta encuadrar solo GC)
  tex.offset.set((1 - zoomFactorX) / 2, (1 - zoomFactorY) / 2); 
});

const PLANE_WIDTH = 180; // Reducimos el tamaño del plano para mantener la proporción
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

// 5. Capa Térmica Dinámica
let isThermal = false;
let is2D = false;

document.getElementById('btn-thermal').addEventListener('click', () => {
  isThermal = !isThermal;
  if (isThermal) {
    material.color.setHex(0xff7744);
  } else {
    material.color.setHex(0xffffff);
  }
  material.needsUpdate = true;
});

// Botón Vista 2D / 3D
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

// 6. UI y Lógica del Boceto
const timeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');
const btnPlay = document.getElementById('btn-play');
const btnSpeed = document.getElementById('btn-speed');
const btnDataSource = document.getElementById('btn-datasource');
const timelapseContainer = document.getElementById('timelapse-controls');

let isPlaying = false;
let playSpeed = 1;
let lastTimeUpdate = 0;
let isLiveMode = false;

function setHour(hour) {
  timeSlider.value = hour;
  timeDisplay.textContent = `${hour.toString().padStart(2, '0')}:00`;
  updateSpritesForHour(scene, hour);
}

timeSlider.addEventListener('input', (e) => {
  setHour(parseInt(e.target.value, 10));
});

btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? '⏸ Pausa' : '▶ Play';
});

const speeds = [1, 1.5, 2];
let speedIdx = 0;
btnSpeed.addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % speeds.length;
  playSpeed = speeds[speedIdx];
  btnSpeed.textContent = `Vel: x${playSpeed}`;
});

// Cambio entre Modo LIVE e Histórico (Tal como en tu dibujo)
btnDataSource.addEventListener('click', async () => {
  // En el loop animate() de src/main.js
    if (!isLiveMode && isPlaying && time - lastTimeUpdate > (1000 / playSpeed)) {
    let currentHour = parseInt(timeSlider.value, 10) + 1;
    
    if (currentHour > 23) {
        currentHour = 0;
        // Avanzar la fecha en la UI
        const datePicker = document.getElementById('date-picker');
        const currentDate = new Date(datePicker.value);
        currentDate.setDate(currentDate.getDate() + 1);
        datePicker.value = currentDate.toISOString().split('T')[0];
    }
    
    setHour(currentHour);
    lastTimeUpdate = time;
    }
});

// 7. Loop de Animación
function animate(time) {
  requestAnimationFrame(animate);
  controls.update();

  if (!isLiveMode && isPlaying && time - lastTimeUpdate > (1000 / playSpeed)) {
    let currentHour = (parseInt(timeSlider.value, 10) + 1) % 24;
    setHour(currentHour);
    lastTimeUpdate = time;
  }

  renderer.render(scene, camera);
}

loadWeatherData().then(() => {
  setHour(12);
});

animate(0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});