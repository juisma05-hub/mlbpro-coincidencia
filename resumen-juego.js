// resumen-juego.js
// FUNCIÓN MADRE de números. UN solo sitio del que salen carreras y ponches.
// Las 3 vistas (hoy, futuro, pasado) deben llamar a ESTA función, no calcular por su lado.
// Así nunca hay cruce roto: si un número falla, falla igual en todas y se arregla aquí.
//
// Recibe: el resultado r de calcularCoincidencia (tiene r.ranked = los 5 parecidos).
// Devuelve, en idioma claro:
//   carreras_estim: promedio de carreras de los parecidos (lo que la app proyecta)
//   coinc_prom: coincidencia promedio (%)
//   n_parecidos: cuántos parecidos con marcador se usaron
//   estado: "OK" / "SIN_DATOS"
//
// NO inventa: si no hay parecidos con marcador, carreras_estim = null y estado = SIN_DATOS.

function resumenJuego(r) {
  var out = {
    estado: "OK",
    carreras_estim: null,   // carreras que proyecta la app (promedio 5 parecidos)
    coinc_prom: null,       // coincidencia promedio (%)
    n_parecidos: 0,
    nota: ""
  };

  if (!r || !r.ranked || !r.ranked.length) {
    out.estado = "SIN_DATOS";
    out.nota = "Sin parecidos para promediar.";
    return out;
  }

  var sumRuns = 0, nRuns = 0, sumScore = 0, nScore = 0;
  for (var i = 0; i < r.ranked.length; i++) {
    var h = r.ranked[i];
    var ar = (h.away_runs !== undefined && h.away_runs !== null) ? h.away_runs : null;
    var hr = (h.home_runs !== undefined && h.home_runs !== null) ? h.home_runs : null;
    if (ar !== null && hr !== null) { sumRuns += (ar + hr); nRuns++; }
    if (typeof h.score === "number") { sumScore += h.score; nScore++; }
  }

  out.n_parecidos = nRuns;
  out.carreras_estim = nRuns > 0 ? Math.round((sumRuns / nRuns) * 10) / 10 : null;
  out.coinc_prom     = nScore > 0 ? Math.round(sumScore / nScore) : null;

  if (nRuns === 0) {
    out.estado = "SIN_DATOS";
    out.nota = "Parecidos sin marcador todavía.";
  }
  return out;
}
