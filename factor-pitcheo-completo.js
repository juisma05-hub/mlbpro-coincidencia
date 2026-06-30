// factor-pitcheo-completo.js
// PIEZA - combina ABRIDOR + BULLPEN DISPONIBLE de un equipo en UN factor de carreraje.
// Es Moneyline (carreras de TODO el juego), no solo lo que tire el abridor.
// Logica:
//   1. Abridor confirmado (jalar-roster.js) -> factor_arsenal_lineup del abridor.
//   2. Bullpen del equipo (jalar-bullpen.js de su ULTIMO juego, para tener el roster de pitchers
//      activos recientes) menos los que tiraron 3+ outs ayer (deduccion: no disponibles hoy).
//   3. Cada relevista disponible se cruza tambien contra el lineup rival (arsenal vs lineup).
//   4. El factor final pondera: abridor pesa mas (se asume ~5-6 innings), bullpen pesa el resto.
// NO inventa pesos de la nada: el peso del abridor se basa en innings promedio reales si existen
// en PITCHERS_MASTER_2026 (no estan ahi todavia -> se usa una ventana fija documentada abajo,
// marcada como SUPUESTO, no como dato).
// Si falta cualquier pieza (lineup, arsenal, bullpen) -> ese componente se excluye, no se inventa.

async function calcularFactorPitcheoCompleto(teamId, pitcherAbridorId, lineupRival, fechaHoyISO) {
  const salida = {
    team_id: teamId,
    abridor_id: pitcherAbridorId,
    factor_abridor: null,
    factor_bullpen: null,
    factor_final: 1.0,
    bullpen_disponible: [],
    bullpen_no_disponible_hoy: [],
    confirmado: false,
    nota: ""
  };

  // 1. ABRIDOR
  const resAbridor = calcularFactorArsenalLineup(pitcherAbridorId, lineupRival);
  salida.factor_abridor = resAbridor.confirmado ? resAbridor.factor : null;

  // 2. BULLPEN: traer el ultimo juego de este equipo para tener el roster de pitchers usados
  let bullpenAyer;
  try {
    bullpenAyer = await jalarBullpenAyer(teamId, fechaHoyISO);
  } catch (err) {
    salida.nota = "ERR_BULLPEN:" + (err && err.message ? err.message : err);
    bullpenAyer = null;
  }

  if (!bullpenAyer || bullpenAyer.error) {
    salida.nota += " SIN_BULLPEN_CONFIRMADO";
  } else {
    const noDisponibles = pitchersNoDisponiblesHoy(bullpenAyer);
    const idsNoDisponibles = noDisponibles.map(function(p) { return p.player_id; });
    salida.bullpen_no_disponible_hoy = noDisponibles;

    // candidatos disponibles: los que aparecieron en el roster reciente y NO estan en la lista de quemados
    const candidatosDisponibles = bullpenAyer.pitchers_usados_ayer.filter(function(p) {
      return idsNoDisponibles.indexOf(p.player_id) === -1 && p.player_id !== pitcherAbridorId;
    });

    let sumaFactorBullpen = 0;
    let nRelevistasValidos = 0;

    for (let i = 0; i < candidatosDisponibles.length; i++) {
      const relevista = candidatosDisponibles[i];
      const resRelevista = calcularFactorArsenalLineup(relevista.player_id, lineupRival);
      if (!resRelevista.confirmado) continue;
      sumaFactorBullpen += resRelevista.factor;
      nRelevistasValidos++;
      salida.bullpen_disponible.push({
        player_id: relevista.player_id,
        nombre: relevista.nombre,
        factor: resRelevista.factor
      });
    }

    if (nRelevistasValidos > 0) {
      salida.factor_bullpen = Math.round((sumaFactorBullpen / nRelevistasValidos) * 1000) / 1000;
    }
  }

  // 3. COMBINAR abridor + bullpen
  // SUPUESTO documentado (no es dato real, es ventana fija): abridor pesa 60%, bullpen 40%.
  // Se ajusta solo si falta una de las dos partes.
  if (salida.factor_abridor !== null && salida.factor_bullpen !== null) {
    salida.factor_final = Math.round((salida.factor_abridor * 0.6 + salida.factor_bullpen * 0.4) * 1000) / 1000;
    salida.confirmado = true;
    salida.nota = "OK_ABRIDOR_Y_BULLPEN";
  } else if (salida.factor_abridor !== null) {
    salida.factor_final = salida.factor_abridor;
    salida.confirmado = true;
    salida.nota = "SOLO_ABRIDOR_CONFIRMADO";
  } else if (salida.factor_bullpen !== null) {
    salida.factor_final = salida.factor_bullpen;
    salida.confirmado = true;
    salida.nota = "SOLO_BULLPEN_CONFIRMADO";
  } else {
    salida.factor_final = 1.0;
    salida.confirmado = false;
    salida.nota = "SIN_DATOS_NEUTRO";
  }

  return salida;
}
