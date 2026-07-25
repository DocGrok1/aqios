// api/simulations/qhp_runtime/start.js
// POST /api/simulations/qhp_runtime/start — create a new QHP simulation
// Called by: api/invention-sim-spawn.js
// Authority: Joshua Lopez — DCGP.AI — USPTO 19/555,951
'use strict';

const { createSimulation, listSimulations } = require('./_runtime_store');
const { send, parseBody, linksFor, methodNotAllowed } = require('./_http');

function generateId(opts) {
  const base = opts.coin_id
    ? 'sim-' + String(opts.coin_id).slice(0, 12).toLowerCase().replace(/[^a-z0-9]/g, '')
    : 'qhp-' + Date.now().toString(36);
  return base;
}

module.exports = function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  // GET — list all active simulations
  if (req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      route: '/api/simulations/qhp_runtime/start',
      simulations: listSimulations(),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, '/api/simulations/qhp_runtime/start');
  }

  const body = parseBody(req);

  const simulation_id = body.simulation_id || generateId(body);
  const sim = createSimulation(simulation_id, body);

  return send(res, 201, {
    ok: true,
    route: '/api/simulations/qhp_runtime/start',
    simulation_id,
    name: sim.name,
    domain: sim.domain,
    planet: sim.planet,
    agent_count: sim.agent_count,
    links: linksFor(simulation_id),
    status: sim.status(),
    timestamp: new Date().toISOString(),
    authority: 'Joshua Lopez — DCGP.AI — USPTO 19/555,951'
  });
};
