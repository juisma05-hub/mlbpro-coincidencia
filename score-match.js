// score-match.js
// PIEZA - coincidencia. Formula IDENTICA a scoreMatch() de la Caja de Pandora.
// Solo se adaptan los nombres de campo a los de la app nueva:
//   tempF->temperature_f, windMph->windspeed_mph, humidity->humidity_pct,
//   precip->precipitation_mm, windDir->wind_dir, venue->venueName
// Mismos pesos: 30, 25, 20, 10, direccion 10. No se inventa nada.

function scoreMatch(today, h) {
  let score = 0;

  const tempDiff   = Math.abs(Number(today.temperature_f)   - Number(h.temperature_f));
  const windDiff   = Math.abs(Number(today.windspeed_mph)   - Number(h.windspeed_mph));
  const humDiff    = Math.abs(Number(today.humidity_pct)    - Number(h.humidity_pct));
  const precipDiff = Math.abs(Number(today.precipitation_mm) - Number(h.precipitation_mm));

  score += Math.max(0, 30 - tempDiff);
  score += Math.max(0, 25 - (windDiff * 2));
  score += Math.max(0, 20 - (humDiff / 3));
  score += Math.max(0, 10 - (precipDiff * 10));

  // direccion del viento solo cuenta si es el MISMO parque (igual que tu app)
  if (today.venueName && h.venueName && today.venueName === h.venueName) {
    const td = Number(today.wind_dir);
    const hd = Number(h.wind_dir);
    if (Number.isFinite(td) && Number.isFinite(hd)) {
      let dd = Math.abs(td - hd);
      if (dd > 180) dd = 360 - dd;
      score += Math.max(0, 10 - (dd / 18));
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
