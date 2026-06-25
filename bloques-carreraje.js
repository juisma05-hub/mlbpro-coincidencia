// bloques-carreraje.js
// PIEZA - audita el carreraje dentro de un bloque.
// Usa total_runs REAL del cache (solo juegos Final con carreras).
// Devuelve: cuantos juegos con dato, promedio, min, max, y si es PAREJO o VARIABLE.
// No inventa: juegos sin total_runs se ignoran. Si no hay datos, NO CONFIRMADO.

var RANGO_PAREJO = 6; // si (max-min) <= 6 carreras, el bloque es PAREJO

function auditarCarreraje(bloque) {
  var runs = [];
  (bloque.juegos || []).forEach(function (g) {
    var r = Number(g.total_runs);
    if (Number.isFinite(r) && g.total_runs !== null) runs.push(r);
  });

  if (runs.length === 0) {
    return { estado: "NO CONFIRMADO", n: 0, prom: null, min: null, max: null };
  }

  var suma = 0, min = runs[0], max = runs[0];
  runs.forEach(function (r) {
    suma += r;
    if (r < min) min = r;
    if (r > max) max = r;
  });
  var prom = Math.round((suma / runs.length) * 10) / 10;
  var estado = (max - min) <= RANGO_PAREJO ? "PAREJO" : "VARIABLE";

  return { estado: estado, n: runs.length, prom: prom, min: min, max: max };
}
