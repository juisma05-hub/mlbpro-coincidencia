// jalar-ultimos5.js
// PIEZA - trae los ULTIMOS 5 juegos como ABRIDOR de un pitcher (pitches, IP, K, BB, H, ER, fecha).
// Fuente: MLB Stats API /people/{id}/stats?stats=gameLog&group=pitching&season={year}
// Filtra solo juegos donde fue abridor (gamesStarted=1 en el split).
// NO inventa: si no hay 5 juegos disponibles, devuelve los que haya y marca el total real.
//
// CORRECCION (sesion 5 jul 2026): las entradas lanzadas de MLB no son decimal real, son
// notacion de beisbol: el numero despues del punto son OUTS (0,1,2), nunca decimas. Antes
// este archivo usaba parseFloat() directo, lo que trataba "3.1" como 3.1 decimal en vez de
// 3.333 real. Se agrega ipRealDesdeBeisbol() para la conversion correcta.
//
// CORRECCION (sesion 5 jul 2026): se quito el redondeo prematuro de ip_promedio y
// k_promedio. Ahora cada uno tiene version _preciso (precision completa, usar para
// calcular) y version normal (redondeada, solo para mostrar en pantalla).
//
// AGREGADO (sesion 5 jul 2026): promedios de BB (base_on_balls), H (hits) y ER
// (earned_runs) por salida -- los pide la Capa 2 de F5 (K/BB/WHIP/ERA reciente). Si el
// campo no viene de MLB Stats API, queda null, no se inventa.
//
// Sin cruce con F5 ni Moneyline: este archivo solo trae datos crudos de las ultimas 5
// salidas del abridor. No calcula ninguna formula aqui -- eso vive en sus propios motores.

function ipRealDesdeBeisbol(ipTexto) {
  if (ipTexto === undefined || ipTexto === null || ipTexto === "") return null;
  var partes = String(ipTexto).split(".");
  var enteras = parseInt(partes[0], 10);
  var outs = partes.length > 1 ? parseInt(partes[1], 10) : 0;
  if (isNaN(enteras)) return null;
  if (isNaN(outs) || outs < 0 || outs > 2) outs = 0; // .3 no existe en notacion real de MLB
  return enteras + (outs / 3);
}

async function jalarUltimos5(playerId, season) {
  const salida = {
    player_id: playerId,
    season: season,
    juegos: [], // [{date, pitches, innings_pitched, innings_pitched_real, strikeouts, base_on_balls, hits, earned_runs, runs_allowed, opponent}]
    pitches_promedio: null,
    ip_promedio: null,
    ip_promedio_preciso: null,
    k_promedio: null,
    k_promedio_preciso: null,
    bb_promedio: null,
    h_promedio: null,
    er_promedio: null,
    n_juegos: 0,
    error: null
  };

  if (!playerId) { salida.error = "ERR:SIN_PLAYER_ID"; return salida; }

  try {
    const mlbUrl = "https://statsapi.mlb.com/api/v1/people/" + playerId +
      "/stats?stats=gameLog&group=pitching&season=" + season;
    const url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
    const res = await fetch(url);
    if (!res.ok) { salida.error = "ERR:GAMELOG_HTTP_" + res.status; return salida; }
    const data = await res.json();

    const stats = data && data.stats && data.stats[0] ? data.stats[0] : null;
    const splits = stats && stats.splits ? stats.splits : [];
    if (!splits.length) { salida.error = "SIN_GAMELOG_DISPONIBLE"; return salida; }

    const comoAbridor = splits.filter(function(s) {
      return s.stat && Number(s.stat.gamesStarted) === 1;
    });

    if (!comoAbridor.length) { salida.error = "SIN_SALIDAS_COMO_ABRIDOR"; return salida; }

    comoAbridor.sort(function(a, b) {
      return (b.date || "") < (a.date || "") ? -1 : 1;
    });
    const ultimos5 = comoAbridor.slice(0, 5);

    let sumaPitches = 0, nPitches = 0;
    let sumaIPReal = 0, nIP = 0;
    let sumaK = 0, nK = 0;
    let sumaBB = 0, nBB = 0;
    let sumaH = 0, nH = 0;
    let sumaER = 0, nER = 0;

    ultimos5.forEach(function(s) {
      const st = s.stat || {};
      const pitches = st.numberOfPitches !== undefined ? Number(st.numberOfPitches) : null;
      const ipReal = ipRealDesdeBeisbol(st.inningsPitched);
      const k = st.strikeOuts !== undefined ? Number(st.strikeOuts) : null;
      const bb = st.baseOnBalls !== undefined ? Number(st.baseOnBalls) : null;
      const h = st.hits !== undefined ? Number(st.hits) : null;
      const er = st.earnedRuns !== undefined ? Number(st.earnedRuns) : null;
      const runs = st.runs !== undefined ? Number(st.runs) : null;
      const opp = s.opponent && s.opponent.name ? s.opponent.name : "NO_CONFIRMADO";

      salida.juegos.push({
        date: s.date || "NO_CONFIRMADO",
        pitches: pitches,
        innings_pitched: st.inningsPitched !== undefined ? st.inningsPitched : "NO_CONFIRMADO",
        innings_pitched_real: ipReal,
        strikeouts: k,
        base_on_balls: bb,
        hits: h,
        earned_runs: er,
        runs_allowed: runs,
        opponent: opp
      });

      if (pitches !== null && !isNaN(pitches)) { sumaPitches += pitches; nPitches++; }
      if (ipReal !== null && !isNaN(ipReal)) { sumaIPReal += ipReal; nIP++; }
      if (k !== null && !isNaN(k)) { sumaK += k; nK++; }
      if (bb !== null && !isNaN(bb)) { sumaBB += bb; nBB++; }
      if (h !== null && !isNaN(h)) { sumaH += h; nH++; }
      if (er !== null && !isNaN(er)) { sumaER += er; nER++; }
    });

    salida.n_juegos = ultimos5.length;

    salida.pitches_promedio = nPitches > 0 ? Math.round((sumaPitches / nPitches) * 10) / 10 : null;

    salida.ip_promedio_preciso = nIP > 0 ? (sumaIPReal / nIP) : null;
    salida.ip_promedio = salida.ip_promedio_preciso !== null ? Math.round(salida.ip_promedio_preciso * 100) / 100 : null;

    salida.k_promedio_preciso = nK > 0 ? (sumaK / nK) : null;
    salida.k_promedio = salida.k_promedio_preciso !== null ? Math.round(salida.k_promedio_preciso * 10) / 10 : null;

    salida.bb_promedio = nBB > 0 ? Math.round((sumaBB / nBB) * 100) / 100 : null;
    salida.h_promedio = nH > 0 ? Math.round((sumaH / nH) * 100) / 100 : null;
    salida.er_promedio = nER > 0 ? Math.round((sumaER / nER) * 100) / 100 : null;

    return salida;
  } catch (err) {
    salida.error = "ERR:" + err.message;
    return salida;
  }
}
