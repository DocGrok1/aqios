"use strict";

const { getSimulation } = require("../_runtime_store");
const { linksFor, methodNotAllowed, send } = require("../_http");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") {
    return methodNotAllowed(res, "/api/simulations/qhp_runtime/agents/<simulation_id>");
  }

  const simulationId = req.query && req.query.simulation_id;
  const simulation = getSimulation(simulationId);
  if (!simulation) {
    return send(res, 404, {
      ok: false,
      error: "simulation_not_found",
      simulation_id: simulationId || null,
      route: "/api/simulations/qhp_runtime/agents/<simulation_id>",
      timestamp: new Date().toISOString()
    });
  }

  const offset = Number(req.query.offset || 0);
  const limit = Number(req.query.limit || 50);

  return send(res, 200, {
    ok: true,
    route: `/api/simulations/qhp_runtime/agents/${simulationId}`,
    simulation_id: simulationId,
    offset,
    limit,
    agents: simulation.listAgents(offset, limit),
    links: linksFor(simulationId),
    timestamp: new Date().toISOString()
  });
};
