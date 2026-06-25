// venideros-schedule.js
// PIEZA - trae el schedule de los proximos 7 dias (por el Worker) y lo agrupa
// en SERIES con armarBloques() (mismo armado que el historico).
// Solo schedule futuro. SIN pronostico todavia (esa es la pieza siguiente).
// No inventa: si el proxy falla, lanza el error real.

async function veniderosSchedule(logFn) {
  function log(t){ if (typeof logFn === "function") logFn(t); }

  function isoMas(dias){
    var d = new Date();
    d.setDate(d.getDate() + dias);
    return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);
  }

  var start = isoMas(1);   // desde mañana
  var end   = isoMas(7);   // hasta 7 dias
  log("Venideros: " + start + " -> " + end);

  var mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1" +
    "&startDate=" + start + "&endDate=" + end;
  var url = MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);

  var res = await fetch(url);
  if (!res.ok) throw new Error("SCHEDULE FUTURO HTTP " + res.status);
  var data = await res.json();
  if (!data || !Array.isArray(data.dates)) throw new Error("El proxy no devolvio calendario.");

  var games = [];
  data.dates.forEach(function(day){
    (day.games || []).forEach(function(g){
      games.push({
        date: day.date,
        gameDate: g.gameDate,
        game_id: g.gamePk,
        home_team: g.teams && g.teams.home && g.teams.home.team ? g.teams.home.team.name : "",
        away_team: g.teams && g.teams.away && g.teams.away.team ? g.teams.away.team.name : "",
        venue: g.venue ? g.venue.name : "",
        status: g.status ? g.status.detailedState : ""
      });
    });
  });
  log("Juegos venideros: " + games.length);

  var bloques = armarBloques(games);
  log("Series venideras: " + bloques.length);
  return bloques;
}
