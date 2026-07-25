"use strict";

const { getSimulation } = require("../_runtime_store");
const { linksFor, methodNotAllowed } = require("../_http");

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return methodNotAllowed(res, "/api/simulations/qhp_runtime/dashboard/<simulation_id>");
  }

  const simulationId = req.query && req.query.simulation_id;
  const simulation = getSimulation(simulationId);
  if (!simulation) {
    return sendHtml(
      res,
      404,
      `<html><body><h1>Simulation not found</h1><p>${String(simulationId || "")}</p></body></html>`
    );
  }

  const status = simulation.status();
  const links = linksFor(simulationId);
  const metrics = status.metrics || {};

  return sendHtml(
    res,
    200,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QHP Dashboard ${simulationId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #0b1220; color: #e5e7eb; }
    a { color: #93c5fd; }
  </style>
</head>
<body>
  <h1>QHP Runtime Dashboard</h1>
  <p><strong>Simulation ID:</strong> ${simulationId}</p>
  <p><strong>Cycle:</strong> ${status.swarm_status.cycle} | <strong>Agents:</strong> ${status.agent_count}</p>
  <h2>Metrics</h2>
  <ul>
    <li>Business Health: ${metrics.business_health}</li>
    <li>Obligation Health: ${metrics.obligation_health}</li>
    <li>Fidelity Mean: ${metrics.fidelity_mean}</li>
    <li>Resilience Index: ${metrics.resilience_index}</li>
    <li>Risk Index: ${metrics.risk_index}</li>
    <li>Adversarial Events: ${metrics.adversarial_events}</li>
  </ul>
  <h2>Links</h2>
  <ul>
    <li><a href="${links.status}">Status</a></li>
    <li><a href="${links.agents}">Agents</a></li>
    <li><a href="${links.report}?format=json">Report JSON</a></li>
    <li><a href="${links.report}?format=csv">Report CSV</a></li>
  </ul>
</body>
</html>`
  );
};
