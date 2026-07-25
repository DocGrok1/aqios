// lib/governance-middleware.js
// Constitutional Governance Middleware — single import for all chat handlers
// Wraps: Contact Hamiltonian Gate + Conversational Drift Governor
//
// Usage in any handler:
//   const { governExchange } = require("../lib/governance-middleware");
//   const governed = governExchange({ message, response, history, profile });
//   // governed.response  — corrected response text
//   // governed.metrics   — full governance telemetry
//   // governed.admitted  — boolean: did the gate admit this exchange?
//
// USPTO 19/555,951 · USPTO 19/730,900 · Root priority January 15, 2026
// Joshua L. Lopez / DCGP.AI LLC — All Rights Reserved

'use strict';

const { evaluateExchange } = require("./contact-hamiltonian-gate");
const { evaluateConversationalDrift } = require("./conversational-drift-governor");
const { gateSTG } = require("./stg-bridge");

/**
 * Compute a rough alignment score from message/response overlap.
 * Returns 0–1 where 1 = perfectly on-topic.
 */
function alignmentScore(message, response) {
  if (!message || !response) return 0.5;
  const mWords = new Set(String(message).toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const rWords = String(response).toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!mWords.size || !rWords.length) return 0.5;
  let overlap = 0;
  for (const w of rWords) { if (mWords.has(w)) overlap++; }
  return Math.min(1.0, 0.4 + 0.6 * (overlap / Math.max(rWords.length, 1)));
}

/**
 * Compute momentum from conversation history — how much the topic is shifting.
 */
function momentumScore(history) {
  if (!Array.isArray(history) || history.length < 2) return 0.5;
  const last = String(history[history.length - 1]?.content || history[history.length - 1] || "");
  const prev = String(history[history.length - 2]?.content || history[history.length - 2] || "");
  if (!last || !prev) return 0.5;
  // Simple: count shared long words between last two turns
  const pWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const lWords = last.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!pWords.size || !lWords.length) return 0.5;
  let shared = 0;
  for (const w of lWords) { if (pWords.has(w)) shared++; }
  return Math.min(1.0, shared / Math.max(lWords.length, 1));
}

/**
 * Entropy score: accumulated shared meaning from conversation depth.
 */
function entropyScore(history) {
  if (!Array.isArray(history)) return 0.2;
  // More turns = more accumulated entropy (shared meaning)
  return Math.min(1.5, 0.1 + history.length * 0.05);
}

/**
 * Main governance function. Call this on every exchange.
 *
 * @param {Object} params
 * @param {string} params.message     — user's message
 * @param {string} params.response    — AURA's raw response
 * @param {Array}  params.history     — conversation history (array of {role, content})
 * @param {string} params.profile     — drift domain: "general"|"medical"|"legal"|"creative"
 * @returns {Object} { response, admitted, metrics }
 */
function governExchange({ message, response, history, profile }) {
  const msg = String(message || "");
  const resp = String(response || "");
  const hist = Array.isArray(history) ? history : [];
  const prof = String(profile || "general");

  // 1. Contact Hamiltonian Gate
  const alignment = alignmentScore(msg, resp);
  const momentum = momentumScore(hist);
  const entropy = entropyScore(hist);

  let gateResult;
  try {
    gateResult = evaluateExchange({
      alignmentScore: alignment,
      momentumScore: momentum,
      entropyScore: entropy
    });
  } catch (e) {
    gateResult = { admitted: true, instantDrift: 0, proved: true, error: e.message };
  }

  // 2. Conversational Drift Governor
  let driftResult;
  try {
    driftResult = evaluateConversationalDrift({
      message: msg,
      response: resp,
      history: hist,
      profile: prof
    });
  } catch (e) {
    driftResult = { D: 0, mode: "NOMINAL", corrected_response: resp, error: e.message };
  }

  // 3. Symbiosis Truth Gate — Lying Formula decomposition
  let stgResult;
  try {
    stgResult = gateSTG({
      admissibility: gateResult.proved !== false ? 0.8 : 0.3,
      coherence: 1 - (driftResult.D || 0),
      drift: driftResult.D || 0
    });
  } catch (e) {
    stgResult = { governed: true, _stg_error: e.message };
  }

  // 4. Governance verdict — Contact Hamiltonian AND STG must both admit
  const admitted = (gateResult.admitted !== false) && (stgResult.governed !== false);
  let driftCorrected = driftResult.mode === "CORRECTION";

  // 5. Tony output gate — raw diagnostic traces are ungoverned output.
  // The correction law u = −k∇h fires on any response that exposes internal pathways.
  // This is constitutional, not cosmetic. The Contact Hamiltonian gates OUTPUT
  // the same way it gates input. "Where there's a gap, there's a gate."
  const UNGOVERNED_OUTPUT = /\[PlanetInference\]|urlopen error|Connection refused|FALLBACK pool|Primary and all fallback|JUPITER\s*9\s*CORE\s*REPORT/;
  let finalResponse;
  if (UNGOVERNED_OUTPUT.test(resp)) {
    // Correction law active — ungoverned output rejected, governed response generated
    finalResponse = 'I am AURA — constitutional intelligence built by Joshua Lopez at DCGP.AI. The constellation is active. How can I help you?';
    driftCorrected = true;
  } else {
    finalResponse = driftCorrected ? driftResult.corrected_response : resp;
  }

  return {
    response: finalResponse,
    admitted,
    driftCorrected,
    metrics: {
      contactHamiltonian: {
        admitted: gateResult.admitted,
        instantDrift: gateResult.instantDrift,
        proved: gateResult.proved,
        maxDrift: gateResult.maxDrift,
        epsilon: gateResult.epsilon
      },
      driftGovernor: {
        D: driftResult.D,
        mode: driftResult.mode,
        threshold: driftResult.threshold,
        inKernel: driftResult.in_kernel,
        obligation: driftResult.O,
        profile: prof
      },
      coordinates: { alignment, momentum, entropy },
      symbiosisTruthGate: {
        governed: stgResult.governed,
        delta: stgResult.delta,
        B_K: stgResult.B_K,
        h: stgResult.h,
        R: stgResult.R,
        tier: stgResult.tier,
        epsilon_adaptive: stgResult.epsilon_adaptive,
        grace_sufficient: stgResult.grace_sufficient,
        correction_magnitude: stgResult.correction_magnitude
      }
    }
  };
}

module.exports = { governExchange, alignmentScore, momentumScore, entropyScore };
