// leer-juego.js
// PIEZA 3 - lee los campos confirmados de UN juego crudo del schedule.
// Todos estos campos existen en el JSON real (confirmado 2026-06-23).
// No inventa: si un campo falta, queda null y se marca.

function leerJuego(g) {
  return {
    gamePk:       g.gamePk ?? null,
    fecha:        g.officialDate ?? null,
    gameDate:     g.gameDate ?? null,
    estado:       g.status?.detailedState ?? null,   // "Final",
