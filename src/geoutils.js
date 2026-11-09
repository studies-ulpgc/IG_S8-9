// Rangos geográficos aproximados del encuadre de Gran Canaria
const MAP_BOUNDS = {
  minLat: 27.73,  // Sur (Maspalomas)
  maxLat: 28.18,  // Norte (Las Palmas)
  minLon: -15.83, // Oeste (Agaete)
  maxLon: -15.35  // Este (Telde)
};

/**
 * Convierte latitud y longitud en coordenadas X, Z para el plano 3D
 */
export function latLonToVector3(lat, lon, planeWidth = 280, planeHeight = 160) {
  const u = (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
  const v = (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);

  const x = (u - 0.5) * planeWidth;
  const z = -(v - 0.5) * planeHeight;

  return { x, z };
}