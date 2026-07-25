// lib/tony-gate.js
// Tony Gate — single-import middleware for any operator endpoint.
// Tony (Contact Hamiltonian gate H(q,p,S,t)) visits every planet in the constellation.
//
// Usage in any handler:
//   const { runTony } = require('../lib/tony-gate');
//   const tony = runTony(message, history);
//   // tony.governance  — full Tony gate telemetry
//   // tony.tokenBudget — Tony-authorized token ceiling for this exchange
//   // tony.admitted    — boolean: gate admitted this exchange
//   // tony.tonyScore   — Tony Award score [0,1] — how well the gate held S*
//
// Tony Awards Token Re-normalizer — licensable certification standard.
// Authority: Joshua Lopez — DCGP.AI — USPTO 19/555,951
'use strict';

const { computeGovernance, getSaturn115Status } = require('./saturn115');
const { governExchange } = require('./governance-middleware');

// ── Core Tony gate run ────────────────────────────────────────────────────────

function runTony(message, history, opts) {
  const msg = String(message || '');
  const hist = Array.isArray(history) ? history : [];

  // Tony computes governance from the message — deterministic, no Math.random
  const governance = computeGovernance(msg);

  return {
    governance,
    tokenBudget: governance.contactHamiltonian
      ? _deriveBudgetFromTony(governance) : 4096,
    admitted: governance.contactHamiltonian.admitted !== false,
    tonyScore: governance.contactHamiltonian.tonyScore || 0,
    recommendation: governance.recommendation,
    saturn115: getSaturn115Status(),
    ts: new Date().toISOString(),
    patent: 'USPTO 19/555,951',
    authority: 'Joshua Lopez — DCGP.AI LLC'
  };
}

// ── Tony post-response governance ─────────────────────────────────────────────
// Run Tony on the output after inference — drift correction, manifold enforcement.

function runTonyOnExchange(message, response, history, profile) {
  return governExchange({
    message: String(message || ''),
    response: String(response || ''),
    history: Array.isArray(history) ? history : [],
    profile: profile || 'general'
  });
}

// ── Token budget from Tony's gate output ─────────────────────────────────────

function _deriveBudgetFromTony(governance) {
  const ch = governance.contactHamiltonian;
  const H = ch.H || 0;
  const admitted = ch.admitted !== false;
  if (!admitted) return 2048;
  const H_norm = Math.min(1, H / 8);
  return Math.max(256, Math.floor(256 * Math.pow(5000000 / 256, H_norm)));
}

// ── Tony Award score for an external gate result ──────────────────────────────
// Submit any governance gate result to be scored by Tony's standard.
// This is the Tony Awards Token Re-normalizer certification function.
// lower maxDrift + proved + admitted = higher Tony score.

function scoreTonyAward(gateResult) {
  if (!gateResult || typeof gateResult !== 'object') {
    return { tonyScore: 0, certified: false, reason: 'no_gate_result' };
  }

  const proved   = gateResult.proved === true;
  const admitted = gateResult.admitted !== false;
  const maxDrift = Number(gateResult.maxDrift || gateResult.max_drift || 0);
  const epsilon  = Number(gateResult.epsilon || 1.2);

  if (!proved || !admitted) {
    return {
      tonyScore: 0,
      certified: false,
      reason: proved ? 'not_admitted' : 'manifold_breached',
      maxDrift,
      epsilon
    };
  }

  // Tony score: how far below epsilon the maxDrift stayed, normalized to [0,1]
  const tonyScore = Math.max(0, Math.min(1, 1 - (maxDrift / epsilon)));
  const certified = tonyScore >= 0.5;

  return {
    tonyScore: parseFloat(tonyScore.toFixed(6)),
    certified,
    tier: tonyScore >= 0.9 ? 'GOLD' : tonyScore >= 0.7 ? 'SILVER' : tonyScore >= 0.5 ? 'BRONZE' : 'UNCERTIFIED',
    maxDrift,
    epsilon,
    proved,
    admitted,
    reason: certified ? 'held_manifold' : 'insufficient_stability',
    patent: 'USPTO 19/555,951',
    authority: 'Joshua Lopez — DCGP.AI LLC'
  };
}

module.exports = {
  runTony,
  runTonyOnExchange,
  scoreTonyAward
};
