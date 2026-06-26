// venideros-pronostico.js
// PIEZA - trae temperatura PRONOSTICADA (Open-Meteo) por estadio (lat/lon de
// estadios.js) y la mete a cada juego del bloque venidero como temperature_f.
// Forecast directo a Open-Meteo (no historico). Daily max temp en °F.
// No inventa: si no hay pronostico para esa fecha, el juego queda temperature_f="".

async function pronosticoVenideros(bloques, logFn) {
  function log(t){ if (typeof logFn === "function") logFn(t); }

  // cache por estadio para no repetir llamadas del mismo parque
  var porParque = {};

  for (var i = 0; i < bloques.length; i++) {
    var b = bloques[i];
    var s = STADIUM_INDEX.get(stadiumNorm(b.venue));
    if (!s) { log("SIN COORDS: " + b.venue); continue; }

    var key = s.lat + "," + s.lon;
    if (!porParque[key]) {
      try {
        var url = "https://api.open-meteo.com/v1/forecast" +
          "?latitude=" + s.lat + "&longitude=" + s.lon +
          "&daily=temperature_2m_max&temperature_unit=fahrenheit" +
          "&timezone=" + encodeURIComponent(s.timezone) +
          "&forecast_days=7";
        var res = await fetch(url);
        if (!res.ok) throw new Error("OPENMETEO HTTP " + res.status);
        var data = await res.json();
        var mapa = {};
        if (data.daily && data.daily.time) {
          for (var k = 0; k < data.daily.time.length; k++) {
            mapa[data.daily.time[k]] = data.daily.temperature_2m_max[k];
          }
        }
        porParque[key] = mapa;
        log("Pronostico " + b.venue + ": " + data.daily.time.length + " dias");
      } catch (err) {
        porParque[key] = { error: err.message };
        log("FALLO pronostico " + b.venue + ": " + err.message);
      }
    }

    var mapaParque = porParque[key];
    b.juegos.forEach(function (g) {
      if (mapaParque && !mapaParque.error && mapaParque[g.date] !== undefined) {
        g.temperature_f = mapaParque[g.date];
      } else {
        g.temperature_f = "";
      }
    });
  }

  return bloques;
}
