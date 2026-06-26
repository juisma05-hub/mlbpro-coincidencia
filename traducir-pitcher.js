// traducir-pitcher.js
// PIEZA - recibe un pitcher_id y devuelve { id, nombre, xera }.
// Fuente: PITCHERS_MASTER_2026 (pitchers-master.js). NO inventa: si no esta, NO_CONFIRMADO.

function traducirPitcher(pid) {
  var out = { id: pid, nombre: "NO_CONFIRMADO", xera: "NO_CONFIRMADO" };
  if (pid === null || pid === undefined || pid === "NO_CONFIRMADO") return out;
  if (typeof PITCHERS_MASTER_2026 === "undefined") return out;
  var p = PITCHERS_MASTER_2026[pid];
  if (!p) return out;
  if (p.name !== undefined && p.name !== null) out.nombre = p.name;
  if (p.xera !== undefined && p.xera !== null) out.xera = p.xera;
  return out;
}
