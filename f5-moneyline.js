// f5-moneyline.js — MLBPro F5 · MoneyLine
// Recibe el resultado de f5Carreraje ya calculado POR SEPARADO para cada lado
// (pitcher local vs lineup visitante, pitcher visitante vs lineup local).
// Aqui se comparan JUNTOS para decidir quien tiene ventaja en F5.
// F5 = solo pitcher, bullpen no entra (regla madre).
// No inventa un ganador si falta un lado: PENDIENTE / SIN_DATOS.
//
// Estado renombrado (20 jul 2026): antes devolvia "PENDIENTE POR ACCESO"
// cuando el calculo estaba completo; ese nombre contradecia la evidencia
// (el acceso y el calculo ya habian ocurrido). Ahora, con ambos lados
// calculados, devuelve "VENTAJA_CUALITATIVA" + probabilidad: "NO_VALIDADA",
// dejando explicito que la ventaja (LOCAL/VISITANTE/PAREJO_SIN_VENTAJA)
// es cualitativa y que traducirla a cuota/probabilidad real requiere
// backtest, que todavia no se ha corrido para este modulo.
//
// Correccion (20 jul 2026): antes, si dominioPitcher llegaba con un valor
// distinto de DOMINA/PAREJO/LE_PEGAN, rango[...] daba undefined y la
// comparacion undefined > undefined caia silenciosamente en el else,
// devolviendo "PAREJO_SIN_VENTAJA" como si fuera un empate real. Ahora se
// valida explicitamente el dominio antes de comparar: si cualquiera de
// los dos lados trae un valor desconocido, devuelve estado: "SIN_DATOS"
// con detalle explicito. Nunca se convierte un dominio invalido en un
// empate.

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
  const dominiosValidos = ["DOMINA", "PAREJO", "LE_PEGAN"];

  if (dominiosValidos.indexOf(dominioLocal) === -1 || dominiosValidos.indexOf(dominioVisitante) === -1) {
    return {
      pieza: "F5_MONEYLINE",
      estado: "SIN_DATOS",
      dominioLocal: dominioLocal,
      dominioVisitante: dominioVisitante,
      detalle: "Dominio invalido recibido (local=" + String(dominioLocal) + ", visitante=" + String(dominioVisitante) + "). " +
        "Se esperaba exactamente DOMINA, PAREJO o LE_PEGAN. No se convierte en empate."
    };
  }

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
    estado: "VENTAJA_CUALITATIVA",
    dominioLocal: dominioLocal,
    dominioVisitante: dominioVisitante,
    ventaja: ventaja,
    probabilidad: "NO_VALIDADA",
    detalle: "Ventaja en F5: " + ventaja + " (local=" + dominioLocal + ", visitante=" + dominioVisitante + "). " +
      "Traducir esta ventaja a cuota/probabilidad de MoneyLine requiere backtest real, no se inventa el numero."
  };
}

if (typeof module !== "undefined") { module.exports = { f5MoneyLine }; }
