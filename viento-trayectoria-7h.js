// viento-trayectoria-7h.js
// MÓDULO INDEPENDIENTE — NO se conecta todavía a index.html, jalar-clima.js,
// clima-cache.js, casar-series-test.html ni a la lógica F5 existente.
//
// v2 — corrige lo que Perez señaló sobre la v1:
//   1) Ya NO se usa climaBuscarHoraCercana() para el respaldo horario.
//      Motivo: esa función solo devuelve el VALOR encontrado, no la
//      CLAVE horaria que usó. Sin la clave no se puede calcular
//      desfaseMinutos ni evitar que dos offsets distintos (ej. +1 y +2)
//      terminen apuntando a la misma lectura real. Por eso este archivo
//      implementa su propia búsqueda de respaldo, acotada, directamente
//      sobre el mismo Map que entrega climaFetchWeather, generando cada
//      clave candidata con climaKeyTZ (la misma función real, reutilizada
//      tal cual) — así siempre se sabe exactamente qué hora se usó.
//   2) F5 ahora distingue F5_REAL (cuando se conoce horaFinF5UTC real)
//      de F5_PROYECTADO (cuando no se conoce y se usa un respaldo
//      heurístico) — nunca se afirma que el F5 "terminó" en +2 o +3 si
//      no hay un dato real de cierre.
//   3) Comentario de efecto de parque corregido (estaba invertido en el
//      resumen de una línea; la lógica de cálculo ya era correcta).
//   4) Cada hora ahora expone AMBAS direcciones por separado, sin
//      renombrar ni perder el dato original:
//        windFromDeg / windFromCardinal  = de dónde viene (wind_dir tal cual)
//        windToDeg   / windToCardinal    = hacia dónde empuja (wind_dir+180)
//
// ───────────────────────────────────────────────────────────────
// QUÉ REUTILIZA (funciones y campos REALES, confirmados leyendo
// jalar-clima.js — ninguno inventado):
//
//   - climaFetchWeather(stadium, start, end)
//       Confirmado en jalar-clima.js. Devuelve un Map consultable con
//       .get(clave). Su cuerpo no se pudo leer en esta sesión (vive
//       fuera de jalar-clima.js). Se usa tal cual, sin modificarla.
//       NO_CONFIRMADO: si cubre fechas futuras (jalarClima() solo la
//       usa con end = climaHoyISO()).
//
//   - climaKeyTZ(gameDateUTC_ISO, timezone)
//       Confirmado en jalar-clima.js: convierte una fecha UTC a la
//       llave horaria local del estadio. Es la función del fix del bug
//       de costa oeste (comentario "CORREGIDO 9 jul 2026"). Se reutiliza
//       llamándola una vez por cada uno de los 7 offsets (y, si el
//       respaldo está permitido, también para las claves candidatas
//       cercanas) — nunca se reimplementa la conversión de zona horaria.
//
//   - Campos horarios reales confirmados: wind_dir, windspeed_mph,
//     temperature_f, humidity_pct, precipitation_mm.
//     wind_dir = dirección METEOROLÓGICA DE ORIGEN = de dónde viene el
//     viento (confirmado por el uso idéntico en casar-series-test.html,
//     brujula-parque-test.html, parques-orientacion.js y
//     rellenar-viento.html — en NINGUNO de esos archivos se invierte).
//     Este módulo NUNCA sobreescribe wind_dir: lo expone como
//     windFromDeg y calcula aparte windToDeg = (wind_dir + 180) % 360.
//
//   - stadiumNorm(venue) / STADIUM_INDEX (de estadios.js)
//   - getOrientacionParque(venue) → {hpACF} (de parques-orientacion.js)
//       hpACF = grados de home plate hacia jardín central.
//
// QUÉ NO HACE:
//   - No llama fetch() directo a ninguna API de clima.
//   - No mezcla clima con carreras/carreraje.
//   - No decide Over/Under ni clasifica ofensivamente (eso es F5 real).
//   - No usa climaBuscarHoraCercana() (ver punto 1 arriba).
//   - No reutiliza la misma lectura horaria real para dos offsets.
//
// SCRIPTS QUE DEBE TENER CARGADOS LA PÁGINA QUE USE ESTE MÓDULO:
//   <script src="estadios.js"></script>
//   <script src="clima-cache.js"></script>        (climaFetchWeather, climaKeyTZ)
//   <script src="parques-orientacion.js"></script> (getOrientacionParque)
//   <script src="viento-trayectoria-7h.js"></script>

(function () {
  "use strict";

  // ───────────────────────────────────────────────────────────────
  // CONFIG
  // ───────────────────────────────────────────────────────────────
  var VIENTO_TRAYECTORIA_CONFIG = {
    giroEstableMax: 30,
    giroOscilanteMax: 90,
    velocidadImpactoMin: 5, // mph. Debajo de esto, un giro fuerte no cuenta como impacto ALTO.
    offsets: [-2, -1, 0, 1, 2, 3, 4],

    // Respaldo horario (punto 1 de la corrección): APAGADO por default.
    // Solo se activa si quien llama lo pide explícitamente
    // (opciones.permitirHoraAproximada = true), y aun así queda acotado
    // a maxHorasRespaldo horas de diferencia como máximo, probando de
    // 1 en 1 hora hacia adelante y hacia atrás (mismo patrón que ya usa
    // el repo en rellenar-viento.html: offsets 1,-1,2,-2,3,-3, pero aquí
    // limitado y con trazabilidad completa de qué hora se usó).
    permitirHoraAproximadaPorDefecto: false,
    maxHorasRespaldo: 2,

    // F5: si no hay horaFinF5UTC real, el respaldo heurístico llega hasta
    // este offset (y hasta f5OffsetMaxSiEnDesarrollo si quien llama
    // declara explícitamente f5AunEnDesarrollo:true). Nunca se presenta
    // esto como el cierre real del F5 — ver estado F5_PROYECTADO.
    f5OffsetMaxRespaldo: 2,
    f5OffsetMaxSiEnDesarrollo: 3
  };

  // ───────────────────────────────────────────────────────────────
  // Utilidades de ángulo
  // ───────────────────────────────────────────────────────────────
  function calcularGiroAngular(deg1, deg2) {
    if (deg1 === null || deg1 === undefined || deg2 === null || deg2 === undefined) return null;
    if (isNaN(deg1) || isNaN(deg2)) return null;
    var d = ((Number(deg2) - Number(deg1) + 540) % 360) - 180;
    return d;
  }

  function cardinalDe(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return "NO_CONFIRMADO";
    var nombres = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    var idx = Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16;
    return nombres[idx];
  }

  // wind_dir = de dónde VIENE el viento. La dirección de empuje real
  // (hacia dónde SE MUEVE el aire) es siempre wind_dir + 180.
  //   Caso 1: wind_dir=270 (viene del Oeste)  -> vaHacia=90  (va hacia el Este)
  //   Caso 2: wind_dir=0   (viene del Norte)  -> vaHacia=180 (va hacia el Sur)
  //   Caso 3: wind_dir=180 (viene del Sur)    -> vaHacia=0   (va hacia el Norte)
  function calcularVaHacia(windFromDeg) {
    if (windFromDeg === null || windFromDeg === undefined || isNaN(windFromDeg)) return null;
    return (Number(windFromDeg) + 180) % 360;
  }

  // ───────────────────────────────────────────────────────────────
  // Efecto de parque.
  //   OUT = el viento SOPLA DESDE home plate HACIA los jardines
  //         (windToDeg cerca de hpACF) -> favorece los batazos, empuja
  //         la bola hacia afuera del parque.
  //   IN  = el viento SOPLA DESDE los jardines HACIA home plate
  //         (windToDeg cerca de hpACF + 180°) -> frena los batazos.
  //   CROSS = queda aproximadamente perpendicular a la línea home->CF.
  //   NEUTRAL = sin dato de orientación del parque, o viento casi calmo
  //             (la dirección deja de ser confiable como impacto).
  //
  // La comparación SIEMPRE se hace con windToDeg (la dirección de
  // empuje), nunca con windFromDeg directo contra hpACF.
  // ───────────────────────────────────────────────────────────────
  function calcularEfectoParque(windFromDeg, hpACF, velocidadMph, config) {
    if (windFromDeg === null || windFromDeg === undefined || isNaN(windFromDeg)) return "NEUTRAL";
    if (hpACF === null || hpACF === undefined || isNaN(hpACF)) return "NEUTRAL"; // NO_CONFIRMADO: sin orientación no se puede clasificar
    if (typeof velocidadMph === "number" && velocidadMph < 2) return "NEUTRAL"; // viento casi calmo

    var vaHacia = calcularVaHacia(windFromDeg);
    var diff = Math.abs(((vaHacia - Number(hpACF) + 540) % 360) - 180); // 0-180

    if (diff <= 45) return "OUT";
    if (diff >= 135) return "IN";
    return "CROSS";
  }

  // ───────────────────────────────────────────────────────────────
  // Búsqueda de respaldo ACOTADA y TRAZABLE (reemplaza climaBuscarHoraCercana).
  // Prueba, de 1 en 1 hora, hasta maxHorasRespaldo horas hacia adelante
  // y hacia atrás, reutilizando climaKeyTZ para cada candidata. Nunca
  // devuelve una clave que ya esté en usedKeys.
  // ───────────────────────────────────────────────────────────────
  function buscarLecturaAproximada(gameMsBase, offsetHoras, stadium, mapaClima, usedKeys, maxHorasRespaldo) {
    var candidatos = [];
    for (var d = 1; d <= maxHorasRespaldo; d++) {
      candidatos.push(d);
      candidatos.push(-d);
    }
    for (var i = 0; i < candidatos.length; i++) {
      var deltaHoras = candidatos[i];
      var isoCandidato = new Date(gameMsBase + (offsetHoras + deltaHoras) * 3600000).toISOString();
      var claveCandidata = climaKeyTZ(isoCandidato, stadium.timezone);
      if (usedKeys.has(claveCandidata)) continue;
      var hit = mapaClima.get(claveCandidata);
      if (hit && typeof hit.wind_dir === "number" && !isNaN(hit.wind_dir)) {
        return { hit: hit, claveUsada: claveCandidata, desfaseMinutos: Math.abs(deltaHoras) * 60 };
      }
    }
    return null;
  }

  // ───────────────────────────────────────────────────────────────
  // Construye las 7 lecturas horarias (-2 a +4).
  //
  // opciones:
  //   permitirHoraAproximada (boolean, default = config.permitirHoraAproximadaPorDefecto)
  //   maxHorasRespaldo (número, default = config.maxHorasRespaldo)
  // ───────────────────────────────────────────────────────────────
  function getHorasJuego(gameDateUTC, stadium, mapaClima, hpACF, config, opciones) {
    var cfg = config || VIENTO_TRAYECTORIA_CONFIG;
    opciones = opciones || {};
    var permitirAprox = (opciones.permitirHoraAproximada !== undefined) ? opciones.permitirHoraAproximada : cfg.permitirHoraAproximadaPorDefecto;
    var maxHorasRespaldo = (opciones.maxHorasRespaldo !== undefined) ? opciones.maxHorasRespaldo : cfg.maxHorasRespaldo;

    var horas = [];

    if (!gameDateUTC || !stadium || !stadium.timezone) {
      cfg.offsets.forEach(function (offset) {
        horas.push({
          offset: offset,
          horaSolicitada: "NO_CONFIRMADO", horaUsada: null, desfaseMinutos: null, esAproximada: false,
          windFromDeg: null, windFromCardinal: "NO_CONFIRMADO",
          windToDeg: null, windToCardinal: "NO_CONFIRMADO",
          velocidadMph: null, efectoParque: "NEUTRAL",
          motivo: "sin gameDateUTC o sin timezone del estadio"
        });
      });
      return horas;
    }

    if (typeof climaKeyTZ !== "function") {
      throw new Error("climaKeyTZ no está cargada. Este módulo requiere clima-cache.js en la página.");
    }

    var gameMs = new Date(gameDateUTC).getTime();
    if (isNaN(gameMs)) throw new Error("gameDateUTC inválido: " + gameDateUTC);

    var usedKeys = new Set();

    // ── PASADA 1: reservar TODOS los matches exactos primero, sin
    // importar el orden de los offsets. Esto evita que el respaldo de
    // un offset "robe" la hora exacta que le correspondía a otro offset
    // que aún no se había procesado (bug real detectado en pruebas: -2
    // le robaba a 0 su propia hora exacta antes de que 0 la reclamara). ──
    var claveSolicitadaPorOffset = {};
    var asignacion = {}; // offset -> { hit, claveUsada, esAproximada, desfaseMinutos }

    cfg.offsets.forEach(function (offset) {
      var isoDesplazado = new Date(gameMs + offset * 3600000).toISOString();
      var claveSolicitada = climaKeyTZ(isoDesplazado, stadium.timezone);
      claveSolicitadaPorOffset[offset] = claveSolicitada;

      var hitExacto = (mapaClima && typeof mapaClima.get === "function") ? mapaClima.get(claveSolicitada) : null;
      if (hitExacto && typeof hitExacto.wind_dir === "number" && !isNaN(hitExacto.wind_dir)) {
        asignacion[offset] = { hit: hitExacto, claveUsada: claveSolicitada, esAproximada: false, desfaseMinutos: 0 };
        usedKeys.add(claveSolicitada);
      }
    });

    // ── PASADA 2: solo para offsets sin match exacto, y solo si el
    // respaldo fue pedido explícitamente. usedKeys ya tiene reservadas
    // TODAS las horas exactas de la pasada 1, así que el respaldo nunca
    // puede pisar una hora que otro offset necesitaba de forma exacta. ──
    cfg.offsets.forEach(function (offset) {
      if (asignacion[offset]) return; // ya tiene match exacto
      if (!permitirAprox || !mapaClima) return;
      var aprox = buscarLecturaAproximada(gameMs, offset, stadium, mapaClima, usedKeys, maxHorasRespaldo);
      if (aprox) {
        asignacion[offset] = { hit: aprox.hit, claveUsada: aprox.claveUsada, esAproximada: true, desfaseMinutos: aprox.desfaseMinutos };
        usedKeys.add(aprox.claveUsada);
      }
    });

    cfg.offsets.forEach(function (offset) {
      var claveSolicitada = claveSolicitadaPorOffset[offset];
      var asig = asignacion[offset];

      if (!asig) {
        var huboExactoEnMapa = mapaClima && typeof mapaClima.get === "function" && mapaClima.get(claveSolicitada);
        var motivo = !permitirAprox
          ? (huboExactoEnMapa ? "único match disponible ya usado por otro offset" : "sin dato exacto para esta hora (respaldo desactivado)")
          : "sin dato exacto ni cercano dentro de " + maxHorasRespaldo + "h (o ya usado por otro offset)";
        horas.push({
          offset: offset,
          horaSolicitada: claveSolicitada, horaUsada: null, desfaseMinutos: null, esAproximada: false,
          windFromDeg: null, windFromCardinal: "NO_CONFIRMADO",
          windToDeg: null, windToCardinal: "NO_CONFIRMADO",
          velocidadMph: null, efectoParque: "NEUTRAL",
          motivo: motivo
        });
        return;
      }

      var hit = asig.hit;
      var velocidadValida = typeof hit.windspeed_mph === "number" && !isNaN(hit.windspeed_mph) ? hit.windspeed_mph : null;
      var windToDeg = calcularVaHacia(hit.wind_dir);

      horas.push({
        offset: offset,
        horaSolicitada: claveSolicitada,
        horaUsada: asig.claveUsada,
        desfaseMinutos: asig.desfaseMinutos,
        esAproximada: asig.esAproximada,
        windFromDeg: hit.wind_dir,
        windFromCardinal: cardinalDe(hit.wind_dir),
        windToDeg: windToDeg,
        windToCardinal: cardinalDe(windToDeg),
        velocidadMph: velocidadValida,
        efectoParque: calcularEfectoParque(hit.wind_dir, hpACF, velocidadValida, cfg),
        motivo: null
      });
    });

    return horas;
  }

  // ───────────────────────────────────────────────────────────────
  // Clasifica una trayectoria combinando giro angular acumulado y
  // velocidad promedio. Usa windFromDeg (dato crudo, sin transformar)
  // para los cálculos de giro — el resultado de estabilidad/oscilación
  // es matemáticamente el mismo si se usara windToDeg, porque ambos
  // difieren en una constante de 180° y calcularGiroAngular trabaja
  // sobre diferencias.
  // ───────────────────────────────────────────────────────────────
  function clasificarTrayectoria(horasValidas, config) {
    var cfg = config || VIENTO_TRAYECTORIA_CONFIG;

    if (!horasValidas || horasValidas.length < 2) {
      return { giroTotalGrados: null, cambioCuadrante: false, clasificacion: "SIN_DATOS_SUFICIENTES", impacto: "NO_CONFIRMADO", velocidadPromedio: null };
    }

    var giroTotal = 0, cambioCuadrante = false, sumaVel = 0, nVel = 0;

    for (var i = 0; i < horasValidas.length; i++) {
      if (typeof horasValidas[i].velocidadMph === "number") { sumaVel += horasValidas[i].velocidadMph; nVel++; }
    }
    var velProm = nVel > 0 ? (sumaVel / nVel) : null;

    for (var j = 1; j < horasValidas.length; j++) {
      var giro = calcularGiroAngular(horasValidas[j - 1].windFromDeg, horasValidas[j].windFromDeg);
      if (giro === null) continue;
      giroTotal += Math.abs(giro);

      var cuadA = Math.floor((((horasValidas[j - 1].windFromDeg % 360) + 360) % 360) / 90);
      var cuadB = Math.floor((((horasValidas[j].windFromDeg % 360) + 360) % 360) / 90);
      if (cuadA !== cuadB) cambioCuadrante = true;
    }

    var clasificacion;
    if (giroTotal <= cfg.giroEstableMax) clasificacion = "ESTABLE";
    else if (giroTotal <= cfg.giroOscilanteMax) clasificacion = "OSCILANTE";
    else clasificacion = "CAMBIANTE";

    var factorVelocidad = (velProm === null) ? 0 : Math.min(1, velProm / (cfg.velocidadImpactoMin * 2));
    var puntaje = giroTotal * factorVelocidad;

    var impacto;
    if (velProm === null || velProm < cfg.velocidadImpactoMin) impacto = "BAJO";
    else if (puntaje <= cfg.giroEstableMax) impacto = "BAJO";
    else if (puntaje <= cfg.giroOscilanteMax) impacto = "MEDIO";
    else impacto = "ALTO";

    return {
      giroTotalGrados: Math.round(giroTotal * 10) / 10,
      cambioCuadrante: cambioCuadrante,
      clasificacion: clasificacion,
      impacto: impacto,
      velocidadPromedio: velProm !== null ? Math.round(velProm * 10) / 10 : null
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Resumen de porcentajes IN/OUT/CROSS + velocidad promedio + giro
  // total, sobre las horas válidas del subconjunto dado únicamente.
  // ───────────────────────────────────────────────────────────────
  function calcularResumen(horasSubconjunto) {
    var validas = (horasSubconjunto || []).filter(function (h) { return h.windFromDeg !== null; });
    var horasUtilizadas = validas.map(function (h) { return h.offset; });

    if (validas.length < 3) {
      return {
        horasUtilizadas: horasUtilizadas,
        porcentajeIN: null, porcentajeOUT: null, porcentajeCROSS: null,
        velocidadPromedio: null, giroTotal: null,
        clasificacion: "SIN_DATOS_SUFICIENTES"
      };
    }

    var nIN = 0, nOUT = 0, nCROSS = 0, sumaVel = 0, nVel = 0;
    validas.forEach(function (h) {
      if (h.efectoParque === "IN") nIN++;
      else if (h.efectoParque === "OUT") nOUT++;
      else if (h.efectoParque === "CROSS") nCROSS++;
      if (typeof h.velocidadMph === "number") { sumaVel += h.velocidadMph; nVel++; }
    });

    var total = validas.length;
    var traj = clasificarTrayectoria(validas, VIENTO_TRAYECTORIA_CONFIG);

    return {
      horasUtilizadas: horasUtilizadas,
      porcentajeIN: Math.round((nIN / total) * 1000) / 10,
      porcentajeOUT: Math.round((nOUT / total) * 1000) / 10,
      porcentajeCROSS: Math.round((nCROSS / total) * 1000) / 10,
      velocidadPromedio: nVel > 0 ? Math.round((sumaVel / nVel) * 10) / 10 : null,
      giroTotal: traj.giroTotalGrados,
      clasificacion: traj.clasificacion
    };
  }

  // ───────────────────────────────────────────────────────────────
  // Determina el offset de cierre del F5 y si es REAL o PROYECTADO.
  // ───────────────────────────────────────────────────────────────
  function calcularCierreF5(gameDateUTC, opciones, config) {
    var cfg = config || VIENTO_TRAYECTORIA_CONFIG;
    opciones = opciones || {};

    if (opciones.horaFinF5UTC) {
      var gameMs = new Date(gameDateUTC).getTime();
      var finMs = new Date(opciones.horaFinF5UTC).getTime();
      if (!isNaN(gameMs) && !isNaN(finMs) && finMs >= gameMs) {
        var horas = (finMs - gameMs) / 3600000;
        return { offsetFin: Math.max(0, Math.min(4, Math.ceil(horas))), estado: "F5_REAL" };
      }
    }

    var offsetRespaldo = opciones.f5AunEnDesarrollo ? cfg.f5OffsetMaxSiEnDesarrollo : cfg.f5OffsetMaxRespaldo;
    return { offsetFin: offsetRespaldo, estado: "F5_PROYECTADO" };
  }

  // ───────────────────────────────────────────────────────────────
  // Punto de entrada principal.
  // ───────────────────────────────────────────────────────────────
  function analizarJuego(juego) {
    juego = juego || {};
    var cfg = VIENTO_TRAYECTORIA_CONFIG;

    var stadium = juego.stadium;
    if (!stadium && juego.venue && typeof stadiumNorm === "function" && typeof STADIUM_INDEX !== "undefined") {
      stadium = STADIUM_INDEX.get(stadiumNorm(juego.venue)) || null;
    }

    var hpACF = juego.hpACF;
    if ((hpACF === null || hpACF === undefined) && juego.venue && typeof getOrientacionParque === "function") {
      var orient = getOrientacionParque(juego.venue);
      hpACF = orient && typeof orient.hpACF === "number" ? orient.hpACF : null;
    }

    var horas = getHorasJuego(juego.gameDateUTC, stadium, juego.mapaClima, hpACF, cfg, {
      permitirHoraAproximada: juego.permitirHoraAproximada,
      maxHorasRespaldo: juego.maxHorasRespaldo
    });
    var horasValidas = horas.filter(function (h) { return h.windFromDeg !== null; });

    var base = {
      gamePk: juego.gamePk || null,
      venue: juego.venue || null,
      gameTime: juego.gameDateUTC || null,
      timezone: stadium ? stadium.timezone : "NO_CONFIRMADO",
      horas: horas
    };

    if (horasValidas.length < 3) {
      base.estado = "SIN_DATOS_SUFICIENTES";
      base.horasValidasEncontradas = horasValidas.length;
      base.inicio = null; base.final = null; base.preJuego = null;
      base.f5 = null; base.juegoCompleto = null; base.trayectoria = null;
      return base;
    }

    var porOffset = {};
    horas.forEach(function (h) { porOffset[h.offset] = h; });

    function resumenHora(h) {
      return h ? {
        windFromDeg: h.windFromDeg, windFromCardinal: h.windFromCardinal,
        windToDeg: h.windToDeg, windToCardinal: h.windToCardinal,
        velocidadMph: h.velocidadMph, efectoParque: h.efectoParque
      } : null;
    }

    base.inicio = (porOffset[0] && porOffset[0].windFromDeg !== null) ? resumenHora(porOffset[0]) : null;

    var horaFinal = null;
    for (var off = 4; off >= 0; off--) {
      if (porOffset[off] && porOffset[off].windFromDeg !== null) { horaFinal = porOffset[off]; break; }
    }
    base.final = resumenHora(horaFinal);

    // ── PREJUEGO: solo -2 y -1. Nunca alimenta F5 ni juegoCompleto. ──
    var hPrev2 = porOffset[-2], hPrev1 = porOffset[-1];
    if (hPrev2 && hPrev1 && hPrev2.windFromDeg !== null && hPrev1.windFromDeg !== null) {
      var giroPre = calcularGiroAngular(hPrev2.windFromDeg, hPrev1.windFromDeg);
      base.preJuego = {
        estable: Math.abs(giroPre) <= cfg.giroEstableMax,
        giroGrados: Math.round(giroPre * 10) / 10,
        tendencia: Math.abs(giroPre) <= cfg.giroEstableMax ? "PREJUEGO_ESTABLE" : "PREJUEGO_CAMBIANTE"
      };
    } else {
      base.preJuego = { estable: null, giroGrados: null, tendencia: "NO_CONFIRMADO" };
    }

    // ── F5: SOLO offsets 0..offsetFin. Nunca incluye -2/-1. Nunca carreras. ──
    var cierreF5 = calcularCierreF5(juego.gameDateUTC, {
      horaFinF5UTC: juego.horaFinF5UTC,
      f5AunEnDesarrollo: juego.f5AunEnDesarrollo
    }, cfg);
    var horasF5 = cfg.offsets
      .filter(function (o) { return o >= 0 && o <= cierreF5.offsetFin; })
      .map(function (o) { return porOffset[o]; })
      .filter(Boolean);
    base.f5 = calcularResumen(horasF5);
    base.f5.estado = cierreF5.estado;
    base.f5.offsetFinUsado = cierreF5.offsetFin;
    base.f5.advertencia = (cierreF5.estado === "F5_PROYECTADO")
      ? "No hay horaFinF5UTC real. Este corte es un respaldo heurístico — NO afirma que el F5 haya terminado en este offset."
      : null;

    // ── JUEGO COMPLETO: offsets 0,1,2,3,4 ──
    var horasCompleto = [0, 1, 2, 3, 4].map(function (o) { return porOffset[o]; }).filter(Boolean);
    base.juegoCompleto = calcularResumen(horasCompleto);

    // ── TRAYECTORIA general sobre el mismo tramo de juego completo ──
    var horasCompletoValidas = horasCompleto.filter(function (h) { return h.windFromDeg !== null; });
    base.trayectoria = clasificarTrayectoria(horasCompletoValidas, cfg);

    return base;
  }

  window.MLBPRO_VIENTO_TRAYECTORIA = {
    config: VIENTO_TRAYECTORIA_CONFIG,
    getHorasJuego: getHorasJuego,
    calcularEfectoParque: calcularEfectoParque,
    calcularGiroAngular: calcularGiroAngular,
    calcularVaHacia: calcularVaHacia,
    clasificarTrayectoria: clasificarTrayectoria,
    calcularResumen: calcularResumen,
    analizarJuego: analizarJuego
  };
})();
