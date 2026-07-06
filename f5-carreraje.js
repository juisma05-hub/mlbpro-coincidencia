// f5-carreraje.js — MLBPro F5 · Carreraje (línea 0.5)
// Conecta el dominio del pitcher (perfil + cruce vs lineup) con el Carreraje F5.
// F5 = solo pitcher, bullpen NO entra aquí (regla madre).
// La línea de Carreraje en F5 es 0.5 (media carrera), no 1.5.
//
// Esta pieza NO inventa un número de carreras proyectadas todavía.
// Reporta el estado de dominio del pitcher (mismo criterio que ya existe
// en cruce-arsenal.js / viento-pitcher-test.html: woba_esperado del cruce).
// Traducir ese dominio a "cubre -0.5" o "no cubre" con precisión numérica
// requiere backtest real — se marca PENDIENTE POR ACCESO hasta entonces.

function f5Carreraje(cruceArsenal, lineaCarreraje) {
  const LINEA_DEFECTO = 0.5;
  const linea = (lineaCarreraje !== undefined && lineaCarreraje !== null) ? lineaCarreraje : LINEA_DEFECTO;

  if (!cruceArsenal || cruceArsenal.estado === "NO_CONFIRMADO") {
    return {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      linea: linea,
      detalle: "Falta el cruce arsenal vs lineup (dato del pitcher rival)."
    };
  }

  if (cruceArsenal.estado === "PENDIENTE") {
    return {
      pieza: "F5_CARRERAJE",
      estado: "PENDIENTE",
      linea: linea,
      detalle: "Lineup rival todavía no confirmado (pendiente por acceso)."
    };
  }

  const woba = cruceArsenal.woba_esperado;
  if (woba === undefined || woba === null || isNaN(woba)) {
    return {
      pieza: "F5_CARRERAJE",
      estado: "SIN_DATOS",
      linea: linea,
      detalle: "El cruce no trae woba_esperado real."
    };
  }

  let dominio;
  if (woba >= 0.340) dominio = "LE_PEGAN";
  else if (woba <= 0.300) dominio = "DOMINA";
  else dominio = "PAREJO";

  return {
    pieza: "F5_CARRERAJE",
    estado: "PENDIENTE POR ACCESO",
    linea: linea,
    dominioPitcher: dominio,
    wobaEsperado: woba,
    detalle: "Dominio del pitcher: " + dominio + " (woba esperado " + woba.toFixed(3) + "). " +
      "Traducir esto a proyección numérica de carreras contra la línea de " + linea +
      " requiere backtest real, todavía no calibrado. No se inventa el número."
  };
}

module.exports = { f5Carreraje };
