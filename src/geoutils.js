export function latLonToVector3(lat, lon) {
  const minLon = -15.86; 
  const maxLon = -15.32; 
  const minLat = 27.70;  
  const maxLat = 28.21;  

  const PLANE_WIDTH = 180;
  const PLANE_HEIGHT = 108;

  const zoomFactorZ = 0.81; 

  const pctX = (lon - minLon) / (maxLon - minLon);
  const pctZ = (maxLat - lat) / (maxLat - minLat);

  const offsetX = -13.0; 
  const offsetZ = -5.0;

  const x = (pctX - 0.5) * PLANE_WIDTH * zoomFactorX + offsetX;
  const z = (pctZ - 0.5) * PLANE_HEIGHT * zoomFactorZ + offsetZ;
  const y = 14; 

  return new THREE.Vector3(x, y, z);
}
