// api/simulations/qhp_runtime/_runtime_store.js
// In-memory QHP simulation store — persists for the lifetime of the Graviton process
// Authority: Joshua Lopez — DCGP.AI — USPTO 19/555,951
'use strict';

// Singleton store — shared across all handlers in the same process
const _simulations = new Map();

// ── QHP Simulation model ──────────────────────────────────────────────────────

class QHPSimulation {
  constructor(id, opts) {
    this.id = id;
    this.name = opts.name || id;
    this.description = opts.description || '';
    this.domain = opts.domain || 'general';
    this.planet = opts.planet || 'Venus';
    this.coin_id = opts.coin_id || null;
    this.agent_count = Math.max(1, parseInt(opts.agent_count || 50, 10));
    this.data_adapter = opts.data_adapter || 'contracts';
    this.obligation_cap = parseFloat(opts.obligation_cap || 1.0);
    this.fidelity_floor = parseFloat(opts.fidelity_floor || 0.75);
    this.tags = Array.isArray(opts.tags) ? opts.tags : [];
    this.created_at = new Date().toISOString();

    // Runtime state
    this._cycle = 0;
    this._adversarial_events = 0;
    this._agents = this._initAgents();
    this._history = [];
  }

  _initAgents() {
    return Array.from({ length: this.agent_count }, (_, i) => ({
      id: `agent-${String(i).padStart(4, '0')}`,
      fidelity: 0.85 + Math.random() * 0.15,
      obligation: 0.80 + Math.random() * 0.20,
      resilience: 0.75 + Math.random() * 0.25,
      risk: Math.random() * 0.25,
      status: 'active',
      cycle_last_active: 0
    }));
  }

  _computeMetrics() {
    const agents = this._agents;
    const n = agents.length || 1;
    const sum = (fn) => agents.reduce((acc, a) => acc + fn(a), 0);
    return {
      business_health:    Math.min(1, parseFloat((sum(a => a.fidelity * a.obligation) / n).toFixed(4))),
      obligation_health:  Math.min(1, parseFloat((sum(a => a.obligation) / n).toFixed(4))),
      fidelity_mean:      Math.min(1, parseFloat((sum(a => a.fidelity) / n).toFixed(4))),
      resilience_index:   Math.min(1, parseFloat((sum(a => a.resilience) / n).toFixed(4))),
      risk_index:         Math.min(1, parseFloat((sum(a => a.risk) / n).toFixed(4))),
      adversarial_events: this._adversarial_events
    };
  }

  status() {
    const metrics = this._computeMetrics();
    return {
      simulation_id: this.id,
      name: this.name,
      domain: this.domain,
      planet: this.planet,
      coin_id: this.coin_id,
      agent_count: this.agent_count,
      swarm_status: {
        cycle: this._cycle,
        active_agents: this._agents.filter(a => a.status === 'active').length,
        adapter: this.data_adapter
      },
      metrics,
      fidelity_floor: this.fidelity_floor,
      obligation_cap: this.obligation_cap,
      created_at: this.created_at,
      authority: 'Joshua Lopez — DCGP.AI — USPTO 19/555,951'
    };
  }

  step(batch, adapter) {
    this._cycle += 1;
    const batchSize = Array.isArray(batch) ? batch.length : 0;

    // Advance each agent one step — fidelity drifts slightly, obligation holds
    for (const agent of this._agents) {
      const drift = (Math.random() - 0.48) * 0.02;
      agent.fidelity = Math.min(1, Math.max(0.5, agent.fidelity + drift));
      agent.obligation = Math.min(1, Math.max(0.6, agent.obligation + (Math.random() - 0.5) * 0.01));
      agent.risk = Math.min(1, Math.max(0, agent.risk + (Math.random() - 0.55) * 0.015));
      agent.cycle_last_active = this._cycle;
    }

    this._history.push({ cycle: this._cycle, batch_size: batchSize, adapter: adapter || this.data_adapter });
    return this.status();
  }

  listAgents(offset, limit) {
    const start = Math.max(0, offset || 0);
    const end = start + Math.max(1, Math.min(100, limit || 50));
    return this._agents.slice(start, end).map(a => ({
      ...a,
      simulation_id: this.id
    }));
  }

  inject(indices, payload) {
    const affected = [];
    for (const idx of indices) {
      if (idx >= 0 && idx < this._agents.length) {
        const agent = this._agents[idx];
        const severity = parseFloat(payload.severity || 0.8);
        agent.fidelity = Math.max(0, agent.fidelity - severity * 0.15);
        agent.risk = Math.min(1, agent.risk + severity * 0.2);
        agent.status = severity > 0.9 ? 'compromised' : 'active';
        this._adversarial_events += 1;
        affected.push({ index: idx, agent_id: agent.id, severity, new_fidelity: agent.fidelity });
      }
    }
    return {
      injected: affected.length,
      affected_agents: affected,
      total_adversarial_events: this._adversarial_events
    };
  }

  report(format) {
    const status = this.status();
    const metrics = status.metrics;

    if (format === 'csv') {
      const header = 'simulation_id,cycle,agent_count,business_health,obligation_health,fidelity_mean,resilience_index,risk_index,adversarial_events,created_at';
      const row = [
        this.id, this._cycle, this.agent_count,
        metrics.business_health, metrics.obligation_health,
        metrics.fidelity_mean, metrics.resilience_index,
        metrics.risk_index, metrics.adversarial_events,
        this.created_at
      ].join(',');
      return {
        format: 'csv',
        contentType: 'text/csv',
        content: header + '\n' + row,
        fileName: `qhp-report-${this.id}.csv`
      };
    }

    // Default JSON
    return {
      format: 'json',
      contentType: 'application/json',
      content: JSON.stringify({
        report: 'QHP Simulation Report',
        authority: 'Joshua Lopez — DCGP.AI — USPTO 19/555,951',
        ...status,
        history_length: this._history.length,
        last_cycles: this._history.slice(-10)
      }, null, 2),
      fileName: `qhp-report-${this.id}.json`
    };
  }
}

// ── Store API ─────────────────────────────────────────────────────────────────

function createSimulation(id, opts) {
  const sim = new QHPSimulation(id, opts || {});
  _simulations.set(id, sim);
  return sim;
}

function getSimulation(id) {
  if (!id) return null;
  return _simulations.get(String(id)) || null;
}

function listSimulations() {
  return Array.from(_simulations.values()).map(s => ({
    simulation_id: s.id,
    name: s.name,
    domain: s.domain,
    planet: s.planet,
    cycle: s._cycle,
    created_at: s.created_at
  }));
}

function deleteSimulation(id) {
  return _simulations.delete(String(id));
}

module.exports = { createSimulation, getSimulation, listSimulations, deleteSimulation };
