import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import textureImg from './assets/relief/gc-texture.png';
import heightmapImg from './assets/relief/gc-heightmap.png';
import { loadWeatherData, updateSpritesForHour } from './api.js';

// 1. Escena, Cámara y Renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 160, 180);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// 2. Controles de Cámara
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 40;
controls.maxDistance = 350;
controls.maxPolarAngle = Math.PI / 2.05;

// 3. Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(100, 150, 50);
scene.add(dirLight);

// 4. Terreno 3D
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(textureImg);
const heightmap = textureLoader.load(heightmapImg);

const PLANE_WIDTH = 280;
const PLANE_HEIGHT = 160;
const geometry = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT, 256, 256);

const material = new THREE.MeshStandardMaterial({
  map: texture,
  displacementMap: heightmap,
  displacementScale: 30,
  displacementBias: 0,
  roughness: 0.8
});

const terrain = new THREE.Mesh(geometry, material);
terrain.rotation.x = -Math.PI / 2;
scene.add(terrain);

// 5. Textura Térmica Dinámica
function createThermalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(0.5, '#eab308');
  gradient.addColorStop(1, '#ef4444');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  return new THREE.CanvasTexture(canvas);
}

const thermalTexture = createThermalTexture();

// 6. Estado e Interactividad UI
let isThermal = false;
let is2D = false;

document.getElementById('btn-thermal').addEventListener('click', () => {
  isThermal = !isThermal;
  material.map = isThermal ? thermalTexture : texture;
  material.needsUpdate = true;
});

document.getElementById('btn-mode').addEventListener('click', () => {
  is2D = !is2D;
  if (is2D) {
    camera.position.set(0, 220, 0.01);
    controls.maxPolarAngle = 0;
  } else {
    camera.position.set(0, 160, 180);
    controls.maxPolarAngle = Math.PI / 2.05;
  }
  controls.target.set(0, 0, 0);
  controls.update();
});

// 7. Conexión del Slider de Horas (0 - 23h)
const timeSlider = document.getElementById('time-slider');
const timeDisplay = document.getElementById('time-display');

timeSlider.addEventListener('input', (e) => {
  const hour = parseInt(e.target.value, 10);
  timeDisplay.textContent = `${hour.toString().padStart(2, '0')}:00`;
  updateSpritesForHour(scene, hour);
});

// 8. Inicialización de Datos Climáticos y Sprites
loadWeatherData().then(() => {
  updateSpritesForHour(scene, 12); // Cargar hora por defecto (12:00)
});

// 9. Loop de Animación
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});