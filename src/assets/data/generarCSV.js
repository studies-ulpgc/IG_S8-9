import fs from 'fs';
import path from 'path';

// Los 21 municipios de Gran Canaria
const municipios = [
  { nombre: "Agaete", lat: 28.1001, lon: -15.7011 },
  { nombre: "Agüimes", lat: 27.9050, lon: -15.4460 },
  { nombre: "Artenara", lat: 28.0200, lon: -15.6470 },
  { nombre: "Arucas", lat: 28.1189, lon: -15.5230 },
  { nombre: "Firgas", lat: 28.1080, lon: -15.5630 },
  { nombre: "Gáldar", lat: 28.1470, lon: -15.6542 },
  { nombre: "Ingenio", lat: 27.9180, lon: -15.4350 },
  { nombre: "La Aldea de San Nicolás", lat: 27.9840, lon: -15.7810 },
  { nombre: "Las Palmas de Gran Canaria", lat: 28.1235, lon: -15.4363 },
  { nombre: "Mogán", lat: 27.8838, lon: -15.7252 },
  { nombre: "Moya", lat: 28.1110, lon: -15.5820 },
  { nombre: "San Bartolomé de Tirajana", lat: 27.9240, lon: -15.5730 },
  { nombre: "Santa Brígida", lat: 28.0330, lon: -15.4930 },
  { nombre: "Santa Lucía de Tirajana", lat: 27.9110, lon: -15.5410 },
  { nombre: "Santa María de Guía", lat: 28.1400, lon: -15.6330 },
  { nombre: "Tejeda", lat: 27.9958, lon: -15.6161 },
  { nombre: "Telde", lat: 27.9961, lon: -15.4162 },
  { nombre: "Teror", lat: 28.0592, lon: -15.5476 },
  { nombre: "Valleseco", lat: 28.0520, lon: -15.5750 },
  { nombre: "Valsequillo", lat: 27.9860, lon: -15.4970 },
  { nombre: "Vega de San Mateo", lat: 28.0080, lon: -15.5330 }
];

async function generarCSV() {
  console.log("Descargando datos climáticos desde Open-Meteo...");
  let csvContent = "municipio,lat,lon,hora,temp,codigo_clima,viento_vel,viento_dir\n";

  for (const m of municipios) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${m.lat}&longitude=${m.lon}&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m&forecast_days=1`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Open-Meteo respondió ${res.status}`);
      }
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