// bloques-serie.js
// PIEZA A - agrupa el cache historico en BLOQUES.
// Bloque = mismo parque (venue) + dias seguidos con hueco max 1 dia libre.
// Solo agrupa. No calcula trayectoria ni carreraje (piezas siguientes).
// Campos REALES del cache (jalar-clima.js): date, venue, home_team, etc.

function armarBloques(records) {
  function diasEntre(a, b) {
    const da = new Date(a + "T00:00:00");
    const db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
  }

  const validos = (records || []).filter(function (r) {
    return r && r.venue && r.date;
  });

  validos.sort(function (a, b) {
    if (a.venue < b.venue) return -1;
    if (a.venue > b.venue) return 1;
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  const bloques = [];
  let actual = null;

  validos.forEach(function (r) {
    if (actual && r.venue === actual.venue && diasEntre(actual.fecha_fin, r.date) <= 2) {
      actual.juegos.push(r);
      actual.fecha_fin = r.date;
    } else {
      actual = {
        venue: r.venue,
        home_team: r.home_team || "",
        fecha_inicio: r.date,
        fecha_fin: r.date,
        juegos: [r]
      };
      bloques.push(actual);
    }
  });

  bloques.forEach(function (b) { b.n_juegos = b.juegos.length; });
  return bloques;
}
