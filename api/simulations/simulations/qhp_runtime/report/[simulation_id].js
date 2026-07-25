"use strict";

const { getSimulation } = require("../_runtime_store");
const { linksFor, methodNotAllowed, send, sendText } = require("../_http");

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") {
    return methodNotAllowed(res, "/api/simulations/qhp_runtime/report/<simulation_id>");
  }

  const simulationId = req.query && req.query.simulation_id;
  const simulation = getSimulation(simulationId);
  if (!simulation) {
    return send(res, 404, {
      ok: false,
      error: "simulation_not_found",
      simulation_id: simulationId || null,
      route: "/api/simulations/qhp_runtime/report/<simulation_id>",
      timestamp: new Date().toISOString()
    });
  }

  const format = String(req.query.format || "json").toLowerCase();
  const report = simulation.report(format);
  if (report.format === "csv" || report.format === "pdf") {
    return sendText(res, 200, report.contentType, report.content, report.fileName);
  }

  return send(res, 200, {
    ok: true,
    route: `/api/simulations/qhp_runtime/report/${simulationId}`,
    format,
    report: report.content,
    links: linksFor(simulationId),
    timestamp: new Date().toISOString()
  });
};
