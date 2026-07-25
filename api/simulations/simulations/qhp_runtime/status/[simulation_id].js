"use strict";

const { getSimulation } = require("../_runtime_store");
const { linksFor, methodNotAllowed, send } = require("../_http");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") {
    return methodNotAllowed(res, "/api/simulations/qhp_runtime/status/<simulation_id>");
  }

  const simulationId = req.query && req.query.simulation_id;
  const simulation = getSimulation(simulationId);
  if (!simulation) {
    return send(res, 404, {
      ok: false,
      error: "simulation_not_found",
      simulation_id: simulationId || null,
      route: "/api/simulations/qhp_runtime/status/<simulation_id>",
      timestamp: new Date().toISOString()
    });
  }

  return send(res, 200, {
    ok: true,
    route: `/api/simulations/qhp_runtime/status/${simulationId}`,
    ...simulation.status(),
    links: linksFor(simulationId),
    timestamp: new Date().toISOString()
  });
};
