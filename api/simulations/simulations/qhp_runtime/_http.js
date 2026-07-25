// api/simulations/qhp_runtime/_http.js
// HTTP helpers shared across all qhp_runtime handlers
// Authority: Joshua Lopez — DCGP.AI — USPTO 19/555,951
'use strict';

function send(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, contentType, content, fileName) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (fileName) {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  }
  res.end(content);
}

function methodNotAllowed(res, route) {
  return send(res, 405, {
    ok: false,
    error: 'method_not_allowed',
    route,
    timestamp: new Date().toISOString()
  });
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

function linksFor(simulationId) {
  const base = `/api/simulations/qhp_runtime`;
  return {
    status:    `${base}/status/${simulationId}`,
    step:      `${base}/step/${simulationId}`,
    agents:    `${base}/agents/${simulationId}`,
    inject:    `${base}/inject/${simulationId}`,
    report:    `${base}/report/${simulationId}`,
    dashboard: `${base}/dashboard/${simulationId}`
  };
}

module.exports = { send, sendText, methodNotAllowed, parseBody, linksFor };
