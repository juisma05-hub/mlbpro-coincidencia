// jalar-ponches.js
// Jala el HISTORIAL COMPLETO de ponches de TODOS los abridores (starters)
// desde el 26 de marzo, usando el endpoint "gameLog" de MLB.
//
// REGLA MADRE:
// El juego de hoy JAMAS entra al historial.
// Solo se aceptan aperturas con fecha anterior a hoy.
//
// LINEA DE CORTE: 4.0 entradas lanzadas (IP).
// >=4.0 = "llego".
// <4.0 = "lo apalearon".
//
// FECHA DE INICIO: 2026-03-26.
//
// CORRECCION CRITICA 10 jul 2026:
// Este archivo tenía su propio jalado de últimos juegos y no utilizaba
// jalar-ultimos5.js. Por eso el juego actual seguía apareciendo en K6.
// Se excluye hoy en:
// 1. jalarHistorialCompletoPitcher()
// 2. jalarPonchesTodos()
// 3. cache previamente contaminado.

var PONCHES_CACHE_KEY = "ponches_historial_cache_v1";
var PONCHES_FECHA_INICIO = "2026-03-26";
var PONCHES_IP_CORTE = 4.0;

// Mapa equipo -> parque casero.
var PONCHES_TEAM_VENUE = {
  "Arizona Diamondbacks": "Chase Field",
  "Atlanta Braves": "Truist Park",
  "Baltimore Orioles": "Oriole Park at Camden Yards",
  "Boston Red Sox": "Fenway Park",
  "Chicago Cubs": "Wrigley Field",
  "Chicago White Sox": "Rate Field",
  "Cincinnati Reds": "Great American Ball Park",
  "Cleveland Guardians": "Progressive Field",
  "Colorado Rockies": "Coors Field",
  "Detroit Tigers": "Comerica Park",
  "Houston Astros": "Daikin Park",
  "Kansas City Royals": "Kauffman Stadium",
  "Los Angeles Angels": "Angel Stadium",
  "Los Angeles Dodgers": "Dodger Stadium",
  "Miami Marlins": "loanDepot park",
  "Milwaukee Brewers": "American Family Field",
  "Minnesota Twins": "Target Field",
  "New York Mets": "Citi Field",
  "New York Yankees": "Yankee Stadium",
  "Athletics": "Sutter Health Park",
  "Philadelphia Phillies": "Citizens Bank Park",
  "Pittsburgh Pirates": "PNC Park",
  "San Diego Padres": "Petco Park",
  "San Francisco Giants": "Oracle Park",
  "Seattle Mariners": "T-Mobile Park",
  "St. Louis Cardinals": "Busch Stadium",
  "Tampa Bay Rays": "Tropicana Field",
  "Texas Rangers": "Globe Life Field",
  "Toronto Blue Jays": "Rogers Centre",
  "Washington Nationals": "Nationals Park"
};

function ponchesHoyISO() {
  var d = new Date(Date.now() - 6 * 60 * 60 * 1000);

  return d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2);
}

function ponchesLeerCache() {
  try {
    var raw = localStorage.getItem(PONCHES_CACHE_KEY);

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function ponchesGuardarCache(obj) {
  try {
    localStorage.setItem(
      PONCHES_CACHE_KEY,
      JSON.stringify(obj)
    );
  } catch (e) {}
}

// Convierte "6.1" a decimal real: 6.333...
function ipADecimal(ipTxt) {
  if (
    ipTxt === undefined ||
    ipTxt === null ||
    ipTxt === ""
  ) {
    return null;
  }

  var s = String(ipTxt);
  var partes = s.split(".");
  var enteras = Number(partes[0]) || 0;
  var outs =
    partes.length > 1
      ? Number(partes[1])
      : 0;

  return enteras +
    (
      outs === 1
        ? 1 / 3
        : outs === 2
          ? 2 / 3
          : 0
    );
}

// Trae nombre, mano y todo el historial de aperturas de un pitcher.
// El juego de hoy queda excluido antes de ordenar o calcular últimos 5.
async function jalarHistorialCompletoPitcher(
  pitcherId,
  season
) {
  var nombre = "ID " + pitcherId;
  var mano = "N/C";
  var hoy = ponchesHoyISO();

  try {
    var urlPersona =
      "https://statsapi.mlb.com/api/v1/people/" +
      pitcherId;

    var respPersona = await fetch(
      MLB_ROUTES.WORKER_BASE +
      encodeURIComponent(urlPersona)
    );

    if (respPersona.ok) {
      var dataPersona = await respPersona.json();

      var persona =
        dataPersona.people &&
        dataPersona.people[0]
          ? dataPersona.people[0]
          : null;

      if (persona) {
        if (persona.fullName) {
          nombre = persona.fullName;
        }

        if (
          persona.pitchHand &&
          persona.pitchHand.code
        ) {
          mano =
            persona.pitchHand.code === "L"
              ? "Zurdo"
              : "Derecho";
        }
      }
    }
  } catch (ePersona) {}

  var starts = [];

  try {
    var url =
      "https://statsapi.mlb.com/api/v1/people/" +
      pitcherId +
      "/stats?stats=gameLog&group=pitching&season=" +
      (season || 2026);

    var resp = await fetch(
      MLB_ROUTES.WORKER_BASE +
      encodeURIComponent(url)
    );

    if (resp.ok) {
      var data = await resp.json();

      var splits =
        data.stats &&
        data.stats[0] &&
        data.stats[0].splits
          ? data.stats[0].splits
          : [];

      for (var j = 0; j < splits.length; j++) {
        var sp = splits[j];

        var esAbridor =
          sp.stat &&
          (
            sp.stat.gamesStarted === 1 ||
            sp.stat.gamesStarted === "1"
          );

        if (!esAbridor) continue;

        // BLOQUEO MADRE:
        // Hoy y cualquier fecha futura no existen para el historial.
        if (!sp.date || sp.date >= hoy) {
          continue;
        }

        starts.push({
          fecha: sp.date,
          rival:
            sp.opponent
              ? sp.opponent.name
              : "?",
          ip: ipADecimal(
            sp.stat
              ? sp.stat.inningsPitched
              : null
          ),
          so:
            sp.stat &&
            sp.stat.strikeOuts !== undefined
              ? Number(sp.stat.strikeOuts)
              : null
        });
      }

      starts.sort(function(a, b) {
        if (a.fecha === b.fecha) return 0;
        return a.fecha < b.fecha ? 1 : -1;
      });
    }
  } catch (eLog) {}

  return {
    nombre: nombre,
    mano: mano,
    starts: starts
  };
}

async function jalarPonchesTodos(
  logFn,
  hoyISOStr
) {
  function log(t) {
    if (typeof logFn === "function") {
      logFn(t);
    }
  }

  var hoy = hoyISOStr || ponchesHoyISO();

  var cache = ponchesLeerCache();

  if (
    cache &&
    cache.fecha === hoy &&
    Array.isArray(cache.registros) &&
    cache.registros.length > 0
  ) {
    // Limpia cualquier registro de hoy que haya quedado
    // guardado previamente en el cache.
    var registrosLimpios =
      cache.registros.filter(function(r) {
        return (
          r &&
          r.fecha &&
          r.fecha >= PONCHES_FECHA_INICIO &&
          r.fecha < hoy
        );
      });

    if (
      registrosLimpios.length !==
      cache.registros.length
    ) {
      cache.registros = registrosLimpios;
      ponchesGuardarCache(cache);

      log(
        "Cache de ponches limpiado: eliminadas " +
        (
          cache.registros.length -
          registrosLimpios.length
        ) +
        " apertura(s) contaminadas."
      );
    }

    log(
      "Historial de ponches: cache de hoy OK (" +
      registrosLimpios.length +
      " aperturas históricas)."
    );

    return {
      fecha: hoy,
      registros: registrosLimpios
    };
  }

  if (
    typeof PITCHERS_MASTER_2026 ===
    "undefined"
  ) {
    throw new Error(
      "PITCHERS_MASTER_2026 no está cargado — falta <script src=\"pitchers-master.js\"> antes de este archivo."
    );
  }

  var pitcherIds =
    Object.keys(PITCHERS_MASTER_2026);

  log(
    "Pitchers a consultar: " +
    pitcherIds.length
  );

  var registros = [];
  var procesados = 0;
  var conError = 0;

  for (
    var i = 0;
    i < pitcherIds.length;
    i++
  ) {
    var pid = pitcherIds[i];
    var pInfo =
      PITCHERS_MASTER_2026[pid] || {};

    var nombrePitcher =
      pInfo.nombre ||
      pInfo.fullName ||
      null;

    var manoPitcher =
      pInfo.mano ||
      null;

    if (!nombrePitcher) {
      try {
        var urlPersona =
          "https://statsapi.mlb.com/api/v1/people/" +
          pid;

        var respPersona = await fetch(
          MLB_ROUTES.WORKER_BASE +
          encodeURIComponent(urlPersona)
        );

        if (respPersona.ok) {
          var dataPersona =
            await respPersona.json();

          var persona =
            dataPersona.people &&
            dataPersona.people[0]
              ? dataPersona.people[0]
              : null;

          if (persona) {
            if (persona.fullName) {
              nombrePitcher =
                persona.fullName;
            }

            if (
              persona.pitchHand &&
              persona.pitchHand.code
            ) {
              manoPitcher =
                persona.pitchHand.code === "L"
                  ? "Zurdo"
                  : "Derecho";
            }
          }
        }
      } catch (ePersona) {}

      if (!nombrePitcher) {
        nombrePitcher = "ID " + pid;
      }
    }

    try {
      var url =
        "https://statsapi.mlb.com/api/v1/people/" +
        pid +
        "/stats?stats=gameLog&group=pitching&season=2026";

      var proxyUrl =
        MLB_ROUTES.WORKER_BASE +
        encodeURIComponent(url);

      var resp =
        await fetch(proxyUrl);

      if (!resp.ok) {
        conError++;
        continue;
      }

      var data =
        await resp.json();

      var splits =
        data.stats &&
        data.stats[0] &&
        data.stats[0].splits
          ? data.stats[0].splits
          : [];

      for (
        var j = 0;
        j < splits.length;
        j++
      ) {
        var sp = splits[j];
        var fecha = sp.date;

        if (
          !fecha ||
          fecha < PONCHES_FECHA_INICIO
        ) {
          continue;
        }

        // BLOQUEO MADRE:
        // El juego de hoy no entra aunque MLB ya lo
        // haya creado dentro del gameLog.
        if (fecha >= hoy) {
          continue;
        }

        var esAbridor =
          sp.stat &&
          (
            sp.stat.gamesStarted === 1 ||
            sp.stat.gamesStarted === "1"
          );

        if (!esAbridor) {
          continue;
        }

        var equipoPropio =
          sp.team
            ? sp.team.name
            : null;

        var equipoRival =
          sp.opponent
            ? sp.opponent.name
            : null;

        var esCasa =
          !!sp.isHome;

        var equipoCasa =
          esCasa
            ? equipoPropio
            : equipoRival;

        var venue =
          equipoCasa
            ? (
              PONCHES_TEAM_VENUE[
                equipoCasa
              ] || null
            )
            : null;

        var ip =
          ipADecimal(
            sp.stat
              ? sp.stat.inningsPitched
              : null
          );

        var so =
          sp.stat &&
          sp.stat.strikeOuts !== undefined
            ? Number(
              sp.stat.strikeOuts
            )
            : null;

        var er =
          sp.stat &&
          sp.stat.earnedRuns !== undefined
            ? Number(
              sp.stat.earnedRuns
            )
            : null;

        var turno = null;

        if (
          sp.game &&
          sp.game.dayNight
        ) {
          turno =
            sp.game.dayNight;
        } else if (sp.dayNight) {
          turno =
            sp.dayNight;
        }

        registros.push({
          pitcher_id: pid,
          pitcher: nombrePitcher,
          mano: manoPitcher,
          fecha: fecha,
          venue: venue,
          equipo: equipoPropio,
          rival: equipoRival,
          es_casa: esCasa,
          ip: ip,
          so: so,
          er: er,
          turno: turno,
          llego_4ta:
            ip !== null
              ? ip >= PONCHES_IP_CORTE
              : null
        });
      }

      procesados++;

      if (
        procesados % 25 === 0
      ) {
        log(
          "Procesados " +
          procesados +
          "/" +
          pitcherIds.length +
          " pitchers..."
        );
      }
    } catch (e) {
      conError++;
    }
  }

  log(
    "Listo: " +
    registros.length +
    " aperturas históricas desde " +
    PONCHES_FECHA_INICIO +
    " (" +
    procesados +
    " pitchers OK, " +
    conError +
    " con error)."
  );

  var nuevo = {
    fecha: hoy,
    registros: registros
  };

  ponchesGuardarCache(nuevo);

  return nuevo;
}

// Cruza historial de ponches con clima real.
function ponchesCruzarConClima(
  registrosPonches
) {
  var climaCache =
    typeof climaLeerCache === "function"
      ? climaLeerCache()
      : [];

  var climaPorFechaVenue = {};

  climaCache.forEach(function(c) {
    if (
      !c ||
      !c.date ||
      !c.venue
    ) {
      return;
    }

    climaPorFechaVenue[
      c.date + "|" + c.venue
    ] = c;
  });

  return registrosPonches.map(
    function(r) {
      var key =
        r.fecha +
        "|" +
        r.venue;

      var clima =
        climaPorFechaVenue[key] ||
        null;

      return {
        pitcher: r.pitcher,
        pitcher_id: r.pitcher_id,
        mano: r.mano,
        fecha: r.fecha,
        venue: r.venue,
        equipo: r.equipo,
        rival: r.rival,
        ip: r.ip,
        so: r.so,
        er: r.er,
        turno: r.turno,
        llego_4ta: r.llego_4ta,
        wind_dir:
          clima
            ? clima.wind_dir
            : null,
        windspeed_mph:
          clima
            ? clima.windspeed_mph
            : null,
        temperature_f:
          clima
            ? clima.temperature_f
            : null,
        tiene_clima:
          !!clima
      };
    }
  );
}

// Agrupa por parque y rango de viento de 30°.
function ponchesAgruparPorParqueYViento(
  registrosConClima
) {
  var porParque = {};

  registrosConClima.forEach(
    function(r) {
      if (
        !r.venue ||
        r.wind_dir === null ||
        r.wind_dir === undefined ||
        isNaN(Number(r.wind_dir))
      ) {
        return;
      }

      var dir =
        Number(r.wind_dir) % 360;

      if (dir < 0) {
        dir += 360;
      }

      var lo =
        Math.floor(dir / 30) * 30;

      var hi =
        lo + 30;

      var rangoKey =
        lo + "-" + hi;

      if (!porParque[r.venue]) {
        porParque[r.venue] = {};
      }

      if (
        !porParque[r.venue][rangoKey]
      ) {
        porParque[r.venue][rangoKey] = {
          lo: lo,
          hi: hi,
          aperturas: []
        };
      }

      porParque[r.venue][
        rangoKey
      ].aperturas.push(r);
    }
  );

  var resultado = {};

  Object.keys(porParque).forEach(
    function(venue) {
      resultado[venue] = [];

      Object.keys(
        porParque[venue]
      ).forEach(function(rk) {
        var grupo =
          porParque[venue][rk];

        var aps =
          grupo.aperturas;

        var n =
          aps.length;

        var sumSO = 0;
        var nSO = 0;

        var sumIP = 0;
        var nIP = 0;

        var llegaron4 = 0;
        var conDato4 = 0;

        var sumVel = 0;
        var nVel = 0;

        aps.forEach(function(a) {
          if (a.so !== null) {
            sumSO += a.so;
            nSO++;
          }

          if (a.ip !== null) {
            sumIP += a.ip;
            nIP++;
          }

          if (
            a.llego_4ta !== null
          ) {
            conDato4++;

            if (a.llego_4ta) {
              llegaron4++;
            }
          }

          if (
            typeof a.windspeed_mph ===
            "number"
          ) {
            sumVel +=
              a.windspeed_mph;

            nVel++;
          }
        });

        resultado[venue].push({
          lo: grupo.lo,
          hi: grupo.hi,
          n: n,

          prom_so:
            nSO
              ? sumSO / nSO
              : null,

          prom_ip:
            nIP
              ? sumIP / nIP
              : null,

          pct_llegaron_4ta:
            conDato4
              ? (
                llegaron4 /
                conDato4 *
                100
              )
              : null,

          prom_windspeed:
            nVel
              ? sumVel / nVel
              : null
        });
      });

      resultado[venue].sort(
        function(a, b) {
          return a.lo - b.lo;
        }
      );
    }
  );

  return resultado;
}
