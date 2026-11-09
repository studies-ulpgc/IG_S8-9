import * as THREE from 'three';
import { latLonToVector3 } from './geoutils.js';
import csvDataPath from './assets/data/climaData.csv';

// Importar los iconos PNG usando Parcel
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

// Mapeo de códigos WMO de la API / CSV a texturas de iconos
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

/**
 * Carga los datos del CSV y los convierte en un array de objetos
 */
export async function loadWeatherData() {
  try {
    const response = await fetch(csvDataPath);
    const text = await response.text();
    
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');

    parsedData = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        municipio: values[0].replace(/"/g, ''),
        lat: parseFloat(values[1]),
        lon: parseFloat(values[2]),
        hora: parseInt(values[3], 10),
        temp: parseFloat(values[4]),
        codigo_clima: parseInt(values[5], 10),
        viento_vel: parseFloat(values[6]),
        viento_dir: parseFloat(values[7])
      };
    });

    console.log("Datos climáticos cargados correctamente:", parsedData.length, "registros.");
  } catch (error) {
    console.error("Error al cargar climaData.csv:", error);
  }
}

/**
 * Renderiza o actualiza los Sprites 2D en la escena para una hora dada (0 - 23)
 */
export function updateSpritesForHour(scene, hour) {
  // Filtrar registros correspondientes a la hora seleccionada
  const currentHourData = parsedData.filter(d => d.hora === hour);

  // Si ya existen sprites, los actualizamos; si no, los creamos
  if (activeSprites.length === 0) {
    currentHourData.forEach(item => {
      const { x, z } = latLonToVector3(item.lat, item.lon, 280, 160);

      const spriteMaterial = new THREE.SpriteMaterial({
        map: getWeatherTexture(item.codigo_clima),
        transparent: true,
        depthTest: false // Asegura que se dibujen flotando sin cortarse con las montañas
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(x, 22, z); // Elevado sobre el terreno 3D
      sprite.scale.set(14, 14, 1);
      
      // Guardar datos asociados para futuras referencias
      sprite.userData = { municipio: item.municipio };

      scene.add(sprite);
      activeSprites.push({ sprite, municipio: item.municipio });
    });
  } else {
    // Actualizar textura del sprite existente según la hora
    activeSprites.forEach(entry => {
      const item = currentHourData.find(d => d.municipio === entry.municipio);
      if (item) {
        entry.sprite.material.map = getWeatherTexture(item.codigo_clima);
        entry.sprite.material.needsUpdate = true;
      }
    });
  }
}