// estadios.js
// PIEZA 4a - datos de estadios 2026 (coordenadas + roof).
// Copiados IDENTICOS de la app JALAR historial. No se cambio ningun valor.
// Dato centralizado, no suelto dentro del jalador.

const STADIUM_COORDS_2026 = [
  { venue:"Oriole Park at Camden Yards", lat:39.2839, lon:-76.6217, timezone:"America/New_York", roof:"open" },
  { venue:"Fenway Park", lat:42.3467, lon:-71.0972, timezone:"America/New_York", roof:"open" },
  { venue:"Yankee Stadium", lat:40.8296, lon:-73.9262, timezone:"America/New_York", roof:"open" },
  { venue:"Tropicana Field", lat:27.7682, lon:-82.6534, timezone:"America/New_York", roof:"fixed_dome" },
  { venue:"Rogers Centre", lat:43.6414, lon:-79.3894, timezone:"America/Toronto", roof:"retractable" },
  { venue:"Rate Field", lat:41.8299, lon:-87.6338, timezone:"America/Chicago", roof:"open" },
  { venue:"Progressive Field", lat:41.4962, lon:-81.6852, timezone:"America/New_York", roof:"open" },
  { venue:"Comerica Park", lat:42.3390, lon:-83.0485, timezone:"America/Detroit", roof:"open" },
  { venue:"Kauffman Stadium", lat:39.0517, lon:-94.4803, timezone:"America/Chicago", roof:"open" },
  { venue:"Target Field", lat:44.9817, lon:-93.2776, timezone:"America/Chicago", roof:"open" },
  { venue:"Daikin Park", lat:29.7572, lon:-95.3556, timezone:"America/Chicago", roof:"retractable" },
  { venue:"Angel Stadium", lat:33.8003, lon:-117.8827, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Sutter Health Park", lat:38.5802, lon:-121.5133, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"T-Mobile Park", lat:47.5914, lon:-122.3325, timezone:"America/Los_Angeles", roof:"retractable" },
  { venue:"Globe Life Field", lat:32.7473, lon:-97.0825, timezone:"America/Chicago", roof:"retractable" },
  { venue:"Truist Park", lat:33.8907, lon:-84.4677, timezone:"America/New_York", roof:"open" },
  { venue:"loanDepot Park", lat:25.7781, lon:-80.2197, timezone:"America/New_York", roof:"retractable" },
  { venue:"Citi Field", lat:40.7571, lon:-73.8458, timezone:"America/New_York", roof:"open" },
  { venue:"Citizens Bank Park", lat:39.9061, lon:-75.1665, timezone:"America/New_York", roof:"open" },
  { venue:"Nationals Park", lat:38.8730, lon:-77.0074, timezone:"America/New_York", roof:"open" },
  { venue:"Wrigley Field", lat:41.9484, lon:-87.6553, timezone:"America/Chicago", roof:"open" },
  { venue:"Great American Ball Park", lat:39.0975, lon:-84.5067, timezone:"America/New_York", roof:"open" },
  { venue:"American Family Field", lat:43.0280, lon:-87.9712, timezone:"America/Chicago", roof:"retractable" },
  { venue:"PNC Park", lat:40.4469, lon:-80.0057, timezone:"America/New_York", roof:"open" },
  { venue:"Busch Stadium", lat:38.6226, lon:-90.1928, timezone:"America/Chicago", roof:"open" },
  { venue:"Chase Field", lat:33.4453, lon:-112.0667, timezone:"America/Phoenix", roof:"retractable" },
  { venue:"Coors Field", lat:39.7559, lon:-104.9942, timezone:"America/Denver", roof:"open" },
  { venue:"Dodger Stadium", lat:34.0739, lon:-118.2400, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Petco Park", lat:32.7073, lon:-117.1566, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Oracle Park", lat:37.7786, lon:-122.3893, timezone:"America/Los_Angeles", roof:"open" },
];

const STADIUM_INDEX = new Map(
  STADIUM_COORDS_2026.map(function (s) { return [stadiumNorm(s.venue), s]; })
);

// PIEZA AGREGADA 5 jul 2026: alias de venue por renombre de patrocinio.
// Mantener este archivo como maestro de nombres para clima, lineas,
// coincidencia, brujula, orientacion y F5.
const STADIUM_ALIAS_2026 = {
  "UNIQLO Field at Dodger Stadium": "Dodger Stadium",

  "Guaranteed Rate Field": "Rate Field",
  "US Cellular Field": "Rate Field",
  "Comiskey Park": "Rate Field",

  "loanDepot park": "loanDepot Park",
  "LoanDepot Park": "loanDepot Park",
  "Marlins Park": "loanDepot Park",

  "Minute Maid Park": "Daikin Park",

  "Miller Park": "American Family Field",

  "Oakland Coliseum": "Sutter Health Park",
  "Raley Field": "Sutter Health Park",

  "Camden Yards": "Oriole Park at Camden Yards",
  "AT&T Park": "Oracle Park"
};

Object.keys(STADIUM_ALIAS_2026).forEach(function(alias){
  var real = STADIUM_INDEX.get(stadiumNorm(STADIUM_ALIAS_2026[alias]));
  if (real) STADIUM_INDEX.set(stadiumNorm(alias), real);
});

function stadiumCanonName(venue) {
  var raw = String(venue || "").trim();
  if (!raw) return "";

  if (STADIUM_ALIAS_2026[raw]) return STADIUM_ALIAS_2026[raw];

  var rn = stadiumNorm(raw);
  for (var alias in STADIUM_ALIAS_2026) {
    if (stadiumNorm(alias) === rn) return STADIUM_ALIAS_2026[alias];
  }

  return raw;
}

function stadiumGet(venue) {
  var raw = String(venue || "").trim();
  var canon = stadiumCanonName(raw);

  return STADIUM_INDEX.get(stadiumNorm(canon)) ||
         STADIUM_INDEX.get(stadiumNorm(raw)) ||
         null;
}

function stadiumNorm(n) {
  return String(n || "").trim().toLowerCase();
}
