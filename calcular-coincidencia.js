// calcular-coincidencia.js
// PIEZA - calcula la coincidencia de UN juego de hoy contra el cache.
// Usa scoreMatch (score-match.js) y el cache (clima-cache.js).
// Replica tu logica: mapear con score, ordenar mayor a menor, top 5.
// today = objeto clima del juego de hoy (con temperature_f, venueName, etc.)

function calcularCoincidencia(today) {
  const hist = climaLeerCache();
  if (!hist || hist.length === 0) {
    return { top: null, ranked: [], nota: "SIN CACHE - jala primero el historico" };
  }

  // mismo parque primero: filtra historicos del mismo venue si los hay
  const mismoParque = hist.filter(function (h) {
    var todayVenue = today.venueName || "";
    var histVenue = h.venue || "";

    if (typeof stadiumCanonName === "function") {
      todayVenue = stadiumCanonName(todayVenue);
      histVenue = stadiumCanonName(histVenue);
    }

    return todayVenue && histVenue && stadiumNorm(todayVenue) === stadiumNorm(histVenue);
  });
  const base = mismoParque.length > 0 ? mismoParque : hist;

  // solo juegos Final con carreras reales (excluye hoy y sin marcador)
  const baseFiltrada = base.filter(function(h){
    return h.status === "Final" && h.home_runs !== null && h.home_runs !== undefined;
  });

  // mapear cada historico con su score (tu logica linea 401-404)
  const ranked = baseFiltrada
    .map(function (h) {
      const hAdaptado = {
        temperature_f: h.temperature_f,
        windspeed_mph: h.windspeed_mph,
        humidity_pct: h.humidity_pct,
        precipitation_mm: h.precipitation_mm,
        wind_dir: h.wind_dir,
        venueName: h.venue
      };
      return { ...h, score: scoreMatch(today, hAdaptado) };
    })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 5);

  const top = ranked[0] || null;
  const cls = top && top.score >= 80 ? "ok" : (top && top.score >= 60 ? "mid" : "bad");

  return { top: top, ranked: ranked, cls: cls, base_usada: baseFiltrada.length };
}
