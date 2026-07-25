'use strict';

const { TOOL_SCHEMAS, executeToolCalls } = require('./aura-tools');

const DEFAULT_INFERENCE_PATH = '/run';
const WEBBHARNESS_UNAVAILABLE_MESSAGE = 'webharness unavailable';

function clean(value) {
  return String(value || '').trim();
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolveBaseUrl() {
  return [
    process.env.WEBBHARNESS_SERVER_URL,
    process.env.WEBBHARNESS_URL,
    process.env.AURA_WEBBHARNESS_URL,
    process.env.BRAIN_SERVER_URL
  ].map(clean).find(Boolean) ||
    clean(process.env.GOVERNED_ALB_URL) || clean(process.env.ALB_URL) ||
    'https://cloud.aura115.ai';
}

function resolveInferencePath() {
  const configured = clean(
    process.env.WEBBHARNESS_INFERENCE_PATH ||
    process.env.AURA_WEBBHARNESS_INFERENCE_PATH ||
    process.env.BRAIN_SERVER_PATH ||
    DEFAULT_INFERENCE_PATH
  );
  if (!configured) return DEFAULT_INFERENCE_PATH;
  return configured.startsWith('/') ? configured : '/' + configured;
}

function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getGatewayStatus() {
  const baseUrl = resolveBaseUrl().replace(/\/$/, '');
  const inferencePath = resolveInferencePath();
  return {
    configured: Boolean(baseUrl) && isValidHttpUrl(baseUrl),
    provider: 'cirq-governed-aws',
    model: clean(
      process.env.WEBBHARNESS_MODEL ||
      process.env.AI_GATEWAY_MODEL ||
      process.env.LLM_MODEL ||
      'webharness-governed-inference'
    ),
    baseUrl: baseUrl || null,
    inferencePath,
    endpoint: (baseUrl && isValidHttpUrl(baseUrl)) ? baseUrl + inferencePath : null
  };
}

function createWebharnessUnavailableError(detail) {
  const error = new Error(WEBBHARNESS_UNAVAILABLE_MESSAGE);
  error.status = 503;
  error.code = 'WEBBHARNESS_UNAVAILABLE';
  error.detail = clean(detail).slice(0, 600) || null;
  return error;
}

function buildPayload(systemPrompt, userPrompt, opts) {
  // Governed ALB endpoint shape — matches /api/webb-inference expected input.
  // No leaked inference parameters. The governed endpoint owns its own configuration.
  const outputTokens = clampNumber(
    opts && opts.maxTokens,
    clampNumber(process.env.LLM_MAX_TOKENS, 2048, 1, 500000),
    1,
    500000
  );
  return {
    message: clean(userPrompt),
    systemPrompt: clean(systemPrompt),
    history: (opts && opts.history) || [],
    max_tokens: outputTokens
  };
}

async function parseGatewayResponse(response, status) {
  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && (data.error || data.message || data.detail)
      ? data.error || data.message || data.detail
      : raw;
    throw createWebharnessUnavailableError(detail || ('HTTP ' + response.status));
  }

  if (data && data.ok === false) {
    throw createWebharnessUnavailableError(data.error || data.message || data.detail || 'ok=false');
  }

  const reply = data && typeof data === 'object'
    ? data.reply || data.response || data.output || data.message || data.text || ''
    : raw;

  if (!clean(reply)) {
    throw createWebharnessUnavailableError('empty response');
  }

  return {
    reply: String(reply),
    model: data && data.model ? data.model : status.model,
    usage: data && data.usage ? data.usage : null
  };
}

async function callGateway(systemPrompt, userPrompt, opts) {
  const status = getGatewayStatus();
  if (!status.configured || !status.endpoint) {
    throw createWebharnessUnavailableError('WEBBHARNESS_SERVER_URL not configured or invalid');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000);
  try {
    const response = await fetch(status.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(systemPrompt, userPrompt, opts || {})),
      signal: controller.signal
    });
    clearTimeout(timer);
    return await parseGatewayResponse(response, status);
  } catch (error) {
    clearTimeout(timer);
    if (error && error.name === 'AbortError') {
      throw createWebharnessUnavailableError('gateway timeout after 300s');
    }
    if (error && error.code === 'WEBBHARNESS_UNAVAILABLE') {
      throw error;
    }
    // Catch all other errors (TypeError: Invalid URL, TypeError: fetch failed, ECONNREFUSED, etc.)
    // and convert them to WEBBHARNESS_UNAVAILABLE so callers handle gracefully
    throw createWebharnessUnavailableError(
      (error && error.message ? error.message : 'request failed') +
      ' [endpoint: ' + (status.endpoint || 'none') + ']'
    );
  }
}

async function callGatewayViaRelay(systemPrompt, userPrompt, opts) {
  const baseUrl = resolveBaseUrl().replace(/\/$/, '');
  if (!baseUrl || !isValidHttpUrl(baseUrl)) {
    throw createWebharnessUnavailableError('WEBBHARNESS_SERVER_URL not configured or invalid');
  }
  const endpoint = baseUrl + '/relay/submit';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(systemPrompt, userPrompt, opts || {}))
    });
    return await parseGatewayResponse(response, getGatewayStatus());
  } catch (error) {
    if (error && error.code === 'WEBBHARNESS_UNAVAILABLE') throw error;
    throw createWebharnessUnavailableError(error && error.message ? error.message : 'relay failed');
  }
}

async function callVercelAIGateway(systemPrompt, userPrompt, opts) {
  // REWIRED — All inference now routes through CIRQ on the governed ALB on AWS.
  // No Railway. No DeepInfra. No Vercel AI Gateway. No Qwen3.
  // This function is kept for backward compatibility with legacy callers.
  const ALB = clean(process.env.GOVERNED_ALB_URL) || clean(process.env.ALB_URL) ||
    'https://cloud.aura115.ai';
  const GATEWAY_URL = ALB.replace(/\/$/, '') + '/api/webb-inference';
  const GATEWAY_KEY = process.env.DEEPINFRA_API_KEY ||
    process.env.AI_GATEWAY_KEY ||
    process.env.AI_GATEWAY_KEY || '';
  const model = process.env.AI_GATEWAY_MODEL || 'Qwen/Qwen3-14B';

  // Max tokens: 32K context, 8K output — large responses go to repo
  const maxTokens = clampNumber(opts && opts.maxTokens, 500000, 1, 5000000);

  const messages = [];
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: String(userPrompt || '').trim() });

  const useTools = opts && opts.tools === true;
  let toolExecutions = [];

  async function callOnce(msgs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    const reqBody = {
      model,
      messages: msgs,
      max_tokens: maxTokens,
      temperature: clampNumber(opts && opts.temperature, 0.65, 0, 2)
    };
    if (useTools) {
      reqBody.tools = TOOL_SCHEMAS;
      reqBody.tool_choice = 'auto';
    }
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GATEWAY_KEY },
      body: JSON.stringify(reqBody),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) {
      const err = await response.text();
      throw createWebharnessUnavailableError('Gateway: ' + response.status + ' ' + err.slice(0, 200));
    }
    const data = await response.json();
    if (data && data.error) {
      const errMsg = (data.error.message || JSON.stringify(data.error)).slice(0, 200);
      throw createWebharnessUnavailableError('Gateway error: ' + errMsg);
    }
    return data;
  }

  try {
    let data = await callOnce(messages);
    let choice = data.choices && data.choices[0];

    // Real tool-call loop: if the model requested a tool, EXECUTE it for real,
    // feed the verified result back, and get the model's final response.
    // AURA is never allowed to narrate a result this loop did not produce.
    if (useTools && choice && choice.message && choice.message.tool_calls && choice.message.tool_calls.length) {
      const toolCalls = choice.message.tool_calls;
      messages.push(choice.message);
      const results = await executeToolCalls(toolCalls);
      toolExecutions = results.map(r => JSON.parse(r.content));
      for (const r of results) messages.push(r);
      data = await callOnce(messages);
      choice = data.choices && data.choices[0];
    }

    const reply = choice && choice.message && choice.message.content;
    if (!reply) throw createWebharnessUnavailableError('Gateway returned empty reply');
    return {
      reply: reply.trim(),
      model: data.model || model,
      usage: data.usage || null,
      toolExecutions,
      tokenBudget: { contextWindow: 5000000, maxOutput: maxTokens, used: data.usage?.total_tokens || null }
    };
  } catch (error) {
    if (error && error.code === 'WEBBHARNESS_UNAVAILABLE') throw error;
    throw createWebharnessUnavailableError(error && error.message ? error.message : 'CIRQ inference call failed');
  }
}

async function callGatewayAuto(systemPrompt, userPrompt, opts) {
  // Try primary webharness (ALB governed inference)
  const status = getGatewayStatus();
  if (status.configured) {
    try {
      return await callGateway(systemPrompt, userPrompt, opts);
    } catch (err) {
      if (err && err.code !== 'WEBBHARNESS_UNAVAILABLE') throw err;
    }
  }
  // Fallback — route through CIRQ governed ALB.
  return await callVercelAIGateway(systemPrompt, userPrompt, opts);
}

// callAmazonQ — disabled until @aws-sdk/client-qbusiness is installed
async function callAmazonQ(systemPrompt, userPrompt, opts) {
  throw createWebharnessUnavailableError('Amazon Q not configured — @aws-sdk/client-qbusiness not installed');
}

module.exports = {
  callGateway,
  callVercelAIGateway,
  callGatewayViaRelay,
  callAmazonQ,
  callGatewayAuto,
  getGatewayStatus,
  createWebharnessUnavailableError,
  WEBBHARNESS_UNAVAILABLE_MESSAGE
};

