// bloques-trayectoria.js
// PIEZA C - lee la temperatura real de cada bloque y calcula:
//   - tendencia general: SUBE / BAJA / ESTABLE (compara primer vs ultimo juego)
//   - saltos ANORMALES: cambio de >=6 grados de un juego al siguiente
// No inventa: solo usa temperature_f real. Si falta temp, ese juego se ignora.

var SALTO_ANORMAL = 6;

function analizarTrayectoria(bloque) {
  var temps = [];
  (bloque.juegos || []).forEach(function (g) {
    var raw = g.temperature_f;
    if (raw === "" || raw === null || raw === undefined) return;
    var t = Number(raw);
    if (Number.isFinite(t)) temps.push({ date: g.date, t: t });
  });

  if (temps.length < 2) {
    return { tendencia: "NO CONFIRMADO", min: null, max: null, saltos: [] };
  }

  var primero = temps[0].t;
  var ultimo = temps[temps.length - 1].t;
  var dif = ultimo - primero;
  var tendencia;
  if (dif >= SALTO_ANORMAL) tendencia = "SUBE";
  else if (dif <= -SALTO_ANORMAL) tendencia = "BAJA";
  else tendencia = "ESTABLE";

  var min = temps[0].t, max = temps[0].t;
  temps.forEach(function (x) { if (x.t < min) min = x.t; if (x.t > max) max = x.t; });

  var saltos = [];
  for (var i = 1; i < temps.length; i++) {
    var d = temps[i].t - temps[i - 1].t;
    if (Math.abs(d) >= SALTO_ANORMAL) {
      saltos.push({ date: temps[i].date, de: temps[i - 1].t, a: temps[i].t, dif: Math.round(d * 10) / 10 });
    }
  }

  return { tendencia: tendencia, min: min, max: max, saltos: saltos };
}
