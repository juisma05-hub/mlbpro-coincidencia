// traducir-catcher.js
// PIEZA - recibe un catcher_id y devuelve { id, nombre, rv_tot }.
// Fuente: CATCHERS_MASTER_2026 (catchers-master.js). NO inventa: si no esta, NO_CONFIRMADO.
// Mismo molde que traducir-pitcher.js.

function traducirCatcher(cid) {
  var out = { id: cid, nombre: "NO_CONFIRMADO", rv_tot: "NO_CONFIRMADO" };
  if (cid === null || cid === undefined || cid === "NO_CONFIRMADO") return out;
  if (typeof CATCHERS_MASTER_2026 === "undefined") return out;
  var c = CATCHERS_MASTER_2026[cid];
  if (!c) return out;
  if (c.name !== undefined && c.name !== null) out.nombre = c.name;
  if (c.rv_tot !== undefined && c.rv_tot !== null) out.rv_tot = c.rv_tot;
  return out;
}
