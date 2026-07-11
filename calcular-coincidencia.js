// calcular-coincidencia.js
//
// RUTA: Pieza de cálculo que compara el juego de hoy contra el histórico
//   ya guardado, dentro de la cadena de Coincidencia (no toca la cadena de
//   captura de datos, solo la de comparación/score).
//
// RECIBE DE: clima-cache.js (climaLeerCache, climaHoyISO), estadios.js
//   (stadiumGet), score-match.js (scoreMatch), y el objeto "today" (clima
//   del juego de hoy: venueName, temperature_f, etc.) que le pasa quien la
//   invoque (index.html / Over-Under).
//
// ENTREGA A: Coincidencia, index.html, Over/Under.
//
// NO TOCA: K6, F5, Moneyline. No escribe caché, no toca localStorage, no
//   escribe Data Madre.
//
// REGLA MADRE: El juego de hoy nunca entra como histórico. Solo se compara
//   contra el mismo parque MAESTRO (mismo stadiumGet().venue). SIN_DATOS
//   no equivale a 0%: la ausencia de histórico válido, de parque
//   coincidente, de dependencias o de score calculable se devuelve como
//   estado explícito, nunca como score cero disfrazado.
//
// DEPENDENCIAS OBLIGATORIAS: climaLeerCache(), climaHoyISO(),
//   stadiumGet(), scoreMatch() deben existir como funciones; si falta
//   alguna, DEPENDENCIA_FALTANTE nombra exactamente cuál(es).
//
// SALIDA: objeto { top, ranked, cls, estado, base_score_intentada,
//   base_score_valida, base_usada, cache_total_leido, mismo_parque,
//   final_con_carreras, nota? }. estado=null indica éxito; cualquier otro
//   valor (ENTRADA_INVALIDA, DEPENDENCIA_FALTANTE, VENUE_HOY_NO_RECONOCIDO,
//   CACHE_INVALIDO, SIN_CACHE, SIN_HISTORICO_MISMO_PARQUE,
//   FECHA_HOY_INVALIDA, SIN_HISTORICO_VALIDO_MISMO_PARQUE,
//   SCORE_SIN_DATOS) indica por qué top/ranked quedan vacíos.
//
// SI ESTE ARCHIVO FALLA: Coincidencia, index.html y Over/Under se quedan
//   sin score de coincidencia climática para el juego de hoy (deben tratar
//   estado != null como "sin pick", nunca como score 0).
//
// HISTORIAL: eliminado el fallback a otro parque cuando no había histórico
//   del mismo venue (SIN_HISTORICO_MISMO_PARQUE); comparación de parque
//   vía objetos reales de stadiumGet(); baseFiltrada exige fecha real,
//   Final y carreras finitas (SIN_HISTORICO_VALIDO_MISMO_PARQUE);
//   validación de entrada/dependencias (ENTRADA_INVALIDA,
//   DEPENDENCIA_FALTANTE nombrando la función exacta); Array.isArray(hist)
//   (CACHE_INVALIDO); fechaISOValida() en vez de new Date() (que normaliza
//   fechas imposibles como "2026-02-30"); scoreMatch() en try/catch
//   (SCORE_SIN_DATOS sin tumbar la función); validación del parque de HOY
//   antes de leer el histórico (VENUE_HOY_NO_RECONOCIDO); y
//   base_score_intentada / base_score_valida / base_usada como tres
//   métricas separadas. Fórmula, pesos y lógica de Coincidencia sin
//   cambios en todo el proceso. APROBADO tras batería de pruebas (11 jul
//   2026).

function mismoParqueCanon(todayVenueRaw, histVenueRaw) {
  if (typeof stadiumGet !== "function") {
    return false; // sin validador real, no se puede confirmar parque
  }
  const todayStadium = stadiumGet(todayVenueRaw);
  const histStadium = stadiumGet(histVenueRaw);
  if (!todayStadium || !histStadium) return false; // parque no reconocido
  return todayStadium.venue === histStadium.venue;
}

// Valida que una fecha "YYYY-MM-DD" sea una fecha REAL, no una que
// Date() haya normalizado (ej. "2026-02-30" -> 2026-03-02).
function fechaISOValida(iso) {
  if (typeof iso !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;

  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);

  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime())) return false;

  return dt.getUTCFullYear() === y &&
    (dt.getUTCMonth() + 1) === mo &&
    dt.getUTCDate() === d;
}

function calcularCoincidencia(today) {
  // Validacion de entrada: sin esto no hay nada que comparar.
  if (!today || typeof today !== "object" ||
      typeof today.venueName !== "string" || !today.venueName.trim()) {
    return {
      top: null,
      ranked: [],
      estado: "ENTRADA_INVALIDA",
      nota: "ENTRADA_INVALIDA: falta 'today' o 'today.venueName'",
      cache_total_leido: 0,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  // Validacion de dependencias: nombra exactamente cual falta.
  const faltantes = [];
  if (typeof climaLeerCache !== "function") faltantes.push("climaLeerCache");
  if (typeof climaHoyISO !== "function") faltantes.push("climaHoyISO");
  if (typeof stadiumGet !== "function") faltantes.push("stadiumGet");
  if (typeof scoreMatch !== "function") faltantes.push("scoreMatch");

  if (faltantes.length > 0) {
    return {
      top: null,
      ranked: [],
      estado: "DEPENDENCIA_FALTANTE",
      nota: "DEPENDENCIA_FALTANTE: " + faltantes.join(", ") + " no disponible" + (faltantes.length > 1 ? "s" : ""),
      cache_total_leido: 0,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  // Validar el parque de HOY antes de leer el historico.
  const todayStadium = stadiumGet(today.venueName);
  if (!todayStadium) {
    return {
      top: null,
      ranked: [],
      estado: "VENUE_HOY_NO_RECONOCIDO",
      nota: "VENUE_HOY_NO_RECONOCIDO: stadiumGet(today.venueName) devolvio null",
      cache_total_leido: 0,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  const hist = climaLeerCache();

  if (!Array.isArray(hist)) {
    return {
      top: null,
      ranked: [],
      estado: "CACHE_INVALIDO",
      nota: "CACHE_INVALIDO: climaLeerCache() no devolvio un array",
      cache_total_leido: 0,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  const cacheTotalLeido = hist.length;

  if (hist.length === 0) {
    return {
      top: null,
      ranked: [],
      estado: "SIN_CACHE",
      nota: "SIN CACHE - jala primero el historico",
      cache_total_leido: cacheTotalLeido,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  // Excluir registros nulos o sin venue ANTES del filtro de mismo parque.
  const histValido = hist.filter(function (h) {
    return !!(h && h.venue);
  });

  // Solo historico del MISMO parque maestro. Sin fallback a otros parques.
  const mismoParque = histValido.filter(function (h) {
    return mismoParqueCanon(today.venueName, h.venue);
  });

  if (mismoParque.length === 0) {
    return {
      top: null,
      ranked: [],
      estado: "SIN_HISTORICO_MISMO_PARQUE",
      nota: "SIN_HISTORICO_MISMO_PARQUE",
      cache_total_leido: cacheTotalLeido,
      mismo_parque: 0,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  const hoyISO = climaHoyISO();

  if (!fechaISOValida(hoyISO)) {
    return {
      top: null,
      ranked: [],
      estado: "FECHA_HOY_INVALIDA",
      nota: "FECHA_HOY_INVALIDA: climaHoyISO() no devolvio una fecha valida",
      cache_total_leido: cacheTotalLeido,
      mismo_parque: mismoParque.length,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  // solo juegos con fecha REAL, anteriores a hoy, Final, con carreras
  // numericas y finitas.
  const baseFiltrada = mismoParque.filter(function(h){
    return fechaISOValida(h.date) && h.date < hoyISO &&
      h.status === "Final" &&
      typeof h.home_runs === "number" && Number.isFinite(h.home_runs) &&
      typeof h.away_runs === "number" && Number.isFinite(h.away_runs);
  });

  if (baseFiltrada.length === 0) {
    return {
      top: null,
      ranked: [],
      estado: "SIN_HISTORICO_VALIDO_MISMO_PARQUE",
      nota: "SIN_HISTORICO_VALIDO_MISMO_PARQUE",
      cache_total_leido: cacheTotalLeido,
      mismo_parque: mismoParque.length,
      final_con_carreras: 0,
      base_usada: 0
    };
  }

  // mapear cada historico con su score (tu logica linea 401-404)
  // scoreMatch() va envuelta en try/catch: un registro que truene no debe
  // tumbar el resto de Coincidencia, solo queda fuera del ranking.
  const rankedCrudo = baseFiltrada
    .map(function (h) {
      const hAdaptado = {
        temperature_f: h.temperature_f,
        windspeed_mph: h.windspeed_mph,
        humidity_pct: h.humidity_pct,
        precipitation_mm: h.precipitation_mm,
        wind_dir: h.wind_dir,
        venueName: h.venue
      };

      let score;
      try {
        score = scoreMatch(today, hAdaptado);
      } catch (errScore) {
        score = NaN;
      }

      return { registro: h, score: score };
    });

  // Solo entran al ranking los registros con score numerico finito.
  const rankedValido = rankedCrudo.filter(function (r) {
    return typeof r.score === "number" && Number.isFinite(r.score);
  });

  if (rankedValido.length === 0) {
    return {
      top: null,
      ranked: [],
      estado: "SCORE_SIN_DATOS",
      nota: "SCORE_SIN_DATOS",
      cache_total_leido: cacheTotalLeido,
      mismo_parque: mismoParque.length,
      final_con_carreras: baseFiltrada.length,
      base_usada: 0,
      base_score_intentada: baseFiltrada.length
    };
  }

  const ranked = rankedValido
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 5)
    .map(function (r) { return Object.assign({}, r.registro, { score: r.score }); });

  const top = ranked[0] || null;
  const cls = top && top.score >= 80 ? "ok" : (top && top.score >= 60 ? "mid" : "bad");

  return {
    top: top,
    ranked: ranked,
    cls: cls,
    estado: null,

    // Tres numeros distintos: cuantos se intentaron puntuar, cuantos
    // dieron score valido, y cuantos quedaron realmente en el ranking
    // final (top 5). Ya no se reporta un solo "base_usada" ambiguo.
    base_score_intentada: baseFiltrada.length,
    base_score_valida: rankedValido.length,
    base_usada: ranked.length,

    // diagnostico de cache (agregado, no altera la logica de arriba)
    cache_total_leido: cacheTotalLeido,
    mismo_parque: mismoParque.length,
    final_con_carreras: baseFiltrada.length
  };
}

if (typeof module !== "undefined") { module.exports = { calcularCoincidencia, mismoParqueCanon, fechaISOValida }; }
