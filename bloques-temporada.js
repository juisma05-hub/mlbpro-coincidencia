// bloques-temporada.js
// PIEZA NUEVA - agrupa los juegos de un parque POR MES (bloque de temporada).
// Lee SOLO del cache (no jala en vivo). Funcion pura, no toca pantalla.
//
// Norte: no mezclar abril con julio. Cada parque dividido por mes, y por cada
// bloque se saca el promedio real (temp, viento, humedad, carreras) de ESE mes.
//
// Uso:
//   var cache = climaLeerCache();
//   var bloques = bloquesPorMes(cache, "Comerica Park");
//   -> devuelve un array de bloques, uno por mes, mas nuevo primero.

(function (global) {

  // nombre de mes corto en español, a partir de "MM"
  var MESES = {
    "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
    "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
  };

  // saca "YYYY-MM" de una fecha "YYYY-MM-DD". Si no puede, devuelve null.
  function clavaMes(date) {
    if (!date || typeof date !== "string" || date.length < 7) return null;
    // espera formato YYYY-MM-DD (asi se guarda y se compara en el resto de la app)
    return date.slice(0, 7); // "2026-06"
  }

  // etiqueta bonita "Jun 2026" -> pero mostramos corta sin abultar: "Jun"
  function etiquetaMes(claveMes) {
    if (!claveMes) return "MES NO CONFIRMADO";
    var mm = claveMes.slice(5, 7);
    return MESES[mm] || mm;
  }

  // promedio seguro de una lista de numeros (ignora null/undefined/NaN)
  function prom(arr) {
    var s = 0, n = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v !== null && v !== undefined && v !== "" && !isNaN(Number(v))) {
        s += Number(v); n++;
      }
    }
    return n > 0 ? (s / n) : null;
  }

  function minMax(arr) {
    var mn = null, mx = null;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v === null || v === undefined || v === "" || isNaN(Number(v))) continue;
      v = Number(v);
      if (mn === null || v < mn) mn = v;
      if (mx === null || v > mx) mx = v;
    }
    return { min: mn, max: mx };
  }

  // Agrupa los juegos de UN parque por mes.
  // venue: nombre del parque (ej "Comerica Park"). Si se omite, agrupa TODO el cache.
  function bloquesPorMes(cache, venue) {
    if (!Array.isArray(cache)) return [];

    // 1) filtra por parque (si se pidio uno)
    var juegos = cache.filter(function (g) {
      if (!g) return false;
      if (!venue) return true;
      // compara por venue tal cual viene en el cache
      return g.venue === venue;
    });

    // 2) agrupa por clave de mes
    var mapa = {}; // "2026-06" -> { juegos:[...] }
    for (var i = 0; i < juegos.length; i++) {
      var g = juegos[i];
      var cm = clavaMes(g.date);
      if (!cm) continue; // sin fecha valida, no entra
      if (!mapa[cm]) mapa[cm] = [];
      mapa[cm].push(g);
    }

    // 3) por cada mes, saca los promedios
    var bloques = [];
    for (var clave in mapa) {
      if (!mapa.hasOwnProperty(clave)) continue;
      var lista = mapa[clave];

      var temps = [], vientos = [], hums = [], carreras = [];
      for (var j = 0; j < lista.length; j++) {
        var x = lista[j];
        temps.push(x.temperature_f);
        vientos.push(x.windspeed_mph);
        hums.push(x.humidity_pct);
        var ar = x.away_runs, hr = x.home_runs;
        if (ar !== null && ar !== undefined && hr !== null && hr !== undefined) {
          carreras.push(Number(ar) + Number(hr));
        }
      }

      var t = minMax(temps);
      var pt = prom(temps);
      var pc = prom(carreras);

      bloques.push({
        clave_mes: clave,                 // "2026-06"
        etiqueta: etiquetaMes(clave),     // "Jun"
        n_juegos: lista.length,
        n_con_marcador: carreras.length,
        temp_min: t.min,
        temp_max: t.max,
        temp_prom: pt !== null ? Number(pt.toFixed(1)) : null,
        viento_prom: prom(vientos) !== null ? Number(prom(vientos).toFixed(1)) : null,
        humedad_prom: prom(hums) !== null ? Number(prom(hums).toFixed(0)) : null,
        carreras_prom: pc !== null ? Number(pc.toFixed(1)) : null
      });
    }

    // 4) ordena de mas nuevo a mas viejo
    bloques.sort(function (a, b) {
      return a.clave_mes < b.clave_mes ? 1 : (a.clave_mes > b.clave_mes ? -1 : 0);
    });

    return bloques;
  }

  // devuelve el bloque del mes de una fecha dada (para el juego de hoy)
  function bloqueDelMes(cache, venue, fechaHoy) {
    var cm = clavaMes(fechaHoy);
    if (!cm) return null;
    var todos = bloquesPorMes(cache, venue);
    for (var i = 0; i < todos.length; i++) {
      if (todos[i].clave_mes === cm) return todos[i];
    }
    return null;
  }

  // exponer
  global.bloquesPorMes = bloquesPorMes;
  global.bloqueDelMes = bloqueDelMes;

})(window);
