// score-match.js
// PIEZA - coincidencia. Formula IDENTICA a scoreMatch() de la Caja de Pandora.
// Solo se adaptan los nombres de campo a los de la app nueva:
//   tempF->temperature_f, windMph->windspeed_mph, humidity->humidity_pct,
//   precip->precipitation_mm, windDir->wind_dir, venue->venueName
// Mismos pesos: 30, 25, 20, 10, direccion 10. No se inventa nada.
//
// PIEZA 1 (domo fijo): si el parque tiene roof "fixed_dome" (hoy solo Tropicana
// en estadios.js), el viento exterior NO entra al score, porque en un domo fijo
// el viento de afuera no toca la pelota. NO se inventa brisa interna: el viento
// simplemente no se evalua. Los retractables NO se tocan en esta pieza (Pieza 2).
//
// PIEZA AGREGADA 5 jul 2026: validacion de campos numericos. Si algun campo
// requerido (temperature_f, windspeed_mph, humidity_pct, precipitation_mm) no
// es un numero finito en 'today' o en 'h', esa comparacion no se puede hacer
// de forma real -- se devuelve score 0 en vez de dejar que Number(undefined)
// produzca NaN y arruine el promedio/top del llamador. No se inventa ningun
// valor de reemplazo, simplemente no se computa ese match.

function scoreMatch(today, h) {
  if (
    !Number.isFinite(Number(today.temperature_f)) ||
    !Number.isFinite(Number(h.temperature_f)) ||
    !Number.isFinite(Number(today.windspeed_mph)) ||
    !Number.isFinite(Number(h.windspeed_mph)) ||
    !Number.isFinite(Number(today.humidity_pct)) ||
    !Number.isFinite(Number(h.humidity_pct)) ||
    !Number.isFinite(Number(today.precipitation_mm)) ||
    !Number.isFinite(Number(h.precipitation_mm))
  ) {
    return 0;
  }

  let score = 0;

  // --- interruptor de domo fijo (lee roof de estadios.js, ya cargado antes) ---
  let vientoCuenta = true;
  if (today.venueName) {
    let s = null;
    if (typeof stadiumGet === "function") {
      s = stadiumGet(today.venueName);
    } else if (typeof STADIUM_INDEX !== "undefined") {
      s = STADIUM_INDEX.get(stadiumNorm(today.venueName));
    }
    if (s && s.roof === "fixed_dome") {
      vientoCuenta = false;
    }
  }

  const tempDiff   = Math.abs(Number(today.temperature_f)   - Number(h.temperature_f));
  const windDiff   = Math.abs(Number(today.windspeed_mph)   - Number(h.windspeed_mph));
  const humDiff    = Math.abs(Number(today.humidity_pct)    - Number(h.humidity_pct));
  const precipDiff = Math.abs(Number(today.precipitation_mm) - Number(h.precipitation_mm));

  score += Math.max(0, 30 - tempDiff);
  if (vientoCuenta) {
    score += Math.max(0, 25 - (windDiff * 2));
  }
  score += Math.max(0, 20 - (humDiff / 3));
  score += Math.max(0, 10 - (precipDiff * 10));

  // direccion del viento solo cuenta si es el MISMO parque (igual que tu app)
  // y solo si el viento cuenta (en domo fijo tampoco aplica la direccion)
  if (vientoCuenta && today.venueName && h.venueName) {
    let todayVenue = today.venueName;
    let histVenue = h.venueName;

    if (typeof stadiumCanonName === "function") {
      todayVenue = stadiumCanonName(todayVenue);
      histVenue = stadiumCanonName(histVenue);
    }

    if (stadiumNorm(todayVenue) === stadiumNorm(histVenue)) {
      const td = Number(today.wind_dir);
      const hd = Number(h.wind_dir);
      if (Number.isFinite(td) && Number.isFinite(hd)) {
        let dd = Math.abs(td - hd);
        if (dd > 180) dd = 360 - dd;
        score += Math.max(0, 10 - (dd / 18));
      }
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
