/*
  MLBPro · f5-fuerza-equipo.js

  FUNCIÓN:
  Mide la fuerza histórica F5 de un equipo, sus últimos 5 juegos F5 por
  escenario (local/visitante), y el récord F5 + rendimiento del rival
  durante las aperturas de un pitcher — usando ÚNICAMENTE
  F5_HISTORICO_CARRERAJE_2026 (no usa F5_HISTORICO_LINEUP_2026: esa caché
  es para el cruce pitcher-vs-lineup, no para récord/fuerza histórica de
  equipo o abridor; se mantiene fuera de este archivo a propósito). Esta
  pieza NO fija pesos, NO combina métricas en un score, y NO elige ganador
  — solo mide y reporta cada métrica por separado, con su propia muestra.
  La selección final (si alguna vez usa estos datos) es decisión de otro
  archivo, no de este.

  ENTRADAS:
  Ninguna dependencia externa ni fetch. Lee directamente
  localStorage["F5_HISTORICO_CARRERAJE_2026"]. Cada función pública
  recibe team_id / pitcher_id y una fecha de corte "YYYY-MM-DD".

  SALIDAS / MODIFICACIONES:
  Solo lectura, no escribe ninguna caché. Nunca inventa un faltante con 0:
  si no hay muestra, los campos numéricos salen `null`. Si hay muestra
  pero es menor que 5 en un bloque de "últimos 5", ese bloque devuelve la
  muestra disponible (real, sin completar con ceros) y
  `estado: "MUESTRA_INSUFICIENTE"`.

  CORTE CRONOLÓGICO (backtest honesto):
  Toda función que reciba fechaCorte SOLO usa juegos con
  r.date < fechaCorte (estrictamente anterior) — el juego de la fecha
  evaluada y cualquier fecha posterior quedan excluidos siempre.

  RESULTADO F5 POR JUEGO / APERTURA:
  Se deriva comparando carreras propias vs carreras del rival: GANADO si
  las propias son mayores, PERDIDO si son menores, EMPATE si son iguales
  — el empate se conserva como resultado real, nunca se fuerza a
  ganado/perdido ni se descarta. Para el abridor, "propias" son las
  carreras F5 de SU equipo mientras él abrió (apoyo ofensivo recibido), y
  "rival" son las carreras F5 del equipo contrario en ese mismo juego —
  así el récord F5 del abridor es honesto: es el récord F5 del EQUIPO en
  los juegos que él abrió, no una atribución de crédito/culpa individual.

  CORREGIDO 20 jul 2026 (antes de la primera prueba real) — 3 puntos:
    1) NORMALIZACIÓN DE ID: team_id y pitcher_id se normalizan con
       _f5FuerzaNormId() (String(v).trim(), null si vacío) antes de
       comparar — "147" y 147 ahora coinciden.
    2) VALIDACIÓN REAL DE FECHA: _f5FuerzaFechaCorteValida() reconstruye
       la fecha con Date.UTC() y confirma año/mes/día exactos, no solo el
       formato — mismo criterio que f5-historico-carreraje.js.
    3) RENOMBRE HONESTO: lo que se calculaba como "carreras permitidas
       por el abridor" en realidad son las carreras F5 del EQUIPO RIVAL
       durante sus aperturas (el bullpen también participa en esas 5
       entradas si el abridor no las completa). Los campos quedaron:
       carreras_rival_f5_total, promedio_carreras_rival_f5_en_aperturas,
       aperturas_con_rival_en_cero_f5.

  AMPLIADO 20 jul 2026 (misma sesión, antes de la primera prueba real):
    4) ÚLTIMOS 5 POR ESCENARIO (equipo): calcularFuerzaEquipoF5() ahora
       reporta ultimos5 (general, con porcentajes), ultimos5ComoLocal y
       ultimos5ComoVisitante — cada uno con: ganados/perdidos/empates,
       porcentaje_victorias_f5, porcentaje_victorias_f5_sin_empates (solo
       juegos decididos), promedio de carreras anotadas/permitidas, y
       diferencial promedio. Si el escenario tiene menos de 5 juegos
       antes del corte, se devuelve la muestra real disponible marcada
       estado: "MUESTRA_INSUFICIENTE" — nunca se completa con ceros.
    5) RÉCORD F5 DEL ABRIDOR: calcularHistorialAbridorF5() ahora también
       reporta el récord F5 real del equipo en los juegos que abrió ese
       pitcher (ganados_f5/perdidos_f5/empates_f5, porcentajes de
       victoria con y sin empates), sus últimos 5 F5 (general y por
       escenario local/visitante, mismo criterio de MUESTRA_INSUFICIENTE
       que el equipo), promedio de carreras que anotó su equipo,
       promedio_carreras_rival_f5_en_aperturas, y diferencial promedio.

  FUNCIONES PÚBLICAS:
  - calcularFuerzaEquipoF5(teamId, fechaCorte)
  - calcularEnfrentamientosF5(teamIdA, teamIdB, fechaCorte)
  - calcularHistorialAbridorF5(pitcherId, fechaCorte)
  - calcularFuerzaEquipoF5ParaJuego(homeTeamId, awayTeamId, homePitcherId,
    awayPitcherId, fechaCorte) — AGRUPACIÓN de las tres anteriores, no
    calcula nada nuevo, no pondera, no elige.

  DEPENDENCIAS:
  Ninguna. Autónomo, igual que f5-historico-carreraje.js.

  NO TOCA:
  f5-historico-lineup.js, f5-carreraje.js, f5-moneyline.js,
  f5-automatico.js, la selección actual de MoneyLine, K6, brújula,
  Coincidencia general.

  ESTADO:
  NO_CONFIRMADO — pendiente de correr f5-fuerza-equipo-test.html contra
  el histórico real antes de conectarlo a cualquier flujo en vivo.

  FECHA:
  20 jul 2026.
*/

function _f5FuerzaLeerCarreraje() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_CARRERAJE_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

// Normaliza team_id / pitcher_id a string para que "147" y 147 se
// consideren el mismo id. null/undefined/"" (tras trim) devuelven null.
function _f5FuerzaNormId(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  return s === "" ? null : s;
}

// Valida que fechaCorte sea una fecha REAL (no solo el formato
// YYYY-MM-DD) -- reconstruye con Date.UTC() y confirma que año/mes/día
// coincidan exactamente, mismo criterio que f5-historico-carreraje.js.
function _f5FuerzaFechaCorteValida(fechaCorte) {
  if (typeof fechaCorte !== "string") return false;
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaCorte);
  if (!m) return false;

  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);

  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;

  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime())) return false;

  return dt.getUTCFullYear() === y &&
    (dt.getUTCMonth() + 1) === mo &&
    dt.getUTCDate() === d;
}

function _f5FuerzaRegistroUsable(r) {
  if (!r || r.status !== "Final") return false;
  if (typeof r.date !== "string") return false;
  if (typeof r.f5_runs_home !== "number" || !Number.isFinite(r.f5_runs_home)) return false;
  if (typeof r.f5_runs_away !== "number" || !Number.isFinite(r.f5_runs_away)) return false;
  return true;
}

// Todas las apariciones de un equipo (como local o visitante), con corte
// cronológico estricto (r.date < fechaCorte) e ids normalizados, ordenadas
// de más antiguo a más reciente.
function _f5FuerzaPartidosDeEquipo(teamId, fechaCorte, cache) {
  var teamIdNorm = _f5FuerzaNormId(teamId);
  var partidos = [];

  cache.forEach(function (r) {
    if (!_f5FuerzaRegistroUsable(r)) return;
    if (r.date >= fechaCorte) return; // corte cronologico estricto

    var homeIdNorm = _f5FuerzaNormId(r.home_team_id);
    var awayIdNorm = _f5FuerzaNormId(r.away_team_id);
    var esLocal = homeIdNorm !== null && homeIdNorm === teamIdNorm;
    var esVisitante = awayIdNorm !== null && awayIdNorm === teamIdNorm;
    if (!esLocal && !esVisitante) return;

    partidos.push({
      gamePk: r.gamePk,
      date: r.date,
      esLocal: esLocal,
      carrerasPropias: esLocal ? r.f5_runs_home : r.f5_runs_away,
      carrerasRivales: esLocal ? r.f5_runs_away : r.f5_runs_home,
      rivalTeamId: esLocal ? awayIdNorm : homeIdNorm,
      pitcherPropio: esLocal ? _f5FuerzaNormId(r.home_pitcher_id) : _f5FuerzaNormId(r.away_pitcher_id),
      pitcherRival: esLocal ? _f5FuerzaNormId(r.away_pitcher_id) : _f5FuerzaNormId(r.home_pitcher_id)
    });
  });

  partidos.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
  return partidos;
}

// Resultado F5 real de un partido/apertura desde la perspectiva del lado
// medido. El empate se conserva tal cual, nunca se fuerza a ganado/perdido.
function _f5FuerzaResultado(p) {
  if (p.carrerasPropias > p.carrerasRivales) return "GANADO";
  if (p.carrerasPropias < p.carrerasRivales) return "PERDIDO";
  return "EMPATE";
}

// Resumen BÁSICO de una lista ya filtrada: récord, carreras, diferencial.
// Con muestra 0, todos los campos numéricos salen null -- nunca 0. Usado
// para general / últimos10 / splits local-visitante (sin exigencia de
// tamaño mínimo).
function _f5FuerzaResumenLista(lista) {
  var n = lista.length;

  if (n === 0) {
    return {
      muestra: 0,
      ganados: null, perdidos: null, empates: null,
      carrerasAnotadas: null, carrerasPermitidas: null, diferencial: null,
      promedioAnotadas: null, promedioPermitidas: null
    };
  }

  var ganados = 0, perdidos = 0, empates = 0, anotadas = 0, permitidas = 0;
  lista.forEach(function (p) {
    var res = _f5FuerzaResultado(p);
    if (res === "GANADO") ganados++;
    else if (res === "PERDIDO") perdidos++;
    else empates++;
    anotadas += p.carrerasPropias;
    permitidas += p.carrerasRivales;
  });

  return {
    muestra: n,
    ganados: ganados, perdidos: perdidos, empates: empates,
    carrerasAnotadas: anotadas, carrerasPermitidas: permitidas,
    diferencial: anotadas - permitidas,
    promedioAnotadas: Math.round((anotadas / n) * 1000) / 1000,
    promedioPermitidas: Math.round((permitidas / n) * 1000) / 1000
  };
}

// Resumen de "ÚLTIMOS 5" (o el escenario que sea) CON porcentajes y con
// marca explícita MUESTRA_INSUFICIENTE cuando hay menos de 5 juegos --
// nunca completa con ceros, siempre devuelve la muestra real disponible.
// Recibe la lista YA recortada (ej. partidos.slice(-5)).
function _f5FuerzaResumenUltimos5(lista) {
  var n = lista.length;

  if (n === 0) {
    return {
      estado: "SIN_MUESTRA",
      muestra: 0,
      ganados: null, perdidos: null, empates: null,
      porcentaje_victorias_f5: null,
      porcentaje_victorias_f5_sin_empates: null,
      promedio_carreras_anotadas: null,
      promedio_carreras_permitidas: null,
      diferencial_promedio: null
    };
  }

  var ganados = 0, perdidos = 0, empates = 0, anotadas = 0, permitidas = 0;
  lista.forEach(function (p) {
    var res = _f5FuerzaResultado(p);
    if (res === "GANADO") ganados++;
    else if (res === "PERDIDO") perdidos++;
    else empates++;
    anotadas += p.carrerasPropias;
    permitidas += p.carrerasRivales;
  });

  var decididos = ganados + perdidos;
  var promedioAnotadas = Math.round((anotadas / n) * 1000) / 1000;
  var promedioPermitidas = Math.round((permitidas / n) * 1000) / 1000;

  return {
    estado: n < 5 ? "MUESTRA_INSUFICIENTE" : "CALCULADO",
    muestra: n,
    ganados: ganados, perdidos: perdidos, empates: empates,
    porcentaje_victorias_f5: Math.round((ganados / n) * 1000) / 10,
    porcentaje_victorias_f5_sin_empates: decididos > 0 ? Math.round((ganados / decididos) * 1000) / 10 : null,
    promedio_carreras_anotadas: promedioAnotadas,
    promedio_carreras_permitidas: promedioPermitidas,
    diferencial_promedio: Math.round((promedioAnotadas - promedioPermitidas) * 1000) / 1000
  };
}

// Récord F5, últimos 5/10 (con porcentajes y por escenario), carreras
// anotadas/permitidas, diferencial, y splits local/visitante -- todo con
// muestra propia, corte cronológico e id normalizado.
function calcularFuerzaEquipoF5(teamId, fechaCorte) {
  var teamIdNorm = _f5FuerzaNormId(teamId);
  if (teamIdNorm === null) {
    return { estado: "SIN_TEAM_ID", detalle: "No se proporcionó team_id (o vino vacío)." };
  }
  if (!_f5FuerzaFechaCorteValida(fechaCorte)) {
    return { estado: "SIN_FECHA_CORTE_VALIDA", detalle: "fechaCorte debe ser una fecha YYYY-MM-DD real (no solo con el formato correcto)." };
  }

  var cache = _f5FuerzaLeerCarreraje();
  var partidos = _f5FuerzaPartidosDeEquipo(teamIdNorm, fechaCorte, cache);
  var partidosLocal = partidos.filter(function (p) { return p.esLocal; });
  var partidosVisitante = partidos.filter(function (p) { return !p.esLocal; });

  var general = _f5FuerzaResumenLista(partidos);
  var ultimos10 = _f5FuerzaResumenLista(partidos.slice(-10));
  var comoLocal = _f5FuerzaResumenLista(partidosLocal);
  var comoVisitante = _f5FuerzaResumenLista(partidosVisitante);

  var ultimos5 = _f5FuerzaResumenUltimos5(partidos.slice(-5));
  var ultimos5ComoLocal = _f5FuerzaResumenUltimos5(partidosLocal.slice(-5));
  var ultimos5ComoVisitante = _f5FuerzaResumenUltimos5(partidosVisitante.slice(-5));

  return {
    estado: partidos.length > 0 ? "CALCULADO" : "SIN_MUESTRA",
    team_id: teamIdNorm,
    fecha_corte: fechaCorte,
    general: general,
    ultimos5: ultimos5,
    ultimos5ComoLocal: ultimos5ComoLocal,
    ultimos5ComoVisitante: ultimos5ComoVisitante,
    ultimos10: ultimos10,
    comoLocal: comoLocal,
    comoVisitante: comoVisitante,
    cobertura: {
      total_registros_en_cache: cache.length,
      juegos_de_este_equipo_antes_del_corte: partidos.length
    }
  };
}

// Historial F5 head-to-head entre dos equipos, desde la perspectiva del
// equipo A, con corte cronológico e ids normalizados.
function calcularEnfrentamientosF5(teamIdA, teamIdB, fechaCorte) {
  var teamIdANorm = _f5FuerzaNormId(teamIdA);
  var teamIdBNorm = _f5FuerzaNormId(teamIdB);

  if (teamIdANorm === null || teamIdBNorm === null) {
    return { estado: "SIN_TEAM_ID", detalle: "Se requieren teamIdA y teamIdB (no vacíos)." };
  }
  if (!_f5FuerzaFechaCorteValida(fechaCorte)) {
    return { estado: "SIN_FECHA_CORTE_VALIDA", detalle: "fechaCorte debe ser una fecha YYYY-MM-DD real (no solo con el formato correcto)." };
  }

  var cache = _f5FuerzaLeerCarreraje();
  var partidosA = _f5FuerzaPartidosDeEquipo(teamIdANorm, fechaCorte, cache);
  var enfrentamientos = partidosA.filter(function (p) { return p.rivalTeamId === teamIdBNorm; });

  var resumen = _f5FuerzaResumenLista(enfrentamientos);

  return {
    estado: enfrentamientos.length > 0 ? "CALCULADO" : "SIN_MUESTRA",
    team_id_a: teamIdANorm,
    team_id_b: teamIdBNorm,
    fecha_corte: fechaCorte,
    resumen_desde_perspectiva_a: resumen,
    detalle_juegos: enfrentamientos.map(function (p) {
      return {
        gamePk: p.gamePk, date: p.date, a_jugo_de_local: p.esLocal,
        carreras_f5_a: p.carrerasPropias, carreras_f5_b: p.carrerasRivales
      };
    })
  };
}

// Todas las aperturas F5 reales de un pitcher (como local o visitante),
// con corte cronológico e id normalizado. Devuelve objetos con la MISMA
// forma que los partidos de equipo (carrerasPropias = apoyo ofensivo
// recibido, carrerasRivales = carreras F5 del rival) para poder reusar
// _f5FuerzaResultado()/_f5FuerzaResumenLista()/_f5FuerzaResumenUltimos5()
// sin duplicar lógica -- el récord F5 resultante es el récord F5 real del
// EQUIPO en los juegos que abrió este pitcher, no una atribución
// individual inventada.
function _f5FuerzaAperturasDePitcher(pitcherId, fechaCorte, cache) {
  var pitcherIdNorm = _f5FuerzaNormId(pitcherId);
  var aperturas = [];

  cache.forEach(function (r) {
    if (!_f5FuerzaRegistroUsable(r)) return;
    if (r.date >= fechaCorte) return;

    var homePitcherNorm = _f5FuerzaNormId(r.home_pitcher_id);
    var awayPitcherNorm = _f5FuerzaNormId(r.away_pitcher_id);
    var esLocal = homePitcherNorm !== null && homePitcherNorm === pitcherIdNorm;
    var esVisitante = awayPitcherNorm !== null && awayPitcherNorm === pitcherIdNorm;
    if (!esLocal && !esVisitante) return;

    aperturas.push({
      gamePk: r.gamePk,
      date: r.date,
      esLocal: esLocal,
      // carrerasPropias = carreras F5 del EQUIPO de este pitcher (apoyo
      // ofensivo recibido). carrerasRivales = carreras F5 del EQUIPO
      // RIVAL -- no "permitidas por el abridor": el bullpen tambien
      // participa en esas 5 entradas si el abridor no las completa.
      carrerasPropias: esLocal ? r.f5_runs_home : r.f5_runs_away,
      carrerasRivales: esLocal ? r.f5_runs_away : r.f5_runs_home,
      rivalTeamId: esLocal ? _f5FuerzaNormId(r.away_team_id) : _f5FuerzaNormId(r.home_team_id)
    });
  });

  aperturas.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
  return aperturas;
}

// Récord F5 real del equipo en las aperturas de un pitcher (perspectiva
// del equipo que abrió con él), últimos 5 F5 (general y por escenario), y
// rendimiento del rival durante esas aperturas -- corte cronológico e id
// normalizado. Nunca se llama "carreras permitidas por el pitcher": la
// caché solo sabe el total del rival en cinco entradas, no cuánto es
// atribuible al abridor específicamente.
function calcularHistorialAbridorF5(pitcherId, fechaCorte) {
  var pitcherIdNorm = _f5FuerzaNormId(pitcherId);
  if (pitcherIdNorm === null) {
    return { estado: "SIN_PITCHER_ID", detalle: "No se proporcionó pitcher_id (o vino vacío)." };
  }
  if (!_f5FuerzaFechaCorteValida(fechaCorte)) {
    return { estado: "SIN_FECHA_CORTE_VALIDA", detalle: "fechaCorte debe ser una fecha YYYY-MM-DD real (no solo con el formato correcto)." };
  }

  var cache = _f5FuerzaLeerCarreraje();
  var aperturas = _f5FuerzaAperturasDePitcher(pitcherIdNorm, fechaCorte, cache);
  var aperturasLocal = aperturas.filter(function (a) { return a.esLocal; });
  var aperturasVisitante = aperturas.filter(function (a) { return !a.esLocal; });

  if (aperturas.length === 0) {
    return {
      estado: "SIN_MUESTRA",
      pitcher_id: pitcherIdNorm,
      fecha_corte: fechaCorte,
      muestra: 0,
      ganados_f5: null, perdidos_f5: null, empates_f5: null,
      porcentaje_victorias_f5: null,
      porcentaje_victorias_f5_sin_empates: null,
      promedio_carreras_equipo_f5_en_aperturas: null,
      promedio_carreras_rival_f5_en_aperturas: null,
      diferencial_promedio_f5: null,
      carreras_rival_f5_total: null,
      aperturas_con_rival_en_cero_f5: null,
      ultimos5: _f5FuerzaResumenUltimos5([]),
      ultimos5ComoLocal: _f5FuerzaResumenUltimos5([]),
      ultimos5ComoVisitante: _f5FuerzaResumenUltimos5([]),
      detalle_aperturas: []
    };
  }

  var general = _f5FuerzaResumenLista(aperturas);
  var decididos = general.ganados + general.perdidos;
  var rivalEnCero = aperturas.filter(function (a) { return a.carrerasRivales === 0; }).length;

  var ultimos5 = _f5FuerzaResumenUltimos5(aperturas.slice(-5));
  var ultimos5ComoLocal = _f5FuerzaResumenUltimos5(aperturasLocal.slice(-5));
  var ultimos5ComoVisitante = _f5FuerzaResumenUltimos5(aperturasVisitante.slice(-5));

  return {
    estado: "CALCULADO",
    pitcher_id: pitcherIdNorm,
    fecha_corte: fechaCorte,
    muestra: aperturas.length,
    ganados_f5: general.ganados,
    perdidos_f5: general.perdidos,
    empates_f5: general.empates,
    porcentaje_victorias_f5: Math.round((general.ganados / aperturas.length) * 1000) / 10,
    porcentaje_victorias_f5_sin_empates: decididos > 0 ? Math.round((general.ganados / decididos) * 1000) / 10 : null,
    promedio_carreras_equipo_f5_en_aperturas: general.promedioAnotadas,
    promedio_carreras_rival_f5_en_aperturas: general.promedioPermitidas,
    diferencial_promedio_f5: Math.round((general.promedioAnotadas - general.promedioPermitidas) * 1000) / 1000,
    carreras_rival_f5_total: general.carrerasPermitidas,
    aperturas_con_rival_en_cero_f5: rivalEnCero,
    ultimos5: ultimos5,
    ultimos5ComoLocal: ultimos5ComoLocal,
    ultimos5ComoVisitante: ultimos5ComoVisitante,
    detalle_aperturas: aperturas.map(function (a) {
      return {
        gamePk: a.gamePk, date: a.date, esLocal: a.esLocal,
        carreras_equipo_f5: a.carrerasPropias,
        carreras_rival_f5: a.carrerasRivales,
        rival_team_id: a.rivalTeamId
      };
    })
  };
}

// AGRUPACIÓN para un juego específico -- no calcula nada nuevo, no pondera,
// no elige. Solo junta las cuatro piezas (local, visitante, enfrentamientos,
// ambos abridores) en un objeto.
function calcularFuerzaEquipoF5ParaJuego(homeTeamId, awayTeamId, homePitcherId, awayPitcherId, fechaCorte) {
  return {
    fecha_corte: fechaCorte,
    local: calcularFuerzaEquipoF5(homeTeamId, fechaCorte),
    visitante: calcularFuerzaEquipoF5(awayTeamId, fechaCorte),
    enfrentamientos: calcularEnfrentamientosF5(homeTeamId, awayTeamId, fechaCorte),
    abridorLocal: calcularHistorialAbridorF5(homePitcherId, fechaCorte),
    abridorVisitante: calcularHistorialAbridorF5(awayPitcherId, fechaCorte)
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    calcularFuerzaEquipoF5: calcularFuerzaEquipoF5,
    calcularEnfrentamientosF5: calcularEnfrentamientosF5,
    calcularHistorialAbridorF5: calcularHistorialAbridorF5,
    calcularFuerzaEquipoF5ParaJuego: calcularFuerzaEquipoF5ParaJuego
  };
}
