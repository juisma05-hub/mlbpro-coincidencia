/*
  MLBPro · f5-calibracion-carreraje.js

  FUNCIÓN:
  Corre el backtest real, con evidencia, que decide si existe (y qué tan
  fuerte es) una relación entre woba_esperado (el cruce arsenal-vs-lineup
  que ya calcula calcularFactorArsenalLineup()) y las carreras reales de
  F5 anotadas en juegos históricos. NO escribe ninguna fórmula en
  f5-carreraje.js — solo entrega las métricas reales (correlación, R²,
  pendiente, intercepto, error) para que se decida, con esos números
  delante, si vale la pena calibrar el motor con ellos.

  CAMBIO DE ALCANCE RESPECTO A LA VERSIÓN ANTERIOR (misma sesión):
  La primera versión de este archivo leía EXCLUSIVAMENTE
  F5_HISTORICO_CARRERAJE_2026 y no podía avanzar, porque calcular
  woba_esperado por juego requiere el lineup real de bateadores rivales
  de ESE juego — dato que en ese momento no existía. Ahora que
  f5-historico-lineup.js capturó F5_HISTORICO_LINEUP_2026 (lineup real de
  9 titulares por juego), esta pieza SÍ puede reconstruir el cruce real
  por juego. Para eso necesita, además de las dos cachés históricas,
  LLAMAR a calcularFactorArsenalLineup() (factor-arsenal-lineup.js) tal
  como está — nunca reimplementa esa lógica por su cuenta, para no
  arriesgar una segunda versión de la fórmula que se desincronice de la
  real. Esto es una ampliación de dependencias deliberada, no un cruce
  accidental.

  ENTRADAS:
  logFn (function, opcional) — callback para mostrar progreso en consola.
  No hace ningún fetch: todo sale de localStorage (dos llaves) y de la
  función real calcularFactorArsenalLineup() ya cargada en la página.

  SALIDAS / MODIFICACIONES:
  No escribe ninguna caché ni localStorage — es de SOLO LECTURA en las dos
  llaves:
    - "F5_HISTORICO_CARRERAJE_2026" (gamePk, pitchers, f5_runs_home/away)
    - "F5_HISTORICO_LINEUP_2026"   (gamePk, lineup_home/away reales)
  No escribe en ninguna otra caché. No modifica factor-arsenal-lineup.js,
  arsenal-master.js, batters-vspitch.js, f5-carreraje.js, f5-moneyline.js,
  f5-automatico.js.

  EMPAREJAMIENTO EXACTO (el punto donde un cruce mal hecho rompería todo
  en silencio, documentado aquí a propósito):
  Por cada juego, se arman DOS muestras, no una:
    1) calcularFactorArsenalLineup(home_pitcher_id, lineup_away)
       → ese woba_esperado se compara contra f5_runs_away (las carreras
         que anotó el equipo AWAY, porque el equipo away batea contra el
         pitcher HOME). Mismo mapeo que ya usa f5-automatico.js para
         "carrerajeHome".
    2) calcularFactorArsenalLineup(away_pitcher_id, lineup_home)
       → ese woba_esperado se compara contra f5_runs_home (las carreras
         que anotó el equipo HOME, porque el equipo home batea contra el
         pitcher AWAY). Mismo mapeo que ya usa f5-automatico.js para
         "carrerajeAway".
  Cada muestra solo se usa si calcularFactorArsenalLineup() la marca
  confirmado:true (>=5 bateadores con dato real, el mismo umbral que ya
  usa esa función en producción) — nunca se usa un cruce con muestra
  pobre.

  ADVERTENCIA METODOLÓGICA (no se oculta, se reporta con el resultado):
  ARSENAL_MASTER_2026 y BATTERS_VSPITCH_2026 son snapshots de TEMPORADA
  COMPLETA actual, no el arsenal/bateo que existía en la fecha real de
  cada juego histórico. Esto es una aproximación (usa información que en
  la fecha del juego pasado técnicamente no existía todavía) — el backtest
  resultante es útil como primera señal, pero no es un backtest
  point-in-time perfectamente limpio. Este archivo lo declara en su
  propio resultado (advertencia_metodologica), nunca lo presenta como
  validación perfecta.

  DEPENDENCIAS:
  factor-arsenal-lineup.js (calcularFactorArsenalLineup, sin modificarlo),
  que a su vez necesita arsenal-master.js (ARSENAL_MASTER_2026) y
  batters-vspitch.js (BATTERS_VSPITCH_2026) ya cargados como <script>
  antes que este archivo. No depende de mlb-routes.js (no hace fetch).

  NO TOCA:
  f5-carreraje.js, f5-moneyline.js, f5-automatico.js, factor-arsenal-
  lineup.js, arsenal-master.js, batters-vspitch.js (los llama, no los
  modifica), clima-cache.js, jalar-clima.js, K6, brújula.

  UTC / HORA LOCAL DEL ESTADIO:
  No aplica — no usa horarios ni timezone.

  ESTADO:
  Pieza de backtest/diagnóstico. Su salida NO es una fórmula aprobada:
  es evidencia (correlación, R², pendiente, intercepto, error, tamaño de
  muestra) para decidir, en un paso separado y explícito, si se alimenta
  f5-carreraje.js con ella. NO_CONFIRMADO — pendiente de correr la página
  de prueba con los datos reales ya capturados.

  FECHA:
  12 jul 2026.
*/

var F5_CALIBRACION_MINIMO_MUESTRAS = 30;

function f5CalibracionLeerCarreraje() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_CARRERAJE_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function f5CalibracionLeerLineup() {
  try {
    var raw = localStorage.getItem("F5_HISTORICO_LINEUP_2026");
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function f5CalibracionMedia(arr) {
  if (!arr.length) return null;
  return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
}

// Regresión lineal simple + correlación de Pearson + errores, sobre pares
// (x=woba_esperado, y=carreras reales de F5). Devuelve null si no hay
// variación suficiente en x o y para calcular una correlación real.
function f5CalibracionRegresion(muestras) {
  var n = muestras.length;
  var xs = muestras.map(function (m) { return m.woba_esperado; });
  var ys = muestras.map(function (m) { return m.runs_reales; });

  var xBar = f5CalibracionMedia(xs);
  var yBar = f5CalibracionMedia(ys);

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

  var rmse = Math.sqrt(sumaErrCuad / n);
  var mae = sumaErrAbs / n;

  return {
    n_muestras: n,
    correlacion_r: Math.round(r * 10000) / 10000,
    r_cuadrado: Math.round(r2 * 10000) / 10000,
    pendiente: Math.round(pendiente * 100000) / 100000,
    intercepto: Math.round(intercepto * 100000) / 100000,
    rmse: Math.round(rmse * 1000) / 1000,
    mae: Math.round(mae * 1000) / 1000,
    rango_woba_esperado: { min: Math.min.apply(null, xs), max: Math.max.apply(null, xs) },
    rango_runs_reales: { min: Math.min.apply(null, ys), max: Math.max.apply(null, ys) }
  };
}

function calcularF5Calibracion(logFn) {
  function log(t) { if (typeof logFn === "function") logFn(t); }

  if (typeof calcularFactorArsenalLineup !== "function") {
    return {
      estado: "SIN_DEPENDENCIA_CARGADA",
      detalle: "calcularFactorArsenalLineup() no está disponible. Falta cargar factor-arsenal-lineup.js (y arsenal-master.js / batters-vspitch.js) antes que este archivo."
    };
  }

  var carreraje = f5CalibracionLeerCarreraje();
  var lineup = f5CalibracionLeerLineup();

  log("Juegos en F5_HISTORICO_CARRERAJE_2026: " + carreraje.length);
  log("Juegos en F5_HISTORICO_LINEUP_2026: " + lineup.length);

  var mapaLineup = new Map();
  lineup.forEach(function (r) { mapaLineup.set(r.gamePk, r); });

  var muestras = [];
  var muestrasHomePitcher = [];
  var muestrasAwayPitcher = [];

  var descartadosSinLineup = 0;
  var descartadosCruceNoConfirmado = 0;
  var juegosCruzados = 0;

  carreraje.forEach(function (rc) {
    var rl = mapaLineup.get(rc.gamePk);
    if (!rl) { descartadosSinLineup++; return; }
    juegosCruzados++;

    // 1) pitcher HOME vs lineup AWAY -> predice f5_runs_away.
    if (typeof rc.f5_runs_away === "number" && Number.isFinite(rc.f5_runs_away)) {
      var cruceHomePitcher = calcularFactorArsenalLineup(rc.home_pitcher_id, rl.lineup_away);
      if (cruceHomePitcher.confirmado) {
        var muestraA = { woba_esperado: cruceHomePitcher.woba_esperado, runs_reales: rc.f5_runs_away, gamePk: rc.gamePk };
        muestras.push(muestraA);
        muestrasHomePitcher.push(muestraA);
      } else {
        descartadosCruceNoConfirmado++;
      }
    }

    // 2) pitcher AWAY vs lineup HOME -> predice f5_runs_home.
    if (typeof rc.f5_runs_home === "number" && Number.isFinite(rc.f5_runs_home)) {
      var cruceAwayPitcher = calcularFactorArsenalLineup(rc.away_pitcher_id, rl.lineup_home);
      if (cruceAwayPitcher.confirmado) {
        var muestraB = { woba_esperado: cruceAwayPitcher.woba_esperado, runs_reales: rc.f5_runs_home, gamePk: rc.gamePk };
        muestras.push(muestraB);
        muestrasAwayPitcher.push(muestraB);
      } else {
        descartadosCruceNoConfirmado++;
      }
    }
  });

  log("Juegos cruzados (carreraje + lineup por gamePk): " + juegosCruzados);
  log("Descartados sin lineup: " + descartadosSinLineup);
  log("Descartados por cruce no confirmado (<5 bateadores con dato): " + descartadosCruceNoConfirmado);
  log("Muestras validas totales (2 por juego, home+away pitcher): " + muestras.length);

  if (muestras.length < F5_CALIBRACION_MINIMO_MUESTRAS) {
    return {
      estado: "SIN_MUESTRA_SUFICIENTE",
      detalle: "Hay " + muestras.length + " muestra(s) valida(s); se necesitan al menos " +
        F5_CALIBRACION_MINIMO_MUESTRAS + " para calcular un backtest con algun sentido estadistico.",
      n_muestras: muestras.length,
      minimo_requerido: F5_CALIBRACION_MINIMO_MUESTRAS,
      juegos_cruzados: juegosCruzados,
      descartados_sin_lineup: descartadosSinLineup,
      descartados_cruce_no_confirmado: descartadosCruceNoConfirmado
    };
  }

  var backtestGeneral = f5CalibracionRegresion(muestras);
  var backtestHomePitcher = muestrasHomePitcher.length >= F5_CALIBRACION_MINIMO_MUESTRAS ? f5CalibracionRegresion(muestrasHomePitcher) : null;
  var backtestAwayPitcher = muestrasAwayPitcher.length >= F5_CALIBRACION_MINIMO_MUESTRAS ? f5CalibracionRegresion(muestrasAwayPitcher) : null;

  if (!backtestGeneral) {
    return {
      estado: "SIN_VARIACION_SUFICIENTE",
      detalle: "Hay " + muestras.length + " muestras, pero woba_esperado o runs_reales no varian lo suficiente para calcular una correlacion real (denominador cero).",
      n_muestras: muestras.length
    };
  }

  log("Backtest general: r=" + backtestGeneral.correlacion_r + " | R2=" + backtestGeneral.r_cuadrado + " | RMSE=" + backtestGeneral.rmse);

  return {
    estado: "BACKTEST_CALCULADO",
    detalle: "Backtest real sobre " + muestras.length + " muestras (" + juegosCruzados + " juegos cruzados). " +
      "Esto es evidencia para decidir si calibrar f5-carreraje.js -- NO es una formula ya aprobada.",
    n_muestras: muestras.length,
    juegos_cruzados: juegosCruzados,
    descartados_sin_lineup: descartadosSinLineup,
    descartados_cruce_no_confirmado: descartadosCruceNoConfirmado,
    backtest_general: backtestGeneral,
    backtest_pitcher_home_vs_lineup_away: backtestHomePitcher,
    backtest_pitcher_away_vs_lineup_home: backtestAwayPitcher,
    advertencia_metodologica: "ARSENAL_MASTER_2026 y BATTERS_VSPITCH_2026 son snapshots de temporada completa actual, no el dato que existia en la fecha real de cada juego historico. Esto es una aproximacion razonable, NO un backtest point-in-time perfectamente limpio."
  };
}
