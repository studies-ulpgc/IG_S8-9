import * as THREE from 'three';
// Importamos el renderizador 2D para HTML overlays
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import csvDataPath from './assets/data/climaData.csv';

import iconSun from './assets/icons/sun.png';
import iconCloud from './assets/icons/cloud.png';
import iconPartlyCloudy from './assets/icons/partly_cloudy.png';
import iconRain from './assets/icons/rain.png';
import iconThunder from './assets/icons/cloud_thunder.png';

const textureLoader = new THREE.TextureLoader();
const weatherTextures = {
  sun: textureLoader.load(iconSun),
  cloud: textureLoader.load(iconCloud),
  partlyCloudy: textureLoader.load(iconPartlyCloudy),
  rain: textureLoader.load(iconRain),
  thunder: textureLoader.load(iconThunder)
};

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
let boundariesGroup = new THREE.Group();

export const municipiosCoords = [
  { municipio: "Las Palmas", lat: 28.1235, lon: -15.4363 },
  { municipio: "Telde", lat: 27.9961, lon: -15.4162 },
  { municipio: "Maspalomas", lat: 27.7606, lon: -15.5860 },
  { municipio: "Mogán", lat: 27.8838, lon: -15.7252 },
  { municipio: "Agaete", lat: 28.1001, lon: -15.7011 },
  { municipio: "Gáldar", lat: 28.1470, lon: -15.6542 },
  { municipio: "Arucas", lat: 28.1189, lon: -15.5230 },
  { municipio: "Tejeda", lat: 27.9958, lon: -15.6161 },
  { municipio: "Teror", lat: 28.0592, lon: -15.5476 }
];

export function latLonToVector3(lat, lon) {
  const minLon = -16.14; 
  const maxLon = -15.04; 
  const minLat = 27.63;  
  const maxLat = 28.28;  

  const PLANE_WIDTH = 180;
  const PLANE_HEIGHT = 108;

  const pctX = (lon - minLon) / (maxLon - minLon);
  const pctZ = (maxLat - lat) / (maxLat - minLat);
  
  const offsetX = -10.0; 
  const offsetZ = 0.0; 

  const x = (pctX - 0.5) * PLANE_WIDTH + offsetX;
  const z = (pctZ - 0.5) * PLANE_HEIGHT + offsetZ;
  const y = 12; 

  return new THREE.Vector3(x, y, z);
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
export function setupMunicipiosLabels(scene) {
  municipiosCoords.forEach(m => {
    const pos = latLonToVector3(m.lat, m.lon);
    
    const div = document.createElement('div');
    div.className = 'map-label';
    div.textContent = m.municipio;

    const labelObj = new CSS2DObject(div);
    // Colocamos el texto ligeramente por debajo del icono de clima
    labelObj.position.set(pos.x, pos.y - 4, pos.z);

    scene.add(labelObj);
    activeLabels.push(labelObj);
  });
}

// Dibujar la cuadrícula / guías visuales del territorio
export function setupTerritoryLines(scene) {
  scene.add(boundariesGroup);
  
  // Dibujamos un marco concéntrico simulando zonas administrativas sobre la isla
  municipiosCoords.forEach(m => {
    const center = latLonToVector3(m.lat, m.lon);
    const geometry = new THREE.BufferGeometry();
    const points = [];
    const radius = 6;
    const segments = 16;

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        center.x + Math.cos(theta) * radius,
        center.y - 9.5, // Pegado al terreno
        center.z + Math.sin(theta) * radius
      ));
    }

    geometry.setFromPoints(points);
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 1,
      gapSize: 0.5,
      opacity: 0.4,
      transparent: true
    });

    const line = new THREE.Line(geometry, lineMaterial);
    line.computeLineDistances();
    boundariesGroup.add(line);
  });
}

// Alternar visibilidad de Etiquetas y Líneas
export function toggleLabelsAndLines(visible) {
  activeLabels.forEach(l => {
    l.element.style.display = visible ? 'block' : 'none';
  });
  boundariesGroup.visible = visible;
}

export async function loadWeatherData() {
  try {
    const response = await fetch(csvDataPath);
    const text = await response.text();
    const lines = text.trim().split('\n');

    parsedData = lines.slice(1).map(line => {
      const values = line.split(',');
      if (values.length < 6) return null;
      return {
        municipio: values[0].replace(/"/g, ''),
        lat: parseFloat(values[1]),
        lon: parseFloat(values[2]),
        hora: parseInt(values[3], 10),
        temp: parseFloat(values[4]),
        codigo_clima: parseInt(values[5], 10),
        viento_vel: parseFloat(values[6] || 0),
        viento_dir: parseFloat(values[7] || 0)
      };
    }).filter(Boolean);
  } catch (error) {
    console.error("Error al cargar climaData.csv:", error);
  }
}

export async function fetchLiveWeatherData() {
  parsedData = [];
  const currentHour = new Date().getHours();

  for (const m of municipiosCoords) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&current_weather=true`;
      const res = await fetch(url);
      const data = await res.json();
      
      parsedData.push({
        municipio: m.municipio,
        lat: m.lat,
        lon: m.lon,
        hora: currentHour,
        temp: data.current_weather.temperature,
        codigo_clima: data.current_weather.weathercode,
        viento_vel: data.current_weather.windspeed,
        viento_dir: data.current_weather.winddirection
      });
    } catch (e) {
      console.error(`Error API para ${m.municipio}:`, e);
    }
  }
}

export function updateSpritesForHour(scene, hourDecimal) {
  if (parsedData.length === 0) return;

  const baseHour = Math.floor(hourDecimal);
  const currentHourData = parsedData.filter(d => d.hora === baseHour);

  if (activeSprites.length === 0) {
    municipiosCoords.forEach(m => {
      const item = currentHourData.find(d => d.municipio === m.municipio) || { codigo_clima: 0, lat: m.lat, lon: m.lon };
      const posicion3D = latLonToVector3(item.lat, item.lon);

      const spriteMaterial = new THREE.SpriteMaterial({
        map: getWeatherTexture(item.codigo_clima),
        transparent: true,
        depthTest: true 
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(posicion3D);
      sprite.scale.set(5, 5, 1);
      
      scene.add(sprite);
      activeSprites.push({ sprite, municipio: m.municipio });
    });
  } else {
    activeSprites.forEach(entry => {
      const item = currentHourData.find(d => d.municipio === entry.municipio);
      if (item) {
        entry.sprite.material.map = getWeatherTexture(item.codigo_clima);
        entry.sprite.material.needsUpdate = true;
        
        const posicion3D = latLonToVector3(item.lat, item.lon);
        entry.sprite.position.copy(posicion3D);
      }
    });
  }
}