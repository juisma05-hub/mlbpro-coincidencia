/*
  MLBPro · f5-calibracion-combinado.js

  FUNCIÓN:
  Última prueba de evidencia antes de cerrar la rama F5: combina las dos
  métricas ya probadas por separado (woba_esperado, r=0.0511/R²=0.0026;
  xERA, r=0.1761/R²=0.0310) en una regresión de DOS predictores, para ver
  si juntas explican más varianza de las carreras reales de F5 que
  cualquiera de las dos sola. No inventa ningún coeficiente: calcula la
  regresión real sobre los datos reales ya capturados y reporta el R²
  resultante para decidir, con evidencia, si esto cierra la rama con una
  fórmula válida o si F5 Carreraje queda honestamente en PENDIENTE.

  ENTRADAS:
  logFn (function, opcional). No hace fetch: todo sale de localStorage
  ("F5_HISTORICO_CARRERAJE_2026", "F5_HISTORICO_LINEUP_2026"),
  calcularFactorArsenalLineup() (factor-arsenal-lineup.js) y
  PITCHERS_MASTER_2026 (pitchers-master.js), todos ya cargados en la
  página.

  SALIDAS / MODIFICACIONES:
  Solo lectura, no escribe ninguna caché.

  EMPAREJAMIENTO EXACTO (mismo mapeo verificado en las dos pruebas
  anteriores, para no invertirlo aquí):
    - pitcher HOME: woba_esperado (vs lineup_away) + xera propio →
      predicen f5_runs_away.
    - pitcher AWAY: woba_esperado (vs lineup_home) + xera propio →
      predicen f5_runs_home.
  Una muestra solo se usa si AMBAS métricas están confirmadas para ese
  pitcher en ese juego (cruce arsenal-lineup confirmado Y xera numérico
  real). Si falta cualquiera de las dos, esa muestra se descarta — nunca
  se rellena la métrica faltante con un promedio ni con cero.

  DEPENDENCIAS:
  factor-arsenal-lineup.js (y por extensión arsenal-master.js,
  batters-vspitch.js), pitchers-master.js. Todos ya cargados como
  <script> antes que este archivo.

  NO TOCA:
  f5-carreraje.js, f5-moneyline.js, f5-automatico.js, factor-arsenal-
  lineup.js, arsenal-master.js, batters-vspitch.js, pitchers-master.js,
  f5-calibracion-carreraje.js, f5-calibracion-xera.js, clima-cache.js,
  jalar-clima.js, K6, brújula.

  UTC / HORA LOCAL DEL ESTADIO: no aplica.

  ESTADO:
  Pieza de backtest/diagnóstico. Su salida NO es una fórmula aprobada por
  sí sola: es la última pieza de evidencia de la rama F5 antes de decidir
  si f5-carreraje.js recibe una calibración real o se documenta
  formalmente como PENDIENTE (con evidencia adjunta, no inventada).

  CORRECCIÓN (misma sesión, antes de la primera corrida real):
  La primera versión comparaba el R² combinado contra los R² fijos de
  las corridas anteriores (woba solo=0.0026, xera solo=0.0310) — pero
  esas corridas usaron conjuntos de muestras DISTINTOS (distinta cantidad
  de descartes), así que la comparación no era limpia. Corregido: ahora
  wOBA-solo y xERA-solo se recalculan aquí mismo, con
  f5CalibracionCombinadoRegresionSimple(), sobre EXACTAMENTE el mismo
  conjunto de muestras que el combinado (mismo n para los tres números).

  NO_CONFIRMADO — pendiente de correr la página de prueba.

  FECHA:
  12 jul 2026.
*/

var F5_CALIBRACION_COMBINADO_MINIMO_MUESTRAS = 30;

function f5CalibracionCombinadoLeerCarreraje() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_CARRERAJE_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function f5CalibracionCombinadoLeerLineup() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_LINEUP_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function f5CalibracionCombinadoMedia(arr) {
  if (!arr.length) return null;
  return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
}

// Regresion lineal de UN predictor (misma matematica que las pruebas
// individuales anteriores), usada aqui para recalcular woba-solo y
// xera-solo SOBRE EL MISMO conjunto de muestras que el combinado -- nunca
// contra un R2 de otra corrida con otro tamano de muestra.
function f5CalibracionCombinadoRegresionSimple(xs, ys) {
  var n = xs.length;
  var xBar = f5CalibracionCombinadoMedia(xs);
  var yBar = f5CalibracionCombinadoMedia(ys);

  var num = 0, denX = 0, SStot = 0;
  for (var i = 0; i < n; i++) {
    var dx = xs[i] - xBar, dy = ys[i] - yBar;
    num += dx * dy;
    denX += dx * dx;
    SStot += dy * dy;
  }

  if (denX === 0 || SStot === 0) return null;

  var pendiente = num / denX;
  var intercepto = yBar - pendiente * xBar;

  var sumaErrCuad = 0;
  for (var j = 0; j < n; j++) {
    var pred = pendiente * xs[j] + intercepto;
    sumaErrCuad += Math.pow(ys[j] - pred, 2);
  }

  var r2 = 1 - (sumaErrCuad / SStot);

  return { n_muestras: n, r_cuadrado: Math.round(r2 * 10000) / 10000 };
}

// Regresion lineal de DOS predictores (x1=woba_esperado, x2=xera) por
// minimos cuadrados, via ecuaciones normales centradas (matriz 2x2,
// resuelta con Cramer). Devuelve null si no hay variacion suficiente.
function f5CalibracionCombinadoRegresion(muestras) {
  var n = muestras.length;
  var x1s = muestras.map(function (m) { return m.woba_esperado; });
  var x2s = muestras.map(function (m) { return m.xera; });
  var ys = muestras.map(function (m) { return m.runs_reales; });

  var x1Bar = f5CalibracionCombinadoMedia(x1s);
  var x2Bar = f5CalibracionCombinadoMedia(x2s);
  var yBar = f5CalibracionCombinadoMedia(ys);

  var S11 = 0, S22 = 0, S12 = 0, S1y = 0, S2y = 0, SStot = 0;
  for (var i = 0; i < n; i++) {
    var d1 = x1s[i] - x1Bar, d2 = x2s[i] - x2Bar, dy = ys[i] - yBar;
    S11 += d1 * d1; S22 += d2 * d2; S12 += d1 * d2;
    S1y += d1 * dy; S2y += d2 * dy; SStot += dy * dy;
  }

  var det = S11 * S22 - S12 * S12;
  if (Math.abs(det) < 1e-12 || SStot === 0) return null;

  var b1 = (S1y * S22 - S2y * S12) / det;
  var b2 = (S11 * S2y - S12 * S1y) / det;
  var b0 = yBar - b1 * x1Bar - b2 * x2Bar;

  var sumaErrCuad = 0, sumaErrAbs = 0;
  for (var j = 0; j < n; j++) {
    var pred = b0 + b1 * x1s[j] + b2 * x2s[j];
    var err = ys[j] - pred;
    sumaErrCuad += err * err;
    sumaErrAbs += Math.abs(err);
  }

  var r2 = 1 - (sumaErrCuad / SStot);

  return {
    n_muestras: n,
    r_cuadrado: Math.round(r2 * 10000) / 10000,
    intercepto: Math.round(b0 * 100000) / 100000,
    coef_woba_esperado: Math.round(b1 * 100000) / 100000,
    coef_xera: Math.round(b2 * 100000) / 100000,
    rmse: Math.round(Math.sqrt(sumaErrCuad / n) * 1000) / 1000,
    mae: Math.round((sumaErrAbs / n) * 1000) / 1000
  };
}

function calcularF5CalibracionCombinado(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  if (typeof calcularFactorArsenalLineup !== "function") {
    return { estado: "SIN_DEPENDENCIA_CARGADA", detalle: "Falta factor-arsenal-lineup.js (y arsenal-master.js / batters-vspitch.js)." };
  }
  if (typeof PITCHERS_MASTER_2026 === "undefined") {
    return { estado: "SIN_DEPENDENCIA_CARGADA", detalle: "Falta pitchers-master.js." };
  }

  var carreraje = f5CalibracionCombinadoLeerCarreraje();
  var lineup = f5CalibracionCombinadoLeerLineup();
  log("Juegos en F5_HISTORICO_CARRERAJE_2026: " + carreraje.length);
  log("Juegos en F5_HISTORICO_LINEUP_2026: " + lineup.length);

  var mapaLineup = new Map();
  lineup.forEach(function (r) { mapaLineup.set(r.gamePk, r); });

  var muestras = [];
  var descartadosSinLineup = 0;
  var descartadosSinAmbasMetricas = 0;

  carreraje.forEach(function (rc) {
    var rl = mapaLineup.get(rc.gamePk);
    if (!rl) { descartadosSinLineup++; return; }

    var pHome = PITCHERS_MASTER_2026[rc.home_pitcher_id];
    var pAway = PITCHERS_MASTER_2026[rc.away_pitcher_id];
    var xeraHome = pHome && typeof pHome.xera === "number" && Number.isFinite(pHome.xera) ? pHome.xera : null;
    var xeraAway = pAway && typeof pAway.xera === "number" && Number.isFinite(pAway.xera) ? pAway.xera : null;

    if (xeraHome !== null && typeof rc.f5_runs_away === "number" && Number.isFinite(rc.f5_runs_away)) {
      var cruceHome = calcularFactorArsenalLineup(rc.home_pitcher_id, rl.lineup_away);
      if (cruceHome.confirmado) {
        muestras.push({ woba_esperado: cruceHome.woba_esperado, xera: xeraHome, runs_reales: rc.f5_runs_away, gamePk: rc.gamePk });
      } else { descartadosSinAmbasMetricas++; }
    } else { descartadosSinAmbasMetricas++; }

    if (xeraAway !== null && typeof rc.f5_runs_home === "number" && Number.isFinite(rc.f5_runs_home)) {
      var cruceAway = calcularFactorArsenalLineup(rc.away_pitcher_id, rl.lineup_home);
      if (cruceAway.confirmado) {
        muestras.push({ woba_esperado: cruceAway.woba_esperado, xera: xeraAway, runs_reales: rc.f5_runs_home, gamePk: rc.gamePk });
      } else { descartadosSinAmbasMetricas++; }
    } else { descartadosSinAmbasMetricas++; }
  });

  log("Muestras validas (woba_esperado confirmado + xera confirmado): " + muestras.length);
  log("Descartadas sin lineup: " + descartadosSinLineup);
  log("Descartadas por faltar alguna de las dos metricas: " + descartadosSinAmbasMetricas);

  if (muestras.length < F5_CALIBRACION_COMBINADO_MINIMO_MUESTRAS) {
    return {
      estado: "SIN_MUESTRA_SUFICIENTE",
      detalle: "Hay " + muestras.length + " muestra(s) validas; se necesitan al menos " + F5_CALIBRACION_COMBINADO_MINIMO_MUESTRAS + ".",
      n_muestras: muestras.length
    };
  }

  var backtest = f5CalibracionCombinadoRegresion(muestras);
  if (!backtest) {
    return { estado: "SIN_VARIACION_SUFICIENTE", detalle: "No hay variacion suficiente para calcular la regresion.", n_muestras: muestras.length };
  }

  // wOBA-solo y xERA-solo, recalculados AQUI sobre EL MISMO conjunto de
  // muestras que el combinado -- nunca contra el R2 de otra corrida con
  // otro tamano de muestra (eso no seria una comparacion limpia).
  var wobaSolo = f5CalibracionCombinadoRegresionSimple(
    muestras.map(function (m) { return m.woba_esperado; }),
    muestras.map(function (m) { return m.runs_reales; })
  );
  var xeraSolo = f5CalibracionCombinadoRegresionSimple(
    muestras.map(function (m) { return m.xera; }),
    muestras.map(function (m) { return m.runs_reales; })
  );

  log("Backtest combinado: R2=" + backtest.r_cuadrado + " | RMSE=" + backtest.rmse);
  log("wOBA solo (mismas muestras): R2=" + (wobaSolo ? wobaSolo.r_cuadrado : "N/C"));
  log("xERA solo (mismas muestras): R2=" + (xeraSolo ? xeraSolo.r_cuadrado : "N/C"));

  return {
    estado: "BACKTEST_CALCULADO",
    detalle: "Regresion woba_esperado + xera sobre " + muestras.length + " muestras. wOBA-solo y xERA-solo recalculados sobre ESTE MISMO conjunto de muestras (comparacion limpia), no contra corridas anteriores con distinto tamano de muestra.",
    n_muestras: muestras.length,
    descartados_sin_lineup: descartadosSinLineup,
    descartados_sin_ambas_metricas: descartadosSinAmbasMetricas,
    backtest_combinado: backtest,
    comparacion: {
      woba_solo_r2: wobaSolo ? wobaSolo.r_cuadrado : null,
      xera_solo_r2: xeraSolo ? xeraSolo.r_cuadrado : null,
      combinado_r2: backtest.r_cuadrado,
      n_muestras_identico_para_los_tres: muestras.length
    }
  };
}
