// traducir-umpire.js
// PIEZA - recibe el NOMBRE de un umpire (como viene del feed) y devuelve sus datos.
// Fuente: UMPIRES_MASTER_2026 (umpires-master.js), indexado por nombre normalizado.
// NO inventa: si no cruza, devuelve NO_CONFIRMADO en cada campo.
// Normaliza igual que al generar el master: minusculas, sin acentos, sin puntos/comillas/guiones.

function umpNorm(s) {
  if (s === null || s === undefined) return "";
  var t = String(s).trim().toLowerCase();
  // quita acentos
  t = t.normalize ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : t;
  t = t.replace(/\./g, "").replace(/'/g, "").replace(/-/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function traducirUmpire(nombre) {
  var out = {
    nombre: "NO_CONFIRMADO",
    zone_factor: "NO_CONFIRMADO",
    zone_type: "NO_CONFIRMADO",
    k_per_game: "NO_CONFIRMADO",
    bb_per_game: "NO_CONFIRMADO",
    k_tier: "NO_CONFIRMADO"
  };
  if (nombre === null || nombre === undefined || nombre === "NO_CONFIRMADO") return out;
  if (typeof UMPIRES_MASTER_2026 === "undefined") return out;
  var u = UMPIRES_MASTER_2026[umpNorm(nombre)];
  if (!u) {
    // si no cruza, al menos devuelve el nombre original del feed para que se vea en pantalla
    out.nombre = nombre;
    return out;
  }
  if (u.name !== undefined && u.name !== null) out.nombre = u.name;
  if (u.zone_factor !== undefined && u.zone_factor !== null) out.zone_factor = u.zone_factor;
  if (u.zone_type !== undefined && u.zone_type !== null) out.zone_type = u.zone_type;
  if (u.k_per_game !== undefined && u.k_per_game !== null) out.k_per_game = u.k_per_game;
  if (u.bb_per_game !== undefined && u.bb_per_game !== null) out.bb_per_game = u.bb_per_game;
  if (u.k_tier !== undefined && u.k_tier !== null) out.k_tier = u.k_tier;
  return out;
}
