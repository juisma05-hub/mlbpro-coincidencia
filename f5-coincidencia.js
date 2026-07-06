// f5-coincidencia.js — MLBPro F5 · Coincidencia de Factores
// Junta F1 (Estadio) + F2 (Roof) + F3 (Temperatura) + F4 (Viento) + F5 (Perfil Pitcher)
// No suma puntos inventados. Cuenta cuántos F están CONFIRMADO.
// SIN_DATOS se reporta aparte, no se cuenta como NO_APLICA/NO_COINCIDE.

const { f1Estadio } = require("./f5-estadio.js");
const { f2Roof } = require("./f5-roof.js");
const { f3Temperatura } = require("./f5-temperatura.js");
const { f4Viento } = require("./f5-viento.js");
const { f5PerfilPitcher } = require("./f5-pitcher.js");

function f5Coincidencia(datosHoy, datosHistorico) {
  const r1 = f1Estadio(datosHoy.venue, datosHistorico.venue);
  const r2 = f2Roof(datosHoy.roof, datosHistorico.roof);
  const r3 = f3Temperatura(datosHoy.tempF, datosHistorico.tempF);
  const r4 = f4Viento(datosHoy.vientoMph, datosHistorico.vientoMph, datosHoy.direccionViento, datosHistorico.direccionViento);
  const r5 = f5PerfilPitcher(datosHoy.perfilPitcher, datosHistorico.perfilPitcher);

  const factores = [r1, r2, r3, r4, r5];

  const confirmados = factores.filter(function (f) { return f.estado === "CONFIRMADO"; }).length;
  const sinDatos = factores.filter(function (f) { return f.estado === "SIN_DATOS"; }).map(function (f) { return f.factor; });

  let estadoFinal;
  if (confirmados === 5) {
    estadoFinal = "COINCIDENCIA COMPLETA";
  } else if (confirmados >= 3) {
    estadoFinal = "COINCIDENCIA PARCIAL";
  } else {
    estadoFinal = "COINCIDENCIA BAJA";
  }

  return {
    juego: datosHoy.juego || "NO CONFIRMADO",
    parque: datosHoy.venue || "NO CONFIRMADO",
    roof: datosHoy.roof || "NO CONFIRMADO",
    tempHoy: datosHoy.tempF !== undefined ? datosHoy.tempF : "NO CONFIRMADO",
    vientoHoy: datosHoy.vientoMph !== undefined ? datosHoy.vientoMph : "NO CONFIRMADO",
    F1: r1,
    F2: r2,
    F3: r3,
    F4: r4,
    F5: r5,
    confirmados: confirmados + "/5",
    factoresConSinDatos: sinDatos,
    estado: estadoFinal
  };
}

module.exports = { f5Coincidencia };
