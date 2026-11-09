// --- ÚNICA FUNCIÓN DE CONVERSIÓN CALIBRADA (BORRA LAS ANTERIORES) ---
export function latLonToVector3(lat, lon) {
  // Límites geográficos reales de la caja de Gran Canaria
  const minLon = -15.86; 
  const maxLon = -15.32; 
  const minLat = 27.70;  
  const maxLat = 28.21;  

  const PLANE_WIDTH = 180;
  const PLANE_HEIGHT = 108;

  // Calibración exacta de expansión (X y Z independientes) para que lleguen a la costa
  const zoomFactorX = 0.74; 
  const zoomFactorZ = 0.81; 

  const pctX = (lon - minLon) / (maxLon - minLon);
  const pctZ = (maxLat - lat) / (maxLat - minLat);

  // Desfase fino calculado matemáticamente para clavar a Tejeda (la nube de lluvia) 
  // exactamente en el centro geográfico de tu relieve visual
  const offsetX = -13.0; 
  const offsetZ = -5.0;

  const x = (pctX - 0.5) * PLANE_WIDTH * zoomFactorX + offsetX;
  const z = (pctZ - 0.5) * PLANE_HEIGHT * zoomFactorZ + offsetZ;
  const y = 14; 

  return new THREE.Vector3(x, y, z);
}
