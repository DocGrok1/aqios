"use strict";

const { getSimulation } = require("../_runtime_store");
const { linksFor, methodNotAllowed, parseBody, send } = require("../_http");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") {
    return methodNotAllowed(res, "/api/simulations/qhp_runtime/inject/<simulation_id>");
  }

  const simulationId = req.query && req.query.simulation_id;
  const simulation = getSimulation(simulationId);
  if (!simulation) {
    return send(res, 404, {
      ok: false,
      error: "simulation_not_found",
      simulation_id: simulationId || null,
      route: "/api/simulations/qhp_runtime/inject/<simulation_id>",
      timestamp: new Date().toISOString()
    });
  }

  const body = parseBody(req);
  const indices = Array.isArray(body.agent_indices) ? body.agent_indices : [0];
  const payload = body.adversarial_information || body.payload || { event_type: "adversarial_event", severity: 0.8 };
  const result = simulation.inject(indices, payload);

  return send(res, 200, {
    ok: true,
    route: `/api/simulations/qhp_runtime/inject/${simulationId}`,
    action: "inject",
    result,
    status: simulation.status(),
    links: linksFor(simulationId),
    timestamp: new Date().toISOString()
  });
};
