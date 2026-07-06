// f5-moneyline.js — MLBPro F5 · MoneyLine
// Recibe el resultado de f5Carreraje ya calculado POR SEPARADO para cada lado
// (pitcher local vs lineup visitante, pitcher visitante vs lineup local).
// Aqui se comparan JUNTOS para decidir quien tiene ventaja en F5.
// F5 = solo pitcher, bullpen no entra (regla madre).
// No inventa un ganador si falta un lado: PENDIENTE POR ACCESO / SIN_DATOS.

function f5MoneyLine(carrerajeLocal, carrerajeVisitante) {
  if (!carrerajeLocal || !carrerajeVisitante) {
    return {
      pieza: "F5_MONEYLINE",
      estado: "SIN_DATOS",
      detalle: "Falta el calculo de Carreraje de un lado o de ambos."
    };
  }

  const estadosSinDato = ["SIN_DATOS", "PENDIENTE"];
  if (estadosSinDato.indexOf(carrerajeLocal.estado) !== -1 ||
      estadosSinDato.indexOf(carrerajeVisitante.estado) !== -1) {
    return {
      pieza: "F5_MONEYLINE",
      estado: "PENDIENTE",
      local: carrerajeLocal,
      visitante: carrerajeVisitante,
      detalle: "Uno de los dos lados no tiene el dominio de pitcher confirmado todavia."
    };
  }

  const dominioLocal = carrerajeLocal.dominioPitcher;
  const dominioVisitante = carrerajeVisitante.dominioPitcher;

  if (!dominioLocal || !dominioVisitante) {
    return {
      pieza: "F5_MONEYLINE",
      estado: "SIN_DATOS",
      detalle: "Falta el dominioPitcher calculado de un lado o de ambos."
    };
  }

  // Escala de dominio: DOMINA es mejor que PAREJO, PAREJO es mejor que LE_PEGAN.
  const rango = { "DOMINA": 2, "PAREJO": 1, "LE_PEGAN": 0 };
  const puntosLocal = rango[dominioLocal];
  const puntosVisitante = rango[dominioVisitante];

  let ventaja;
  if (puntosLocal > puntosVisitante) {
    ventaja = "LOCAL";
  } else if (puntosVisitante > puntosLocal) {
    ventaja = "VISITANTE";
  } else {
    ventaja = "PAREJO_SIN_VENTAJA";
  }

  return {
    pieza: "F5_MONEYLINE",
    estado: "PENDIENTE POR ACCESO",
    dominioLocal: dominioLocal,
    dominioVisitante: dominioVisitante,
    ventaja: ventaja,
    detalle: "Ventaja en F5: " + ventaja + " (local=" + dominioLocal + ", visitante=" + dominioVisitante + "). " +
      "Traducir esta ventaja a cuota/probabilidad de MoneyLine requiere backtest real, no se inventa el numero."
  };
}

module.exports = { f5MoneyLine };
