/*
  MLBPro · f5-moneyline.js

  FUNCIÓN:
  Calcula porcentajes empíricos de Moneyline F5:
  LOCAL / VISITANTE / EMPATE.

  Usa únicamente:
  - F5_HISTORICO_CARRERAJE_2026
  - F5_HISTORICO_LINEUP_2026
  - calcularFactorArsenalLineup()
  - f5Carreraje()

  Reconstruye los buckets históricos:
  dominioPitcherLocal | dominioPitcherVisitante.

  Usa el 70% cronológico de desarrollo, igual que la calibración validada.
  Un bucket necesita mínimo 20 juegos. Si no alcanza, devuelve
  MUESTRA_INSUFICIENTE y no inventa porcentajes.

  La comparación contra mercado es opcional mediante:
    f5MoneyLine(carrerajeLocal, carrerajeVisitante, lineaMercadoF5)

  CORREGIDO 20 jul 2026:
  - Primero lee los históricos cargados como variables globales.
  - Usa localStorage únicamente como respaldo.
  - Admite cachés directas o envueltas en juegos/registros/data.

  FECHA:
  20 jul 2026.

  ESTADO:
  CONECTADO A CALIBRACIÓN EMPÍRICA VALIDADA.
*/

var F5_ML_MIN_MUESTRA_BUCKET = 20;
var _f5MlModeloCache = null;

function _f5MlEsNumero(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function _f5MlRedondear(v, decimales) {
  if (!_f5MlEsNumero(v)) return null;

  var factor = Math.pow(10, decimales);

  return Math.round(v * factor) / factor;
}

function _f5MlLeerCache(llave) {
  /*
    Fuente principal:
    históricos cargados como variables globales por sus archivos JS.

    Ejemplos:
      globalThis.F5_HISTORICO_CARRERAJE_2026
      globalThis.F5_HISTORICO_LINEUP_2026
  */
  try {
    if (
      typeof globalThis !== "undefined" &&
      Array.isArray(globalThis[llave])
    ) {
      return globalThis[llave];
    }
  } catch (eGlobal) {}

  /*
    Respaldo:
    permite leer el histórico desde localStorage.
  */
  try {
    var raw = localStorage.getItem(llave);

    if (!raw) return [];

    var dato = JSON.parse(raw);

    if (Array.isArray(dato)) {
      return dato;
    }

    if (
      dato &&
      Array.isArray(dato.juegos)
    ) {
      return dato.juegos;
    }

    if (
      dato &&
      Array.isArray(dato.registros)
    ) {
      return dato.registros;
    }

    if (
      dato &&
      Array.isArray(dato.data)
    ) {
      return dato.data;
    }

    return [];
  } catch (e) {
    return [];
  }
}

function _f5MlNormId(v) {
  if (
    v === null ||
    v === undefined
  ) {
    return null;
  }

  var s = String(v).trim();

  return s === ""
    ? null
    : s;
}

function _f5MlResultado(
  homeRuns,
  awayRuns
) {
  if (homeRuns > awayRuns) {
    return "LOCAL";
  }

  if (awayRuns > homeRuns) {
    return "VISITANTE";
  }

  return "EMPATE";
}

function _f5MlProbabilidadAmericana(
  cuota
) {
  if (
    !_f5MlEsNumero(cuota) ||
    cuota === 0
  ) {
    return null;
  }

  if (cuota < 0) {
    return (
      -cuota /
      (
        -cuota +
        100
      )
    );
  }

  return (
    100 /
    (
      cuota +
      100
    )
  );
}

function _f5MlMercadoSinVig(
  lineaMercadoF5
) {
  if (
    !lineaMercadoF5 ||
    !lineaMercadoF5.moneylineF5
  ) {
    return null;
  }

  var cuotaHome =
    lineaMercadoF5
      .moneylineF5
      .home_price;

  var cuotaAway =
    lineaMercadoF5
      .moneylineF5
      .away_price;

  var probHome =
    _f5MlProbabilidadAmericana(
      cuotaHome
    );

  var probAway =
    _f5MlProbabilidadAmericana(
      cuotaAway
    );

  if (
    !_f5MlEsNumero(probHome) ||
    !_f5MlEsNumero(probAway)
  ) {
    return null;
  }

  var suma =
    probHome +
    probAway;

  if (suma <= 0) {
    return null;
  }

  return {
    cuotaHome:
      cuotaHome,

    cuotaAway:
      cuotaAway,

    porcentajeHome:
      _f5MlRedondear(
        (
          probHome /
          suma
        ) * 100,
        1
      ),

    porcentajeAway:
      _f5MlRedondear(
        (
          probAway /
          suma
        ) * 100,
        1
      )
  };
}

function _f5MlConstruirModelo() {
  if (_f5MlModeloCache) {
    return _f5MlModeloCache;
  }

  if (
    typeof calcularFactorArsenalLineup !==
    "function"
  ) {
    return {
      estado:
        "SIN_DEPENDENCIA",

      detalle:
        "Falta calcularFactorArsenalLineup()."
    };
  }

  if (
    typeof f5Carreraje !==
    "function"
  ) {
    return {
      estado:
        "SIN_DEPENDENCIA",

      detalle:
        "Falta f5Carreraje()."
    };
  }

  var carrerajeRaw =
    _f5MlLeerCache(
      "F5_HISTORICO_CARRERAJE_2026"
    );

  var lineupRaw =
    _f5MlLeerCache(
      "F5_HISTORICO_LINEUP_2026"
    );

  var lineupPorJuego =
    new Map();

  lineupRaw.forEach(
    function (r) {
      var key =
        _f5MlNormId(
          r &&
          r.gamePk
        );

      if (
        key &&
        Array.isArray(
          r.lineup_home
        ) &&
        r.lineup_home.length === 9 &&
        Array.isArray(
          r.lineup_away
        ) &&
        r.lineup_away.length === 9
      ) {
        lineupPorJuego.set(
          key,
          r
        );
      }
    }
  );

  var registros = [];
  var descartados = 0;

  carrerajeRaw.forEach(
    function (rc) {
      var key =
        _f5MlNormId(
          rc &&
          rc.gamePk
        );

      if (!key) {
        descartados++;
        return;
      }

      var lineup =
        lineupPorJuego.get(
          key
        );

      if (!lineup) {
        descartados++;
        return;
      }

      if (
        !_f5MlEsNumero(
          rc.f5_runs_home
        ) ||
        !_f5MlEsNumero(
          rc.f5_runs_away
        )
      ) {
        descartados++;
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
        descartados++;
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
          "DOMINIO_CALCULADO" ||
        !carrAway ||
        carrAway.estado !==
          "DOMINIO_CALCULADO"
      ) {
        descartados++;
        return;
      }

      registros.push({
        gamePk:
          key,

        date:
          rc.date ||
          lineup.date ||
          "",

        dominioLocal:
          carrHome
            .dominioPitcher,

        dominioVisitante:
          carrAway
            .dominioPitcher,

        resultado:
          _f5MlResultado(
            rc.f5_runs_home,
            rc.f5_runs_away
          )
      });
    }
  );

  registros.sort(
    function (a, b) {
      return String(a.date)
        .localeCompare(
          String(b.date)
        );
    }
  );

  var corte =
    Math.floor(
      registros.length *
      0.7
    );

  var desarrollo =
    registros.slice(
      0,
      corte
    );

  var buckets = {};

  desarrollo.forEach(
    function (r) {
      var key =
        r.dominioLocal +
        "|" +
        r.dominioVisitante;

      if (!buckets[key]) {
        buckets[key] = {
          n: 0,
          LOCAL: 0,
          VISITANTE: 0,
          EMPATE: 0
        };
      }

      buckets[key].n++;

      buckets[key][
        r.resultado
      ]++;
    }
  );

  Object.keys(buckets)
    .forEach(
      function (key) {
        var b =
          buckets[key];

        b.porcentajeLocal =
          _f5MlRedondear(
            (
              b.LOCAL /
              b.n
            ) * 100,
            1
          );

        b.porcentajeVisitante =
          _f5MlRedondear(
            (
              b.VISITANTE /
              b.n
            ) * 100,
            1
          );

        b.porcentajeEmpate =
          _f5MlRedondear(
            (
              b.EMPATE /
              b.n
            ) * 100,
            1
          );

        var decisiones =
          b.LOCAL +
          b.VISITANTE;

        b.porcentajeLocalDosVias =
          decisiones > 0
            ? _f5MlRedondear(
                (
                  b.LOCAL /
                  decisiones
                ) * 100,
                1
              )
            : null;

        b.porcentajeVisitanteDosVias =
          decisiones > 0
            ? _f5MlRedondear(
                (
                  b.VISITANTE /
                  decisiones
                ) * 100,
                1
              )
            : null;
      }
    );

  _f5MlModeloCache = {
    estado:
      "MODELO_LISTO",

    historicosCarreraje:
      carrerajeRaw.length,

    historicosLineup:
      lineupRaw.length,

    elegibles:
      registros.length,

    desarrollo:
      desarrollo.length,

    descartados:
      descartados,

    buckets:
      buckets
  };

  return _f5MlModeloCache;
}

function f5MoneyLine(
  carrerajeLocal,
  carrerajeVisitante,
  lineaMercadoF5
) {
  if (
    !carrerajeLocal ||
    !carrerajeVisitante
  ) {
    return {
      pieza:
        "F5_MONEYLINE",

      estado:
        "SIN_DATOS",

      detalle:
        "Falta Carreraje de uno o ambos lados."
    };
  }

  if (
    carrerajeLocal.estado !==
      "DOMINIO_CALCULADO" ||
    carrerajeVisitante.estado !==
      "DOMINIO_CALCULADO"
  ) {
    return {
      pieza:
        "F5_MONEYLINE",

      estado:
        "PENDIENTE",

      local:
        carrerajeLocal,

      visitante:
        carrerajeVisitante,

      detalle:
        "Uno o ambos dominios todavía no están calculados."
    };
  }

  var dominioLocal =
    carrerajeLocal
      .dominioPitcher;

  var dominioVisitante =
    carrerajeVisitante
      .dominioPitcher;

  var dominiosValidos = [
    "DOMINA",
    "PAREJO",
    "LE_PEGAN"
  ];

  if (
    dominiosValidos.indexOf(
      dominioLocal
    ) === -1 ||
    dominiosValidos.indexOf(
      dominioVisitante
    ) === -1
  ) {
    return {
      pieza:
        "F5_MONEYLINE",

      estado:
        "SIN_DATOS",

      dominioLocal:
        dominioLocal,

      dominioVisitante:
        dominioVisitante,

      detalle:
        "Dominio inválido recibido."
    };
  }

  var modelo =
    _f5MlConstruirModelo();

  if (
    !modelo ||
    modelo.estado !==
      "MODELO_LISTO"
  ) {
    return {
      pieza:
        "F5_MONEYLINE",

      estado:
        "SIN_DATOS",

      detalle:
        modelo &&
        modelo.detalle
          ? modelo.detalle
          : "No se pudo construir el modelo histórico."
    };
  }

  var bucketKey =
    dominioLocal +
    "|" +
    dominioVisitante;

  var bucket =
    modelo.buckets[
      bucketKey
    ];

  if (
    !bucket ||
    bucket.n <
      F5_ML_MIN_MUESTRA_BUCKET
  ) {
    return {
      pieza:
        "F5_MONEYLINE",

      estado:
        "MUESTRA_INSUFICIENTE",

      dominioLocal:
        dominioLocal,

      dominioVisitante:
        dominioVisitante,

      bucket:
        bucketKey,

      muestra:
        bucket
          ? bucket.n
          : 0,

      base_historica:
        modelo.elegibles,

      detalle:
        "El bucket no alcanza el mínimo de 20 juegos."
    };
  }

  var mercado =
    _f5MlMercadoSinVig(
      lineaMercadoF5
    );

  var ventajaLocalPct =
    null;

  var ventajaVisitantePct =
    null;

  if (mercado) {
    ventajaLocalPct =
      _f5MlRedondear(
        bucket
          .porcentajeLocalDosVias -
        mercado
          .porcentajeHome,
        1
      );

    ventajaVisitantePct =
      _f5MlRedondear(
        bucket
          .porcentajeVisitanteDosVias -
        mercado
          .porcentajeAway,
        1
      );
  }

  var ventaja;

  if (
    bucket
      .porcentajeLocalDosVias >
    bucket
      .porcentajeVisitanteDosVias
  ) {
    ventaja =
      "LOCAL";
  } else if (
    bucket
      .porcentajeVisitanteDosVias >
    bucket
      .porcentajeLocalDosVias
  ) {
    ventaja =
      "VISITANTE";
  } else {
    ventaja =
      "PAREJO_SIN_VENTAJA";
  }

  var seleccion =
    ventaja;

  var umbralValorPct =
    3;

  if (mercado) {
    seleccion =
      "SIN_VALOR_CONFIRMADO";

    if (
      ventajaLocalPct >=
        umbralValorPct &&
      ventajaLocalPct >
        ventajaVisitantePct
    ) {
      seleccion =
        "LOCAL";
    } else if (
      ventajaVisitantePct >=
        umbralValorPct &&
      ventajaVisitantePct >
        ventajaLocalPct
    ) {
      seleccion =
        "VISITANTE";
    }
  }

  return {
    pieza:
      "F5_MONEYLINE",

    estado:
      "PORCENTAJE_EMPIRICO",

    bucket:
      bucketKey,

    dominioLocal:
      dominioLocal,

    dominioVisitante:
      dominioVisitante,

    ventaja:
      ventaja,

    seleccion:
      seleccion,

    muestra:
      bucket.n,

    base_historica:
      modelo.elegibles,

    desarrollo_historico:
      modelo.desarrollo,

    porcentajeLocal:
      bucket
        .porcentajeLocal,

    porcentajeVisitante:
      bucket
        .porcentajeVisitante,

    porcentajeEmpate:
      bucket
        .porcentajeEmpate,

    porcentajeLocalDosVias:
      bucket
        .porcentajeLocalDosVias,

    porcentajeVisitanteDosVias:
      bucket
        .porcentajeVisitanteDosVias,

    mercadoSinVig:
      mercado,

    ventajaLocalPct:
      ventajaLocalPct,

    ventajaVisitantePct:
      ventajaVisitantePct,

    umbralValorPct:
      umbralValorPct,

    detalle:
      "Porcentajes reales del bucket " +
      bucketKey +
      " sobre " +
      bucket.n +
      " juegos históricos de desarrollo."
  };
}

function f5MoneyLineLimpiarModelo() {
  _f5MlModeloCache = null;
}

if (
  typeof module !== "undefined"
) {
  module.exports = {
    f5MoneyLine:
      f5MoneyLine,

    f5MoneyLineLimpiarModelo:
      f5MoneyLineLimpiarModelo
  };
}
