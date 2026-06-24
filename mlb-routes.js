// mlb-routes.js
// ARCHIVO MADRE DE RUTAS - mlbpro-coincidencia
// Toda ruta/API vive aquí. Nada suelto en otros archivos.

const MLB_ROUTES = {

  WORKER_BASE: "https://mlb-score-proxy.jip0512.workers.dev/?url=",

  scheduleByDate: function (fecha) {
    const mlbUrl =
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + fecha;
    return MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
  }

};
