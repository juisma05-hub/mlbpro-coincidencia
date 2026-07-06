// f5-coincidencia.js — MLBPro F5 · Coincidencia de Factores
// Junta F1 (Estadio) + F2 (Roof) + F3 (Temperatura) + F4 (Viento) + F5 (Perfil Pitcher)
// No suma puntos inventados. Cuenta cuántos F están CONFIRMADO.
// SIN_DATOS se reporta aparte, no se cuenta como NO_APLICA/NO_COINCIDE.
//
// CORREGIDO 6 jul 2026: antes usaba require() de Node, lo cual NO existe en
// el navegador y tumbaba todo. Ahora usa las funciones globales que ya
// quedan cargadas por los <script> de f5-estadio.js, f5-roof.js,
// f5-temperatura.js, f5-viento.js y f5-pitcher.js (mismo patrón que el
// resto de MLBPro: cada archivo se carga como <script> y expone su función).
// Si se corre en Node (con module.exports), sigue funcionando igual porque
// ahí SÍ existe require.

var _f1Estadio, _f2Roof, _f3Temperatura, _f4Viento, _f5PerfilPitcher;

if (typeof require === "function" && typeof module !== "undefined") {
  _f1Estadio = require("./f5-estadio.js").f1Estadio;
  _f2Roof = require("./f5-roof.js").f2Roof;
  _f3Temperatura = require("./f5-temperatura.js").f3Temperatura;
  _f4Viento = require("./f5-viento.js").f4Viento;
  _f5PerfilPitcher = require("./f5-pitcher.js").f5PerfilPitcher;
} else {
  // En navegador: las funciones ya están en el scope global porque cada
  // f5-*.js se carga como <script> antes que este archivo.
  _f1Estadio = f1Estadio;
  _f2Roof = f2Roof;
  _f3Temperatura = f3Temperatura;
  _f4Viento = f4Viento;
  _f5PerfilPitcher = f5PerfilPitcher;
}

function f5Coincidencia(datosHoy, datosHistorico) {
  const r1 = _f1Estadio(datosHoy.venue, datosHistorico.venue);
  const r2 = _f2Roof(datosHoy.roof, datosHistorico.roof);
  const r3 = _f3Temperatura(datosHoy.tempF, datosHistorico.tempF);
  const r4 = _f4Viento(datosHoy.vientoMph, datosHistorico.vientoMph, datosHoy.direccionViento, datosHistorico.direccionViento);
  const r5 = _f5PerfilPitcher(datosHoy.perfilPitcher, datosHistorico.perfilPitcher);

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

if (typeof module !== "undefined") { module.exports = { f5Coincidencia }; }
