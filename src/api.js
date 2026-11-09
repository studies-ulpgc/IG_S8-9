import * as THREE from 'three';
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

const municipiosCoords = [
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

// --- CONVERSIÓN CORREGIDA Y EXTRA DESPLAZADA A LA IZQUIERDA ---
// --- FUNCIÓN DE CONVERSIÓN PROPORCIONAL CORREGIDA ---
export function latLonToVector3(lat, lon) {
  // Al ampliar estos límites geográficos, la matemática "encoge" la malla de iconos
  // obligándolos a entrar dentro de los márgenes reales de la costa de la isla.
  const minLon = -16.14; 
  const maxLon = -15.04; 
  const minLat = 27.63;  
  const maxLat = 28.28;  

  const PLANE_WIDTH = 180;
  const PLANE_HEIGHT = 108;

  // Hacemos una conversión lineal pura basada en porcentajes (0% a 100% de la imagen)
  const pctX = (lon - minLon) / (maxLon - minLon);
  const pctZ = (maxLat - lat) / (maxLat - minLat);
  
  const offsetX = -10.0; 

  // Mueve TODO el bloque en vertical.
  // - Números NEGATIVOS lo mueven hacia el NORTE (arriba).
  // - Números POSITIVOS lo mueven hacia el SUR (abajo).
  const offsetZ = 0.0; 

  // Posicionamos los iconos de forma 100% proporcional al tamaño del plano
  const x = (pctX - 0.5) * PLANE_WIDTH + offsetX;
  const z = (pctZ - 0.5) * PLANE_HEIGHT + offsetZ;
  const y = 12; 

  return new THREE.Vector3(x, y, z);
}


export async function loadWeatherData() {
  try {
    const response = await fetch(csvDataPath);
    const text = await response.text();
    const lines = text.trim().split('\n');

    parsedData = lines.slice(1).map(line => {
      const values = line.split(',');
      if(values.length < 6) return null;
      return {
        municipio: values[0].replace(/"/g, ''), // <-- ARREGLADO: values[0] en vez de values
        lat: parseFloat(values[1]),
        lon: parseFloat(values[2]),
        hora: parseInt(values[3], 10),
        temp: parseFloat(values[4]),
        codigo_clima: parseInt(values[5], 10),
        viento_vel: parseFloat(values[6]),
        viento_dir: parseFloat(values[7])
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
      const url = `https://open-meteo.com{m.lat}&longitude=${m.lon}&current_weather=true`;
      const res = await fetch(url);
      const data = await res.json();
      
      parsedData.push({
        municipio: m.municipio,
        lat: m.lat,
        lon: m.lon,
        hora: currentHour,
        temp: data.current_weather.temperature,
        codigo_clima: data.current_weather.weathercode
      });
    } catch (e) {
      console.error(`Error API para ${m.municipio}:`, e);
    }
  }
}

export function updateSpritesForHour(scene, hour) {
  // Obliga a esperar a que el CSV se lea correctamente sin errores
  if (parsedData.length === 0) return;

  const currentHourData = parsedData.filter(d => d.hora === hour);

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
      sprite.scale.set(7, 7, 1);
      
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
