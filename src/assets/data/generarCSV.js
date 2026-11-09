import fs from 'fs';
import path from 'path';

// Municipios clave de Gran Canaria con sus coordenadas
const municipios = [
  { nombre: "Las Palmas", lat: 28.1235, lon: -15.4363 },
  { nombre: "Telde", lat: 27.9961, lon: -15.4162 },
  { nombre: "Maspalomas", lat: 27.7606, lon: -15.5860 },
  { nombre: "Mogán", lat: 27.8838, lon: -15.7252 },
  { nombre: "Agaete", lat: 28.1001, lon: -15.7011 },
  { nombre: "Gáldar", lat: 28.1470, lon: -15.6542 },
  { nombre: "Arucas", lat: 28.1189, lon: -15.5230 },
  { nombre: "Tejeda", lat: 27.9958, lon: -15.6161 },
  { nombre: "Teror", lat: 28.0592, lon: -15.5476 }
];

async function generarCSV() {
  console.log("Descargando datos climáticos desde Open-Meteo...");
  let csvContent = "municipio,lat,lon,hora,temp,codigo_clima,viento_vel,viento_dir\n";

  for (const m of municipios) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m&forecast_days=1`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      const hourly = data.hourly;
      for (let i = 0; i < hourly.time.length; i++) {
        const hora = new Date(hourly.time[i]).getHours();
        const temp = hourly.temperature_2m[i];
        const code = hourly.weathercode[i];
        const windSpeed = hourly.windspeed_10m[i];
        const windDir = hourly.winddirection_10m[i];

        csvContent += `"${m.nombre}",${m.lat},${m.lon},${hora},${temp},${code},${windSpeed},${windDir}\n`;
      }
    } catch (err) {
      console.error(`Error procesando ${m.nombre}:`, err);
    }
  }

  const outputPath = path.join(process.cwd(), 'src', 'assets', 'data', 'climaData.csv');
  fs.writeFileSync(outputPath, csvContent);
  console.log(`¡CSV generado con éxito en ${outputPath}!`);
}

generarCSV();