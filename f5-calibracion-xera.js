/*
  MLBPro · f5-calibracion-xera.js

  FUNCIÓN:
  Prueba una métrica MÁS SIMPLE que woba_esperado (arsenal-vs-lineup, ya
  descartada por backtest real: r=0.05, R²=0.0026, sesgo de snapshot
  descartado como causa) contra las carreras reales de F5: el xERA propio
  del pitcher, ya existente en PITCHERS_MASTER_2026 y ya usado en index.html
  para mostrarlo en pantalla. Hipótesis a probar: el xERA del pitcher (una
  métrica de calidad ya validada por sabermetría, sin depender del lineup
  rival específico) puede correlacionar mejor con carreras de F5 que el
  cruce arsenal-vs-lineup. No inventa ningún coeficiente, no publica
  ninguna fórmula: solo corre el backtest y reporta los números reales.

  ENTRADAS:
  logFn (function, opcional). No hace fetch: todo sale de localStorage
  ("F5_HISTORICO_CARRERAJE_2026") y de PITCHERS_MASTER_2026 ya cargado.

  SALIDAS / MODIFICACIONES:
  Solo lectura. No escribe ninguna caché. Lee:
    - "F5_HISTORICO_CARRERAJE_2026" (gamePk, pitchers, f5_runs_home/away)
    - PITCHERS_MASTER_2026[pitcher_id].xera (pitchers-master.js)
  NO lee F5_HISTORICO_LINEUP_2026 (no hace falta para esta métrica: el
  xERA es propio del pitcher, no depende del lineup rival específico).
  NO lee ARSENAL_MASTER_2026 ni BATTERS_VSPITCH_2026.

  EMPAREJAMIENTO EXACTO (mismo mapeo home/away que ya se usó y verificó en
  f5-calibracion-carreraje.js, para no repetir el mismo tipo de error):
    - xera del pitcher HOME → predice f5_runs_away (el away batea contra
      el pitcher home).
    - xera del pitcher AWAY → predice f5_runs_home (el home batea contra
      el pitcher away).
  Solo se usa un pitcher si PITCHERS_MASTER_2026[id].xera es un número
  real confirmado (no NO_CONFIRMADO, no undefined).

  DEPENDENCIAS:
  pitchers-master.js (PITCHERS_MASTER_2026) ya cargado como <script> antes
  que este archivo. No depende de factor-arsenal-lineup.js,
  arsenal-master.js, batters-vspitch.js, jalar-lineup.js ni de
  f5-historico-lineup.js.

  NO TOCA:
  f5-carreraje.js, f5-moneyline.js, f5-automatico.js, factor-arsenal-
  lineup.js, arsenal-master.js, batters-vspitch.js, f5-calibracion-
  carreraje.js, clima-cache.js, jalar-clima.js, K6, brújula.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica.

  ESTADO:
  Pieza de backtest/diagnóstico de una métrica candidata. Su salida NO es
  una fórmula aprobada. NO_CONFIRMADO — pendiente de correr la página de
  prueba con los 1,427 juegos ya capturados.

  FECHA:
  12 jul 2026.
*/

var F5_CALIBRACION_XERA_MINIMO_MUESTRAS = 30;

function f5CalibracionXeraLeerCarreraje() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_CARRERAJE_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function f5CalibracionXeraMedia(arr) {
  if (!arr.length) return null;
  return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
}

function f5CalibracionXeraRegresion(muestras) {
  var n = muestras.length;
  var xs = muestras.map(function (m) { return m.xera; });
  var ys = muestras.map(function (m) { return m.runs_reales; });

  var xBar = f5CalibracionXeraMedia(xs);
  var yBar = f5CalibracionXeraMedia(ys);

  var num = 0, denX = 0, denY = 0;
  for (var i = 0; i < n; i++) {
    var dx = xs[i] - xBar;
    var dy = ys[i] - yBar;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return null;

  var pendiente = num / denX;
  var intercepto = yBar - pendiente * xBar;
  var r = num / Math.sqrt(denX * denY);
  var r2 = r * r;

  var sumaErrCuad = 0, sumaErrAbs = 0;
  for (var j = 0; j < n; j++) {
    var pred = pendiente * xs[j] + intercepto;
    var err = ys[j] - pred;
    sumaErrCuad += err * err;
    sumaErrAbs += Math.abs(err);
  }

  return {
    n_muestras: n,
    correlacion_r: Math.round(r * 10000) / 10000,
    r_cuadrado: Math.round(r2 * 10000) / 10000,
    pendiente: Math.round(pendiente * 100000) / 100000,
    intercepto: Math.round(intercepto * 100000) / 100000,
    rmse: Math.round(Math.sqrt(sumaErrCuad / n) * 1000) / 1000,
    mae: Math.round((sumaErrAbs / n) * 1000) / 1000,
    rango_xera: { min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) },
    rango_runs_reales: { min: Math.min.apply(null, ys), max: Math.max.apply(null, ys) }
  };
}

function calcularF5CalibracionXera(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  if (typeof PITCHERS_MASTER_2026 === "undefined") {
    return {
      estado: "SIN_DEPENDENCIA_CARGADA",
      detalle: "PITCHERS_MASTER_2026 no está disponible. Falta cargar pitchers-master.js antes que este archivo."
    };
  }

  var carreraje = f5CalibracionXeraLeerCarreraje();
  log("Juegos en F5_HISTORICO_CARRERAJE_2026: " + carreraje.length);

  var muestras = [];
  var descartadosSinXera = 0;

  carreraje.forEach(function (rc) {
    var pHome = PITCHERS_MASTER_2026[rc.home_pitcher_id];
    var pAway = PITCHERS_MASTER_2026[rc.away_pitcher_id];

    var xeraHome = pHome && typeof pHome.xera === "number" && Number.isFinite(pHome.xera) ? pHome.xera : null;
    var xeraAway = pAway && typeof pAway.xera === "number" && Number.isFinite(pAway.xera) ? pAway.xera : null;

    if (xeraHome !== null && typeof rc.f5_runs_away === "number" && Number.isFinite(rc.f5_runs_away)) {
      muestras.push({ xera: xeraHome, runs_reales: rc.f5_runs_away, gamePk: rc.gamePk, lado: "xera_home_vs_runs_away" });
    } else {
      descartadosSinXera++;
    }

    if (xeraAway !== null && typeof rc.f5_runs_home === "number" && Number.isFinite(rc.f5_runs_home)) {
      muestras.push({ xera: xeraAway, runs_reales: rc.f5_runs_home, gamePk: rc.gamePk, lado: "xera_away_vs_runs_home" });
    } else {
      descartadosSinXera++;
    }
  });

  log("Muestras validas (xera confirmado + runs reales): " + muestras.length);
  log("Descartadas sin xera confirmado: " + descartadosSinXera);

  if (muestras.length < F5_CALIBRACION_XERA_MINIMO_MUESTRAS) {
    return {
      estado: "SIN_MUESTRA_SUFICIENTE",
      detalle: "Hay " + muestras.length + " muestra(s) valida(s); se necesitan al menos " + F5_CALIBRACION_XERA_MINIMO_MUESTRAS + ".",
      n_muestras: muestras.length,
      minimo_requerido: F5_CALIBRACION_XERA_MINIMO_MUESTRAS,
      descartados_sin_xera: descartadosSinXera
    };
  }

  var backtest = f5CalibracionXeraRegresion(muestras);

  if (!backtest) {
    return {
      estado: "SIN_VARIACION_SUFICIENTE",
      detalle: "xera o runs_reales no varian lo suficiente para calcular correlacion real.",
      n_muestras: muestras.length
    };
  }

  log("Backtest xERA: r=" + backtest.correlacion_r + " | R2=" + backtest.r_cuadrado + " | RMSE=" + backtest.rmse);

  return {
    estado: "BACKTEST_CALCULADO",
    detalle: "Backtest real de xERA vs carreras F5 sobre " + muestras.length + " muestras. Evidencia para decidir si sustituye a woba_esperado -- NO es formula aprobada.",
    n_muestras: muestras.length,
    descartados_sin_xera: descartadosSinXera,
    backtest_xera: backtest
  };
}
