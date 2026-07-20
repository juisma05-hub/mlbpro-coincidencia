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

  CORREGIDO 20 jul 2026:
    1) NORMALIZACIÓN DE ID con _f5FuerzaNormId().
    2) VALIDACIÓN REAL DE FECHA con _f5FuerzaFechaCorteValida().
    3) RENOMBRE HONESTO de carreras del rival durante aperturas.
    4) ÚLTIMOS 5 POR ESCENARIO para equipo.
    5) RÉCORD F5 DEL ABRIDOR con últimos 5 y escenarios.
    6) COBERTURA DEL ABRIDOR:
       - 0 aperturas = SIN_MUESTRA
       - 1 a 4 aperturas = MUESTRA_INSUFICIENTE
       - 5 o más aperturas = CALCULADO

  FUNCIONES PÚBLICAS:
  - calcularFuerzaEquipoF5(teamId, fechaCorte)
  - calcularEnfrentamientosF5(teamIdA, teamIdB, fechaCorte)
  - calcularHistorialAbridorF5(pitcherId, fechaCorte)
  - calcularFuerzaEquipoF5ParaJuego(homeTeamId, awayTeamId, homePitcherId,
    awayPitcherId, fechaCorte)

  DEPENDENCIAS:
  Ninguna.

  NO TOCA:
  f5-historico-lineup.js, f5-carreraje.js, f5-moneyline.js,
  f5-automatico.js, MoneyLine, K6, brújula ni Coincidencia general.

  ESTADO:
  EN_PRUEBA — primera prueba real completada. Corregida la clasificación
  de abridores con menos de 5 aperturas; pendiente repetir la prueba real.

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

function _f5FuerzaNormId(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  return s === "" ? null : s;
}

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

function _f5FuerzaPartidosDeEquipo(teamId, fechaCorte, cache) {
  var teamIdNorm = _f5FuerzaNormId(teamId);
  var partidos = [];

  cache.forEach(function (r) {
    if (!_f5FuerzaRegistroUsable(r)) return;
    if (r.date >= fechaCorte) return;

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

function _f5FuerzaResultado(p) {
  if (p.carrerasPropias > p.carrerasRivales) return "GANADO";
  if (p.carrerasPropias < p.carrerasRivales) return "PERDIDO";
  return "EMPATE";
}

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

  return {
    estado: partidos.length > 0 ? "CALCULADO" : "SIN_MUESTRA",
    team_id: teamIdNorm,
    fecha_corte: fechaCorte,
    general: _f5FuerzaResumenLista(partidos),
    ultimos5: _f5FuerzaResumenUltimos5(partidos.slice(-5)),
    ultimos5ComoLocal: _f5FuerzaResumenUltimos5(partidosLocal.slice(-5)),
    ultimos5ComoVisitante: _f5FuerzaResumenUltimos5(partidosVisitante.slice(-5)),
    ultimos10: _f5FuerzaResumenLista(partidos.slice(-10)),
    comoLocal: _f5FuerzaResumenLista(partidosLocal),
    comoVisitante: _f5FuerzaResumenLista(partidosVisitante),
    cobertura: {
      total_registros_en_cache: cache.length,
      juegos_de_este_equipo_antes_del_corte: partidos.length
    }
  };
}

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

  return {
    estado: enfrentamientos.length > 0 ? "CALCULADO" : "SIN_MUESTRA",
    team_id_a: teamIdANorm,
    team_id_b: teamIdBNorm,
    fecha_corte: fechaCorte,
    resumen_desde_perspectiva_a: _f5FuerzaResumenLista(enfrentamientos),
    detalle_juegos: enfrentamientos.map(function (p) {
      return {
        gamePk: p.gamePk,
        date: p.date,
        a_jugo_de_local: p.esLocal,
        carreras_f5_a: p.carrerasPropias,
        carreras_f5_b: p.carrerasRivales
      };
    })
  };
}

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
      carrerasPropias: esLocal ? r.f5_runs_home : r.f5_runs_away,
      carrerasRivales: esLocal ? r.f5_runs_away : r.f5_runs_home,
      rivalTeamId: esLocal ? _f5FuerzaNormId(r.away_team_id) : _f5FuerzaNormId(r.home_team_id)
    });
  });

  aperturas.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
  return aperturas;
}

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

  return {
    estado: aperturas.length < 5 ? "MUESTRA_INSUFICIENTE" : "CALCULADO",
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
    ultimos5: _f5FuerzaResumenUltimos5(aperturas.slice(-5)),
    ultimos5ComoLocal: _f5FuerzaResumenUltimos5(aperturasLocal.slice(-5)),
    ultimos5ComoVisitante: _f5FuerzaResumenUltimos5(aperturasVisitante.slice(-5)),
    detalle_aperturas: aperturas.map(function (a) {
      return {
        gamePk: a.gamePk,
        date: a.date,
        esLocal: a.esLocal,
        carreras_equipo_f5: a.carrerasPropias,
        carreras_rival_f5: a.carrerasRivales,
        rival_team_id: a.rivalTeamId
      };
    })
  };
}

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
