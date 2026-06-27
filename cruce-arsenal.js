// cruce-arsenal.js
// PIEZA UNICA del cruce arsenal-vs-bateo (carreraje).
// Confronta el ARSENAL del pitcher de hoy (ARSENAL_MASTER_2026) contra COMO le batea
// el lineup rival a cada tipo de pitcheo (BATTERS_VSPITCH_2026).
// NORTE: nunca se evalua el pitcher solo. Siempre arsenal del pitcher vs bateo del rival.
//
// Necesita cargados antes (en index): arsenal-master.js y batters-vspitch.js
// El lineup sale del MISMO boxscore que ya jala jalar-roster.js (no jala nada nuevo).
//
// NO inventa: si falta arsenal del pitcher -> "NO_CONFIRMADO".
//             si falta el lineup -> "PENDIENTE" (lineup no puesto aun).
//             si un bateador no tiene dato vs un pitcheo -> ese par se omite (no se inventa).
//
// ============================================================================
// 1) LINEUP TITULAR  (del boxscore: data.liveData.boxscore.teams.away / .home)
// ============================================================================
// Titulares = los que tienen battingOrder terminado en "00" (100,200,...,900).
function lineupTitular(team) {
  if (!team || !team.players) return [];
  var arr = [];
  var keys = Object.keys(team.players);
  for (var i = 0; i < keys.length; i++) {
    var p = team.players[keys[i]];
    if (!p) continue;
    var ordenRaw = p.battingOrder;
    if (ordenRaw === undefined || ordenRaw === null || ordenRaw === "") continue;
    var orden = parseInt(ordenRaw, 10);
    if (!isFinite(orden)) continue;
    var id = (p.person && p.person.id != null) ? p.person.id : null;
    if (id == null) continue;
    var nombre = (p.person && p.person.fullName) ? p.person.fullName : "";
    arr.push({ id: id, orden: orden, nombre: nombre });
  }
  arr.sort(function(a, b){ return a.orden - b.orden; });
  var titulares = arr.filter(function(x){ return x.orden % 100 === 0; });
  if (titulares.length === 0) return arr.slice(0, 9);
  return titulares.slice(0, 9);
}

function lineupIds(team) {
  return lineupTitular(team).map(function(x){ return x.id; });
}

// ============================================================================
// 2) EL CRUCE  (arsenal del pitcher  vs  bateo del lineup rival)
// ============================================================================
// pitcherId: id del pitcher (cruza con ARSENAL_MASTER_2026)
// lineup: array de objetos {id, nombre} del lineup rival (de lineupTitular)
//
// Idea: por cada pitcheo del arsenal (con su % de uso), se mira cuanto le batea
// cada rival a ESE pitcheo (woba). Se pondera el woba del lineup por cuanto usa
// el pitcher ese pitcheo. Resultado: woba esperado del lineup contra este arsenal.
// woba de liga ~.320 es neutro. Mas alto = el lineup le pega; mas bajo = el pitcher manda.
function cruzarArsenal(pitcherId, lineup) {
  var res = {
    estado: "OK",
    pitcher_id: pitcherId,
    pitcher_name: "",
    n_pitcheos: 0,
    n_bateadores: 0,
    woba_esperado: null,   // woba del lineup contra este arsenal
    detalle: [],           // por pitcheo: {pt, usage, woba_lineup, n}
    nota: ""
  };

  // arsenal del pitcher
  var A = (typeof ARSENAL_MASTER_2026 !== "undefined") ? ARSENAL_MASTER_2026[pitcherId] : null;
  if (!A || !A.arsenal || !A.arsenal.length) {
    res.estado = "NO_CONFIRMADO";
    res.nota = "Sin arsenal para este pitcher.";
    return res;
  }
  res.pitcher_name = A.name || "";
  res.n_pitcheos = A.arsenal.length;

  // lineup
  if (!lineup || !lineup.length) {
    res.estado = "PENDIENTE";
    res.nota = "Lineup no confirmado todavia.";
    return res;
  }

  // total de usage para normalizar (algunos pitcheos suman <100)
  var totalUsage = 0;
  for (var a = 0; a < A.arsenal.length; a++) {
    if (A.arsenal[a].usage != null) totalUsage += A.arsenal[a].usage;
  }
  if (totalUsage <= 0) {
    res.estado = "NO_CONFIRMADO";
    res.nota = "Arsenal sin % de uso.";
    return res;
  }

  var wobaPonderado = 0;
  var pesoUsado = 0;
  var batSet = {};

  for (var i = 0; i < A.arsenal.length; i++) {
    var pitch = A.arsenal[i];
    var pt = pitch.pt;
    var usage = (pitch.usage != null) ? pitch.usage : 0;
    if (usage <= 0) continue;

    // promedio del woba del lineup contra ESTE pitcheo
    var sumaWoba = 0, n = 0;
    for (var b = 0; b < lineup.length; b++) {
      var bid = lineup[b].id;
      var B = (typeof BATTERS_VSPITCH_2026 !== "undefined") ? BATTERS_VSPITCH_2026[bid] : null;
      if (!B || !B.vs || !B.vs[pt]) continue;       // ese bateador no tiene dato vs ese pitcheo
      var w = B.vs[pt].woba;
      if (w == null) continue;
      sumaWoba += w; n++;
      batSet[bid] = true;
    }
    if (n === 0) continue;   // ningun rival tiene dato vs este pitcheo: se omite (no se inventa)

    var wobaLineupVsPitch = sumaWoba / n;
    var peso = usage / totalUsage;
    wobaPonderado += wobaLineupVsPitch * peso;
    pesoUsado += peso;

    res.detalle.push({
      pt: pt,
      usage: Math.round(usage * 10) / 10,
      woba_lineup: Math.round(wobaLineupVsPitch * 1000) / 1000,
      n_bateadores: n
    });
  }

  res.n_bateadores = Object.keys(batSet).length;

  if (pesoUsado <= 0) {
    res.estado = "NO_CONFIRMADO";
    res.nota = "Sin cruce: el lineup no tiene datos vs los pitcheos de este pitcher.";
    return res;
  }

  // renormalizar por el peso realmente usado (los pitcheos que si cruzaron)
  res.woba_esperado = Math.round((wobaPonderado / pesoUsado) * 1000) / 1000;
  return res;
}

// ============================================================================
// 3) LECTURA RAPIDA  (texto corto para mostrar en la tarjeta)
// ============================================================================
// Devuelve una frase honesta segun el woba esperado. Referencia liga ~.320.
// NO dice "dominante/malo" del pitcher solo: habla del CRUCE (lineup vs arsenal).
function lecturaCruce(res) {
  if (!res || res.estado === "NO_CONFIRMADO") return "Cruce arsenal NO_CONFIRMADO";
  if (res.estado === "PENDIENTE") return "Cruce arsenal PENDIENTE (lineup no puesto)";
  var w = res.woba_esperado;
  if (w == null) return "Cruce arsenal NO_CONFIRMADO";
  var lectura;
  if (w >= 0.350) lectura = "el lineup le batea fuerte al arsenal";
  else if (w >= 0.320) lectura = "el lineup le batea algo por encima del promedio";
  else if (w >= 0.300) lectura = "parejo (cerca del promedio de liga)";
  else if (w >= 0.280) lectura = "el arsenal contiene algo al lineup";
  else lectura = "el arsenal domina a este lineup";
  return "Cruce: wOBA esperado " + w.toFixed(3) + " — " + lectura;
}
