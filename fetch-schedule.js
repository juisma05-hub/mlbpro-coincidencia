// fetch-schedule.js
// PIEZA 2 - trae los juegos del schedule por el Worker.
// Usa la ruta del archivo madre (mlb-routes.js).
// No resuelve nada, no calcula nada. Solo trae y entrega.

async function fetchSchedule(fecha) {
  const url = MLB_ROUTES.scheduleByDate(fecha);

  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error("Schedule HTTP " + resp.status + " para " + fecha);
  }

  const data = await resp.json();

  const dates = data.dates || [];
  if (dates.length === 0) {
    return []; // sin juegos esa fecha (vacio real, no es error)
  }

  return dates[0].games || [];
}
