// proyeccion-pitcher-temprana.js
// Proyección TEMPRANA del F5, ANTES de que salga el lineup real.
// Usa solo el xERA de cada abridor (dato real, de PITCHERS_MASTER_2026),
// escalado a 5 entradas. No usa el lineup rival porque todavía no existe.
// Esto NO reemplaza el cálculo real por lineup (f5-carreraje.js) — es un
// número provisional, honesto sobre ser provisional, que se debe ir
// actualizando/reemplazando cuando el lineup real esté disponible.
//
// Carreras del equipo VISITANTE en el F5 = xERA del pitcher HOME / 9 * 5
// Carreras del equipo LOCAL en el F5     = xERA del pitcher AWAY / 9 * 5
// (porque el pitcher de un equipo es quien limita las carreras del rival)

function proyectarF5DesdePitcher(perfilPitcherHomeHoy, perfilPitcherAwayHoy) {
  var xeraHome = perfilPitcherHomeHoy && typeof perfilPitcherHomeHoy.xera === "number" ? perfilPitcherHomeHoy.xera : null;
  var xeraAway = perfilPitcherAwayHoy && typeof perfilPitcherAwayHoy.xera === "number" ? perfilPitcherAwayHoy.xera : null;

  if (xeraHome === null || xeraAway === null) {
    return {
      pieza: "F5_PROYECCION_TEMPRANA",
      estado: "SIN_DATOS",
      detalle: "Falta el xERA real de alguno de los dos abridores de hoy."
    };
  }

  var carrerasAwayEquipo = Math.round((xeraHome * 5 / 9) * 100) / 100; // limitadas por el pitcher home
  var carrerasHomeEquipo = Math.round((xeraAway * 5 / 9) * 100) / 100; // limitadas por el pitcher away
  var totalProyectado = Math.round((carrerasAwayEquipo + carrerasHomeEquipo) * 100) / 100;
  var diferencial = Math.round((carrerasHomeEquipo - carrerasAwayEquipo) * 100) / 100;

  return {
    pieza: "F5_PROYECCION_TEMPRANA",
    estado: "PROYECTADO",
    carrerasHomeProy: carrerasHomeEquipo,
    carrerasAwayProy: carrerasAwayEquipo,
    totalProyectado: totalProyectado,
    diferencialHomeMenosAway: diferencial,
    detalle: "Proyección temprana basada SOLO en xERA de cada abridor (escalado a 5 entradas). No usa lineup real todavía. Se debe reemplazar por el cálculo con lineup real (Carreraje) cuando esté disponible."
  };
}

if (typeof module !== "undefined") { module.exports = { proyectarF5DesdePitcher: proyectarF5DesdePitcher }; }
