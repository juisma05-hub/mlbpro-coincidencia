/*
  MLBPro · f5-calibracion-moneyline.js

  FUNCIÓN:
  Audita la calibración empírica de Moneyline F5 usando las cachés reales
  F5_HISTORICO_CARRERAJE_2026 y F5_HISTORICO_LINEUP_2026.

  Compatible con f5-moneyline.js que devuelve:
    estado: "PORCENTAJE_EMPIRICO"
    porcentajeLocal
    porcentajeVisitante
    porcentajeEmpate
    porcentajeLocalDosVias
    porcentajeVisitanteDosVias
    seleccion
    muestra
    base_historica

  No escribe caché. No toca K6, Over/Under ni línea de juego completo.
*/

var F5_CALIB_ML_MIN_MUESTRA_BUCKET = 20;
var F5_CALIB_ML_MIN_MUESTRA_VALIDACION = 30;

function _f5CalibMLNormId(v) {
  if (v === null || v === undefined) return null;

  var s = String(v).trim();

  return s === "" ? null : s;
}

function _f5CalibMLLeerCache(llave) {
  try {
    var raw = localStorage.getItem(llave);

    if (!raw) return [];

    var arr = JSON.parse(raw);

    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function _f5CalibMLClaseGanador(home, away) {
  if (home > away) return "LOCAL";
  if (away > home) return "VISITANTE";

  return "EMPATE";
}

function _f5CalibMLDistribucion(registros) {
  var conteos = {
    LOCAL: 0,
    VISITANTE: 0,
    EMPATE: 0
  };

  registros.forEach(function (r) {
    if (conteos.hasOwnProperty(r.resultado)) {
      conteos[r.resultado]++;
    }
  });

  var n = registros.length;

  return {
    n: n,

    conteos: conteos,

    porcentajes: {
      LOCAL:
        n > 0
          ? Math.round((conteos.LOCAL / n) * 1000) / 10
          : null,

      VISITANTE:
        n > 0
          ? Math.round((conteos.VISITANTE / n) * 1000) / 10
          : null,

      EMPATE:
        n > 0
          ? Math.round((conteos.EMPATE / n) * 1000) / 10
          : null
    },

    probabilidades: {
      LOCAL:
        n > 0
          ? conteos.LOCAL / n
          : null,

      VISITANTE:
        n > 0
          ? conteos.VISITANTE / n
          : null,

      EMPATE:
        n > 0
          ? conteos.EMPATE / n
          : null
    }
  };
}

function _f5CalibMLAccuracyBrier(
  registros,
  obtenerProbabilidades
) {
  var aciertos = 0;
  var sumaBrier = 0;
  var usados = 0;

  var clases = [
    "LOCAL",
    "VISITANTE",
    "EMPATE"
  ];

  registros.forEach(function (r) {
    var probs = obtenerProbabilidades(r);

    if (
      !probs ||
      typeof probs.LOCAL !== "number" ||
      typeof probs.VISITANTE !== "number" ||
      typeof probs.EMPATE !== "number"
    ) {
      return;
    }

    var mejor = clases[0];

    clases.forEach(function (c) {
      if (probs[c] > probs[mejor]) {
        mejor = c;
      }
    });

    if (mejor === r.resultado) {
      aciertos++;
    }

    var brierJuego = 0;

    clases.forEach(function (c) {
      var real = c === r.resultado ? 1 : 0;

      brierJuego += Math.pow(
        probs[c] - real,
        2
      );
    });

    sumaBrier += brierJuego;
    usados++;
  });

  return {
    n: usados,

    accuracy:
      usados > 0
        ? Math.round((aciertos / usados) * 10000) / 10000
        : null,

    brier:
      usados > 0
        ? Math.round((sumaBrier / usados) * 10000) / 10000
        : null
  };
}

function calcularF5CalibracionMoneyline(logFn) {
  function log(t) {
    if (typeof logFn === "function") {
      logFn(t);
    }
  }

  if (
    typeof calcularFactorArsenalLineup !== "function"
  ) {
    return {
      estado: "SIN_DEPENDENCIA",

      detalle:
        "Falta calcularFactorArsenalLineup()."
    };
  }

  if (
    typeof f5Carreraje !== "function"
  ) {
    return {
      estado: "SIN_DEPENDENCIA",

      detalle:
        "Falta f5Carreraje()."
    };
  }

  if (
    typeof f5MoneyLine !== "function"
  ) {
    return {
      estado: "SIN_DEPENDENCIA",

      detalle:
        "Falta f5MoneyLine()."
    };
  }

  var carrerajeRaw =
    _f5CalibMLLeerCache(
      "F5_HISTORICO_CARRERAJE_2026"
    );

  var lineupRaw =
    _f5CalibMLLeerCache(
      "F5_HISTORICO_LINEUP_2026"
    );

  log(
    "Carreraje: " +
    carrerajeRaw.length
  );

  log(
    "Lineups: " +
    lineupRaw.length
  );

  var lineupPorGamePk = new Map();

  lineupRaw.forEach(function (r) {
    var key =
      _f5CalibMLNormId(
        r && r.gamePk
      );

    if (
      key &&
      Array.isArray(r.lineup_home) &&
      r.lineup_home.length === 9 &&
      Array.isArray(r.lineup_away) &&
      r.lineup_away.length === 9
    ) {
      lineupPorGamePk.set(
        key,
        r
      );
    }
  });

  var descartes = {};
  var registros = [];

  function descartar(motivo) {
    descartes[motivo] =
      (descartes[motivo] || 0) + 1;
  }

  carrerajeRaw.forEach(function (rc) {
    var key =
      _f5CalibMLNormId(
        rc && rc.gamePk
      );

    if (!key) {
      descartar("SIN_GAMEPK");
      return;
    }

    var lineup =
      lineupPorGamePk.get(key);

    if (!lineup) {
      descartar("SIN_LINEUP");
      return;
    }

    if (
      typeof rc.f5_runs_home !== "number" ||
      !Number.isFinite(rc.f5_runs_home) ||
      typeof rc.f5_runs_away !== "number" ||
      !Number.isFinite(rc.f5_runs_away)
    ) {
      descartar(
        "SIN_RESULTADO_F5"
      );

      return;
    }

    var cruceHome;
    var cruceAway;

    try {
      cruceHome =
        calcularFactorArsenalLineup(
          rc.home_pitcher_id,
          lineup.lineup_away
        );

      cruceAway =
        calcularFactorArsenalLineup(
          rc.away_pitcher_id,
          lineup.lineup_home
        );
    } catch (e) {
      descartar(
        "ERROR_CRUCE_ARSENAL"
      );

      return;
    }

    var carrHome =
      f5Carreraje(
        cruceHome,
        null
      );

    var carrAway =
      f5Carreraje(
        cruceAway,
        null
      );

    if (
      !carrHome ||
      carrHome.estado !==
        "DOMINIO_CALCULADO"
    ) {
      descartar(
        "HOME_" +
        (
          carrHome &&
          carrHome.estado
            ? carrHome.estado
            : "SIN_RESPUESTA"
        )
      );

      return;
    }

    if (
      !carrAway ||
      carrAway.estado !==
        "DOMINIO_CALCULADO"
    ) {
      descartar(
        "AWAY_" +
        (
          carrAway &&
          carrAway.estado
            ? carrAway.estado
            : "SIN_RESPUESTA"
        )
      );

      return;
    }

    registros.push({
      gamePk: key,

      date:
        rc.date ||
        lineup.date ||
        "",

      resultado:
        _f5CalibMLClaseGanador(
          rc.f5_runs_home,
          rc.f5_runs_away
        ),

      dominioHome:
        carrHome.dominioPitcher,

      dominioAway:
        carrAway.dominioPitcher,

      wobaHome:
        carrHome.wobaEsperado,

      wobaAway:
        carrAway.wobaEsperado,

      carrerajeHome:
        carrHome,

      carrerajeAway:
        carrAway
    });
  });

  registros.sort(function (a, b) {
    return String(a.date)
      .localeCompare(
        String(b.date)
      );
  });

  var puntoCorte =
    Math.floor(
      registros.length * 0.7
    );

  var desarrollo =
    registros.slice(
      0,
      puntoCorte
    );

  var validacion =
    registros.slice(
      puntoCorte
    );

  var bucketsDesarrollo = {};
  var bucketsValidacion = {};

  function bucketKey(r) {
    return (
      r.dominioHome +
      "|" +
      r.dominioAway
    );
  }

  desarrollo.forEach(function (r) {
    var key = bucketKey(r);

    if (!bucketsDesarrollo[key]) {
      bucketsDesarrollo[key] = [];
    }

    bucketsDesarrollo[key].push(r);
  });

  validacion.forEach(function (r) {
    var key = bucketKey(r);

    if (!bucketsValidacion[key]) {
      bucketsValidacion[key] = [];
    }

    bucketsValidacion[key].push(r);
  });

  var claves = {};

  Object.keys(
    bucketsDesarrollo
  ).forEach(function (k) {
    claves[k] = true;
  });

  Object.keys(
    bucketsValidacion
  ).forEach(function (k) {
    claves[k] = true;
  });

  var tablaBuckets = {};

  Object.keys(claves)
    .forEach(function (key) {
      var dev =
        bucketsDesarrollo[key] || [];

      var val =
        bucketsValidacion[key] || [];

      var distDev =
        _f5CalibMLDistribucion(dev);

      var distVal =
        _f5CalibMLDistribucion(val);

      tablaBuckets[key] = {
        estadoDesarrollo:
          distDev.n >=
          F5_CALIB_ML_MIN_MUESTRA_BUCKET
            ? "MUESTRA_CONFIRMADA"
            : "MUESTRA_INSUFICIENTE",

        estadoValidacion:
          distVal.n >=
          F5_CALIB_ML_MIN_MUESTRA_BUCKET
            ? "MUESTRA_CONFIRMADA"
            : "MUESTRA_INSUFICIENTE",

        desarrollo:
          distDev,

        validacion:
          distVal
      };
    });

  var distribucionGlobalDev =
    _f5CalibMLDistribucion(
      desarrollo
    );

  function probabilidadesModelo(r) {
    var bucket =
      tablaBuckets[
        bucketKey(r)
      ];

    if (
      bucket &&
      bucket.estadoDesarrollo ===
        "MUESTRA_CONFIRMADA"
    ) {
      return bucket
        .desarrollo
        .probabilidades;
    }

    return distribucionGlobalDev
      .probabilidades;
  }

  function probabilidadesBaseline() {
    return distribucionGlobalDev
      .probabilidades;
  }

  var modelo =
    _f5CalibMLAccuracyBrier(
      validacion,
      probabilidadesModelo
    );

  var baseline =
    _f5CalibMLAccuracyBrier(
      validacion,
      probabilidadesBaseline
    );

  var validado =
    modelo.n >=
      F5_CALIB_ML_MIN_MUESTRA_VALIDACION &&

    modelo.accuracy !== null &&

    baseline.accuracy !== null &&

    modelo.brier !== null &&

    baseline.brier !== null &&

    modelo.accuracy >
      baseline.accuracy &&

    modelo.brier <
      baseline.brier;

  var pruebaMoneyline = null;

  if (validacion.length) {
    var ultimo =
      validacion[
        validacion.length - 1
      ];

    pruebaMoneyline =
      f5MoneyLine(
        ultimo.carrerajeHome,
        ultimo.carrerajeAway,
        null
      );
  }

  log(
    "Elegibles: " +
    registros.length +
    " | Desarrollo: " +
    desarrollo.length +
    " | Validación: " +
    validacion.length
  );

  log(
    "Modelo accuracy: " +
    modelo.accuracy +
    " | Brier: " +
    modelo.brier
  );

  log(
    "Baseline accuracy: " +
    baseline.accuracy +
    " | Brier: " +
    baseline.brier
  );

  log(
    validado
      ? "RESULTADO: VALIDADO"
      : "RESULTADO: NO_VALIDADO"
  );

  return {
    estado:
      "CALIBRACION_CALCULADA",

    conteos: {
      carrerajeCargado:
        carrerajeRaw.length,

      lineupsCargados:
        lineupRaw.length,

      elegibles:
        registros.length,

      descartes:
        descartes
    },

    desarrollo: {
      n:
        desarrollo.length
    },

    validacion: {
      n:
        validacion.length
    },

    distribucionGlobalDev:
      distribucionGlobalDev,

    tablaBuckets:
      tablaBuckets,

    modelo:
      modelo,

    baseline:
      baseline,

    validado:
      validado,

    pruebaMoneyline:
      pruebaMoneyline
  };
}

if (
  typeof module !== "undefined"
) {
  module.exports = {
    calcularF5CalibracionMoneyline:
      calcularF5CalibracionMoneyline
  };
}
