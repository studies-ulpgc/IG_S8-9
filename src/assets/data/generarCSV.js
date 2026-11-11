import fs from 'fs';
import path from 'path';
import { municipiosCoords } from '../../municipios.js';

async function generarCSV() {
  console.log("Descargando historial climático (últimos 90 días) desde Open-Meteo...");
  let csvContent = "municipio,lat,lon,fecha,hora,temp,codigo_clima,viento_vel,viento_dir\n";

  for (const m of municipiosCoords) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m&past_days=90&forecast_days=1`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
      const data = await res.json();
      
      const hourly = data.hourly;
      for (let i = 0; i < hourly.time.length; i++) {
        const dateObj = new Date(hourly.time[i]);
        const fecha = dateObj.toISOString().split('T')[0];
        const hora = dateObj.getHours();
        const temp = hourly.temperature_2m[i];
        const code = hourly.weathercode[i];
        const windSpeed = hourly.windspeed_10m[i];
        const windDir = hourly.winddirection_10m[i];

        csvContent += `"${m.municipio}",${m.lat},${m.lon},"${fecha}",${hora},${temp},${code},${windSpeed},${windDir}\n`;
      }
      console.log(`✓ Procesado: ${m.municipio}`);
    } catch (err) {
      console.error(`Error procesando ${m.municipio}:`, err);
    }
  }

  const outputPath = path.join(process.cwd(), 'src', 'assets', 'data', 'climaData.csv');
  fs.writeFileSync(outputPath, csvContent);
  console.log(`\n¡CSV histórico generado con éxito en ${outputPath}!`);
}

generarCSV();