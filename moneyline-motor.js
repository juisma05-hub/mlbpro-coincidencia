// moneyline-motor.js
//
// FUNCIÓN:
// Motor PREGAME de Moneyline MLBPro.
//
// Recibe la salida cerrada de moneyline-data.js y transforma únicamente
// señales numéricas confirmadas en una evaluación Moneyline.
//
// NO HACE:
// - No consulta endpoints.
// - No vuelve a construir schedule, roster, lineup ni clima.
// - No escribe histórico.
// - No escribe Data Madre.
// - No usa resultados en vivo.
// - No convierte datos faltantes en valores neutrales.
// - No inventa factores.
// - No mezcla Moneyline de sportsbooks diferentes.
// - No genera una selección si faltan pesos o cobertura suficiente.
//
// ENTRADA PRINCIPAL:
//
//   moneylineMotor(data, configuracion)
//
// "data" debe ser la salida de:
//
//   await moneylineData(juego, bloques)
//
// "configuracion":
//
// {
//   pesos: {
//     pitcheo: número,
//     arsenal_vs_lineup: número,
//     fuerza_equipo: número,
//     clima: número,
//     coincidencia: número,
//     lineup: número
//   },
//
//   cobertura_minima: 0 a 1,
//   ventaja_minima: número,
//   edge_minimo: número,
//   exigir_linea: boolean
// }
//
// REGLA DE PESOS:
// - El motor no impone pesos predeterminados.
// - Solo usa pesos numéricos, finitos y mayores que 0.
// - Si no se entrega ningún peso válido, devuelve PESOS_NO_CONFIRMADOS.
//
// FORMATOS DE SEÑAL ACEPTADOS POR BLOQUE:
//
// Formato directo:
//
// {
//   confirmado: true,
//   score_home: número,
//   score_away: número
// }
//
// También acepta:
//
// {
//   confirmado: true,
//   factor_home: número,
//   factor_away: número
// }
//
// {
//   confirmado: true,
//   prob_home: número,
//   prob_away: número
// }
//
// {
//   confirmado: true,
//   ventaja_home: número,
//   ventaja_away: número
// }
//
// O formato por equipos:
//
// {
//   confirmado: true,
//   home: {
//     score / factor / probabilidad / valor: número
//   },
//   away: {
//     score / factor / probabilidad / valor: número
//   }
// }
//
// Si un bloque no presenta dos valores comparables y confirmados, se excluye.
//
// SALIDA:
//
// {
//   juego,
//   evaluacion,
//   mercado,
//   cobertura,
//   pick,
//   confirmado,
//   estado,
//   notas
// }
//
// DEPENDENCIA:
// - moneyline-data.js debe cargarse antes si se usa ejecutarMoneyline().

(function (global) {
  "use strict";

  var NOMBRES_BLOQUES = [
    "pitcheo",
    "arsenal_vs_lineup",
    "fuerza_equipo",
    "clima",
    "coincidencia",
    "lineup"
  ];

  function numeroFinito(valor) {
    return typeof valor === "number" && Number.isFinite(valor);
  }

  function numeroPositivo(valor) {
    return numeroFinito(valor) && valor > 0;
  }

  function limitar(valor, minimo, maximo) {
    if (!numeroFinito(valor)) {
      return null;
    }

    return Math.min(maximo, Math.max(minimo, valor));
  }

  function primerNumero() {
    for (var i = 0; i < arguments.length; i++) {
      if (numeroFinito(arguments[i])) {
        return arguments[i];
      }
    }

    return null;
  }

  function primerTexto() {
    for (var i = 0; i < arguments.length; i++) {
      var valor = arguments[i];

      if (
        typeof valor === "string" &&
        valor.trim() !== ""
      ) {
        return valor.trim();
      }
    }

    return null;
  }

  function estaConfirmado(bloque) {
    if (!bloque || typeof bloque !== "object") {
      return false;
    }

    if (bloque.confirmado === false) {
      return false;
    }

    var estado = primerTexto(
      bloque.estado,
      bloque.status
    );

    if (
      estado &&
      estado !== "OK" &&
      estado !== "CONFIRMADO" &&
      estado !== "COMPLETO"
    ) {
      return false;
    }

    return true;
  }

  function extraerValorEquipo(equipo) {
    if (numeroFinito(equipo)) {
      return equipo;
    }

    if (!equipo || typeof equipo !== "object") {
      return null;
    }

    return primerNumero(
      equipo.score,
      equipo.factor,
      equipo.probabilidad,
      equipo.prob,
      equipo.valor,
      equipo.rating,
      equipo.indice
    );
  }

  function extraerSenal(bloque) {
    if (!estaConfirmado(bloque)) {
      return null;
    }

    var home = primerNumero(
      bloque.score_home,
      bloque.home_score,
      bloque.factor_home,
      bloque.home_factor,
      bloque.prob_home,
      bloque.home_prob,
      bloque.probabilidad_home,
      bloque.home_probability,
      bloque.ventaja_home,
      bloque.home_value,
      bloque.valor_home,
      extraerValorEquipo(bloque.home),
      extraerValorEquipo(bloque.local)
    );

    var away = primerNumero(
      bloque.score_away,
      bloque.away_score,
      bloque.factor_away,
      bloque.away_factor,
      bloque.prob_away,
      bloque.away_prob,
      bloque.probabilidad_away,
      bloque.away_probability,
      bloque.ventaja_away,
      bloque.away_value,
      bloque.valor_away,
      extraerValorEquipo(bloque.away),
      extraerValorEquipo(bloque.visitante)
    );

    if (!numeroFinito(home) || !numeroFinito(away)) {
      return null;
    }

    if (home === away) {
      return {
        home: home,
        away: away,
        diferencia: 0,
        magnitud: Math.abs(home) + Math.abs(away)
      };
    }

    return {
      home: home,
      away: away,
      diferencia: home - away,
      magnitud: Math.abs(home) + Math.abs(away)
    };
  }

  function normalizarDiferencia(senal) {
    if (
      !senal ||
      !numeroFinito(senal.diferencia)
    ) {
      return null;
    }

    var denominador = numeroFinito(senal.magnitud)
      ? senal.magnitud
      : 0;

    if (denominador === 0) {
      return 0;
    }

    return limitar(
      senal.diferencia / denominador,
      -1,
      1
    );
  }

  function normalizarConfiguracion(configuracion) {
    var entrada =
      configuracion &&
      typeof configuracion === "object"
        ? configuracion
        : {};

    var pesosEntrada =
      entrada.pesos &&
      typeof entrada.pesos === "object"
        ? entrada.pesos
        : {};

    var pesos = {};

    for (var i = 0; i < NOMBRES_BLOQUES.length; i++) {
      var nombre = NOMBRES_BLOQUES[i];
      var peso = pesosEntrada[nombre];

      pesos[nombre] = numeroPositivo(peso)
        ? peso
        : null;
    }

    return {
      pesos: pesos,

      cobertura_minima: numeroFinito(
        entrada.cobertura_minima
      )
        ? limitar(entrada.cobertura_minima, 0, 1)
        : 1,

      ventaja_minima: numeroFinito(
        entrada.ventaja_minima
      )
        ? Math.max(0, entrada.ventaja_minima)
        : 0,

      edge_minimo: numeroFinito(
        entrada.edge_minimo
      )
        ? Math.max(0, entrada.edge_minimo)
        : 0,

      exigir_linea:
        entrada.exigir_linea !== false
    };
  }

  function evaluarBloques(data, configuracion) {
    var detalle = {};
    var pesoConfigurado = 0;
    var pesoDisponible = 0;
    var sumaPonderada = 0;
    var usados = 0;

    for (var i = 0; i < NOMBRES_BLOQUES.length; i++) {
      var nombre = NOMBRES_BLOQUES[i];
      var peso = configuracion.pesos[nombre];

      if (!numeroPositivo(peso)) {
        detalle[nombre] = {
          usado: false,
          confirmado: false,
          peso: null,
          razon: "PESO_NO_CONFIRMADO"
        };

        continue;
      }

      pesoConfigurado += peso;

      var bloque = data[nombre];
      var senal = extraerSenal(bloque);
      var diferenciaNormalizada =
        normalizarDiferencia(senal);

      if (
        !senal ||
        !numeroFinito(diferenciaNormalizada)
      ) {
        detalle[nombre] = {
          usado: false,
          confirmado: false,
          peso: peso,
          razon: "SENAL_NO_CONFIRMADA"
        };

        continue;
      }

      pesoDisponible += peso;
      sumaPonderada += diferenciaNormalizada * peso;
      usados++;

      detalle[nombre] = {
        usado: true,
        confirmado: true,
        peso: peso,
        valor_home: senal.home,
        valor_away: senal.away,
        diferencia_original: senal.diferencia,
        diferencia_normalizada:
          diferenciaNormalizada
      };
    }

    var cobertura = pesoConfigurado > 0
      ? pesoDisponible / pesoConfigurado
      : 0;

    var ventaja = pesoDisponible > 0
      ? sumaPonderada / pesoDisponible
      : null;

    return {
      ventaja_home: numeroFinito(ventaja)
        ? ventaja
        : null,

      ventaja_away: numeroFinito(ventaja)
        ? -ventaja
        : null,

      lado:
        !numeroFinito(ventaja) || ventaja === 0
          ? null
          : ventaja > 0
            ? "HOME"
            : "AWAY",

      bloques_usados: usados,
      peso_configurado: pesoConfigurado,
      peso_disponible: pesoDisponible,
      cobertura: cobertura,
      detalle: detalle
    };
  }

  function americanAProbabilidad(cuota) {
    if (!numeroFinito(cuota) || cuota === 0) {
      return null;
    }

    if (cuota > 0) {
      return 100 / (cuota + 100);
    }

    return Math.abs(cuota) /
      (Math.abs(cuota) + 100);
  }

  function quitarVig(probHome, probAway) {
    if (
      !numeroFinito(probHome) ||
      !numeroFinito(probAway)
    ) {
      return null;
    }

    var total = probHome + probAway;

    if (!numeroPositivo(total)) {
      return null;
    }

    return {
      home: probHome / total,
      away: probAway / total,
      vig: total - 1
    };
  }

  function evaluarMercado(linea) {
    if (
      !linea ||
      typeof linea !== "object" ||
      linea.confirmado !== true ||
      linea.tipo_linea !== "PREGAME"
    ) {
      return {
        confirmado: false,
        estado: "MONEYLINE_NO_CONFIRMADA",
        home: null,
        away: null,
        probabilidad_home: null,
        probabilidad_away: null,
        probabilidad_justa_home: null,
        probabilidad_justa_away: null,
        vig: null,
        sportsbook: null
      };
    }

    var cuotaHome = linea.moneyline_home;
    var cuotaAway = linea.moneyline_away;

    var probHome =
      americanAProbabilidad(cuotaHome);

    var probAway =
      americanAProbabilidad(cuotaAway);

    var justa = quitarVig(probHome, probAway);

    if (!justa) {
      return {
        confirmado: false,
        estado: "CUOTAS_INVALIDAS",
        home: null,
        away: null,
        probabilidad_home: null,
        probabilidad_away: null,
        probabilidad_justa_home: null,
        probabilidad_justa_away: null,
        vig: null,
        sportsbook: null
      };
    }

    return {
      confirmado: true,
      estado: "OK",

      home: cuotaHome,
      away: cuotaAway,

      probabilidad_home: probHome,
      probabilidad_away: probAway,

      probabilidad_justa_home: justa.home,
      probabilidad_justa_away: justa.away,

      vig: justa.vig,

      sportsbook: primerTexto(
        linea.moneyline_bookie,
        null
      )
    };
  }

  function ventajaAProbabilidad(ventaja) {
    if (!numeroFinito(ventaja)) {
      return null;
    }

    return limitar(
      0.5 + ventaja / 2,
      0,
      1
    );
  }

  function construirPick(
    data,
    evaluacion,
    mercado,
    configuracion
  ) {
    if (evaluacion.peso_configurado <= 0) {
      return {
        lado: null,
        equipo: null,
        cuota: null,
        probabilidad_modelo: null,
        probabilidad_mercado: null,
        edge: null,
        confirmado: false,
        estado: "PESOS_NO_CONFIRMADOS"
      };
    }

    if (
      evaluacion.cobertura <
      configuracion.cobertura_minima
    ) {
      return {
        lado: null,
        equipo: null,
        cuota: null,
        probabilidad_modelo: null,
        probabilidad_mercado: null,
        edge: null,
        confirmado: false,
        estado: "COBERTURA_INSUFICIENTE"
      };
    }

    if (
      !evaluacion.lado ||
      !numeroFinito(evaluacion.ventaja_home)
    ) {
      return {
        lado: null,
        equipo: null,
        cuota: null,
        probabilidad_modelo: null,
        probabilidad_mercado: null,
        edge: null,
        confirmado: false,
        estado: "SIN_VENTAJA"
      };
    }

    var ventajaAbsoluta =
      Math.abs(evaluacion.ventaja_home);

    if (
      ventajaAbsoluta <
      configuracion.ventaja_minima
    ) {
      return {
        lado: null,
        equipo: null,
        cuota: null,
        probabilidad_modelo: null,
        probabilidad_mercado: null,
        edge: null,
        confirmado: false,
        estado: "VENTAJA_INSUFICIENTE"
      };
    }

    var probModeloHome =
      ventajaAProbabilidad(
        evaluacion.ventaja_home
      );

    var probModeloAway =
      numeroFinito(probModeloHome)
        ? 1 - probModeloHome
        : null;

    var lado = evaluacion.lado;
    var equipo = lado === "HOME"
      ? data.juego &&
        data.juego.home &&
        data.juego.home.name
      : data.juego &&
        data.juego.away &&
        data.juego.away.name;

    if (!mercado.confirmado) {
      return {
        lado: lado,
        equipo: equipo || null,
        cuota: null,

        probabilidad_modelo:
          lado === "HOME"
            ? probModeloHome
            : probModeloAway,

        probabilidad_mercado: null,
        edge: null,

        confirmado:
          configuracion.exigir_linea === false,

        estado:
          configuracion.exigir_linea === false
            ? "VENTAJA_SIN_LINEA"
            : "MONEYLINE_NO_CONFIRMADA"
      };
    }

    var probModelo =
      lado === "HOME"
        ? probModeloHome
        : probModeloAway;

    var probMercado =
      lado === "HOME"
        ? mercado.probabilidad_justa_home
        : mercado.probabilidad_justa_away;

    var cuota =
      lado === "HOME"
        ? mercado.home
        : mercado.away;

    var edge =
      numeroFinito(probModelo) &&
      numeroFinito(probMercado)
        ? probModelo - probMercado
        : null;

    if (
      !numeroFinito(edge) ||
      edge < configuracion.edge_minimo
    ) {
      return {
        lado: lado,
        equipo: equipo || null,
        cuota: cuota,

        probabilidad_modelo: probModelo,
        probabilidad_mercado: probMercado,
        edge: edge,

        confirmado: false,
        estado: "SIN_VALOR_MONEYLINE"
      };
    }

    return {
      lado: lado,
      equipo: equipo || null,
      cuota: cuota,

      probabilidad_modelo: probModelo,
      probabilidad_mercado: probMercado,
      edge: edge,

      confirmado: true,
      estado: "PICK_CONFIRMADO"
    };
  }

  function moneylineMotor(dataEntrada, configuracionEntrada) {
    if (
      !dataEntrada ||
      typeof dataEntrada !== "object"
    ) {
      return {
        juego: null,
        evaluacion: null,
        mercado: null,
        cobertura: null,
        pick: null,
        confirmado: false,
        estado: "ENTRADA_INVALIDA",
        notas: ["Falta la salida de moneylineData"]
      };
    }

    var data = dataEntrada;
    var configuracion =
      normalizarConfiguracion(
        configuracionEntrada
      );

    var evaluacion =
      evaluarBloques(
        data,
        configuracion
      );

    var mercado =
      evaluarMercado(
        data.linea_pregame
      );

    var pick =
      construirPick(
        data,
        evaluacion,
        mercado,
        configuracion
      );

    var notas = [];

    if (data.confirmado !== true) {
      notas.push("MONEYLINE_DATA_PARCIAL");
    }

    if (evaluacion.peso_configurado <= 0) {
      notas.push("PESOS_NO_CONFIRMADOS");
    }

    if (
      evaluacion.cobertura <
      configuracion.cobertura_minima
    ) {
      notas.push("COBERTURA_INSUFICIENTE");
    }

    if (!mercado.confirmado) {
      notas.push("MONEYLINE_NO_CONFIRMADA");
    }

    if (!pick.confirmado) {
      notas.push(pick.estado);
    }

    return {
      juego: data.juego || null,

      evaluacion: evaluacion,
      mercado: mercado,

      cobertura: {
        bloques_usados:
          evaluacion.bloques_usados,

        peso_configurado:
          evaluacion.peso_configurado,

        peso_disponible:
          evaluacion.peso_disponible,

        porcentaje:
          Math.round(
            evaluacion.cobertura * 100
          ),

        minima_requerida:
          Math.round(
            configuracion.cobertura_minima * 100
          )
      },

      pick: pick,

      configuracion: configuracion,

      confirmado: pick.confirmado === true,

      estado:
        pick.confirmado === true
          ? "OK"
          : pick.estado,

      notas: notas
    };
  }

  async function ejecutarMoneyline(
    juego,
    bloques,
    configuracion
  ) {
    if (typeof global.moneylineData !== "function") {
      return {
        juego: null,
        evaluacion: null,
        mercado: null,
        cobertura: null,
        pick: null,
        confirmado: false,
        estado: "DEPENDENCIA_FALTANTE",
        notas: [
          "moneylineData no está disponible"
        ]
      };
    }

    try {
      var data = await global.moneylineData(
        juego,
        bloques
      );

      return moneylineMotor(
        data,
        configuracion
      );
    } catch (error) {
      return {
        juego: null,
        evaluacion: null,
        mercado: null,
        cobertura: null,
        pick: null,
        confirmado: false,
        estado: "ERROR_MONEYLINE_MOTOR",
        notas: [
          error && error.message
            ? error.message
            : String(error)
        ]
      };
    }
  }

  global.moneylineMotor = moneylineMotor;
  global.ejecutarMoneyline = ejecutarMoneyline;

  global.MONEYLINE_MOTOR = {
    moneylineMotor: moneylineMotor,
    ejecutarMoneyline: ejecutarMoneyline,
    extraerSenal: extraerSenal,
    americanAProbabilidad:
      americanAProbabilidad,
    evaluarMercado: evaluarMercado
  };

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = {
      moneylineMotor: moneylineMotor,
      ejecutarMoneyline: ejecutarMoneyline,
      extraerSenal: extraerSenal,
      americanAProbabilidad:
        americanAProbabilidad,
      evaluarMercado: evaluarMercado
    };
  }
})(
  typeof window !== "undefined"
    ? window
    : globalThis
);
