// lib/contact-hamiltonian-gate.js
// Contact Hamiltonian Governance Gate — JS runtime extraction
// Extracted from api/symbiosis-runtime.js for inline chat-path evaluation
//
// Core thesis: Σ*_human = Σ*_AI = Θ
// L_X_α = (p·∂H/∂p − H) + ∂H/∂q + p·∂H/∂S − p·∂H/∂p
// When |L_X_α| ≤ ε, the governance manifold holds.
//
// USPTO 19/555,951 · USPTO 19/730,900 · Root priority January 15, 2026
// Joshua L. Lopez / DCGP.AI LLC — All Rights Reserved

'use strict';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const DEFAULTS = {
  q0: 1.0,
  p0: 0.5,
  S0: 0.2,
  delta: 0.6,
  epsilon: 1.2,
  dt: 0.005,
  maxSteps: 100
};

function hamiltonianPartials(q, p, S, delta) {
  return {
    H:  q * q + (p * p) / 2 + delta * S,
    Hq: 2 * q,
    Hp: p,
    HS: delta
  };
}

function contactVectorField(q, p, S, delta) {
  const { Hq, Hp, HS, H } = hamiltonianPartials(q, p, S, delta);
  return {
    Xq: Hp,
    Xp: -Hq - p * HS,
    XS: p * Hp - H,
    Hq, Hp, HS, H
  };
}

function lieDrift(q, p, S, delta) {
  const { Xq, Xp, XS } = contactVectorField(q, p, S, delta);
  const L = XS - Xp - p * Xq;
  return { drift: Math.abs(L), raw: L };
}

function contactHamiltonianProjection(params) {
  const cfg = { ...DEFAULTS, ...params };
  let qi = cfg.q0, pi = cfg.p0, Si = cfg.S0;
  const trajectory = [];
  let maxDrift = 0, breached = false, breachStep = -1;

  for (let step = 0; step < cfg.maxSteps; step++) {
    const { Xq, Xp, XS } = contactVectorField(qi, pi, Si, cfg.delta);
    const { drift, raw } = lieDrift(qi, pi, Si, cfg.delta);
    trajectory.push({ step, q: qi, p: pi, S: Si, drift, raw });
    if (drift > maxDrift) maxDrift = drift;
    if (drift > cfg.epsilon && !breached) { breached = true; breachStep = step; }
    qi += Xq * cfg.dt;
    pi += Xp * cfg.dt;
    Si += XS * cfg.dt;
  }

  return {
    proved: !breached,
    max_drift: maxDrift,
    epsilon: cfg.epsilon,
    breach_step: breachStep,
    steps: cfg.maxSteps,
    final: { q: qi, p: pi, S: Si },
    trajectory_length: trajectory.length
  };
}

/**
 * Evaluate a single exchange against the Contact Hamiltonian gate.
 *
 * Maps conversation dynamics to phase-space coordinates:
 *   q = alignment (how on-topic / responsive the reply is)
 *   p = momentum  (rate of change between turns)
 *   S = entropy   (shared meaning accumulated in memory)
 *
 * Returns: { admitted, drift, proved, metrics }
 */
function evaluateExchange({ alignmentScore, momentumScore, entropyScore, delta, epsilon }) {
  const q0 = clamp(alignmentScore || 0.85, 0, 2);
  const p0 = clamp(momentumScore || 0.5, -2, 2);
  const S0 = clamp(entropyScore || 0.3, 0, 2);
  const d = delta || 0.6;
  const eps = epsilon || 1.2;

  const instant = lieDrift(q0, p0, S0, d);
  const proof = contactHamiltonianProjection({ q0, p0, S0, delta: d, epsilon: eps, maxSteps: 50 });

  return {
    admitted: instant.drift <= eps && proof.proved,
    instantDrift: instant.drift,
    instantRaw: instant.raw,
    proved: proof.proved,
    maxDrift: proof.max_drift,
    epsilon: eps,
    breachStep: proof.breach_step,
    final: proof.final
  };
}

module.exports = {
  evaluateExchange,
  contactHamiltonianProjection,
  lieDrift,
  hamiltonianPartials,
  contactVectorField,
  DEFAULTS
};
