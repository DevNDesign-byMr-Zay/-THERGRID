import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.AETHERGRID_PORT || process.env.PORT || 8090);

const regions = Object.freeze([
  'New York Metro',
  'Long Island',
  'Hudson Valley',
  'Upstate New York',
]);

const scenarios = Object.freeze([
  'peak-demand',
  'renewable-surge',
  'storage-stress',
  'weather-event',
]);

const views = Object.freeze(['live', 'forecast', 'scenario']);

const state = {
  system: {
    status: 'All Systems Nominal',
    region: 'New York Metro',
    mode: 'ADVISORY ONLY',
    view: 'live',
    scenario: 'peak-demand',
    physicalActuation: false,
    infrastructureDispatch: false,
  },
  metrics: {
    generationMw: 2130,
    loadMw: 2410,
    renewablePercent: 46.8,
    storageMw: 590,
  },
  optimization: {
    currentCost: 12480,
    candidateCost: 10230,
    emissionsReduction: 24.3,
    renewableUtilizationGain: 16.7,
    runCount: 0,
  },
  agents: {
    'VÆLON': {
      role: 'Optimization & Scenario Exploration',
      description:
        'Runs bounded multi-objective scenario exploration with renewable prioritization and classical-baseline comparison.',
      status: 'ONLINE',
    },
    AUREN: {
      role: 'Semantic Analysis & Spatial Intelligence',
      description:
        'Interprets grid-resilience patterns, spatial relationships, operator context, and evidence-linked meaning.',
      status: 'ONLINE',
    },
    'SOLVÆR': {
      role: 'Simulation & Evidence Generation',
      description:
        'Generates bounded simulations, validation evidence, provenance records, and candidate-comparison packages.',
      status: 'ONLINE',
    },
  },
  evidence: [
    { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', age: '12 min', status: 'VERIFIED' },
    { id: 'quantum-optimization', title: 'Quantum Optimization Run', age: '28 min', status: 'VERIFIED' },
    { id: 'grid-resilience', title: 'Grid Resilience Analysis', age: '1 hour', status: 'VERIFIED' },
    { id: 'renewable-integration', title: 'Renewable Integration Study', age: '2 hours', status: 'VERIFIED' },
  ],
  activity: [],
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

function json(response, status, payload) {
  send(response, status, JSON.stringify(payload, null, 2));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 250_000) throw new Error('payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function activity(message, type = 'system') {
  const item = {
    id: createHash('sha256')
      .update(`${Date.now()}:${message}`)
      .digest('hex')
      .slice(0, 16),
    at: new Date().toISOString(),
    type,
    message,
  };
  state.activity.unshift(item);
  state.activity = state.activity.slice(0, 24);
  return item;
}

function snapshot() {
  return {
    ...state,
    regions,
    scenarios,
    views,
  };
}

function telemetryTick() {
  const now = Date.now();
  state.metrics.generationMw = Math.round(2130 + Math.sin(now / 8200) * 18);
  state.metrics.loadMw = Math.round(2410 + Math.cos(now / 9700) * 23);
  state.metrics.renewablePercent = Number((46.8 + Math.sin(now / 11500) * 1.35).toFixed(1));
  state.metrics.storageMw = Math.round(590 + Math.cos(now / 10400) * 10);
}

function aiReply(message = '') {
  const text = String(message).toLowerCase();
  if (text.includes('renewable')) {
    return 'AUREN identifies renewable integration as a primary resilience lever; VÆLON can explore bounded dispatch scenarios, while SOLVÆR produces simulation evidence. No infrastructure actuation is authorized.';
  }
  if (text.includes('cost') || text.includes('optimiz')) {
    return `VÆLON's current bounded candidate is $${state.optimization.candidateCost.toLocaleString()}/hr versus the $${state.optimization.currentCost.toLocaleString()}/hr classical baseline. Operator review and evidence comparison remain mandatory.`;
  }
  if (text.includes('risk') || text.includes('resilien')) {
    return 'AUREN flags spatial resilience review across weather, load, storage, and network dependencies. SOLVÆR should validate any proposed response in simulation before it reaches an operator decision package.';
  }
  if (text.includes('storage')) {
    return `SOLVÆR reports approximately ${state.metrics.storageMw} MW of reviewable storage capacity in the current simulated operator state. Any dispatch remains outside this application's authority.`;
  }
  return 'The AI team can explore the request as an advisory scenario. VÆLON handles optimization, AUREN handles semantic/spatial interpretation, and SOLVÆR handles simulation evidence. Human review remains required.';
}

function validateChoice(value, allowed, label) {
  if (!allowed.includes(value)) {
    const error = new Error(`unsupported ${label}: ${value}`);
    error.status = 400;
    throw error;
  }
  return value;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/health') {
      return json(response, 200, {
        ok: true,
        product: 'ÆTHERGRID',
        authority: 'advisory-only',
        region: state.system.region,
        view: state.system.view,
        scenario: state.system.scenario,
        agentsOnline: Object.values(state.agents).every((agent) => agent.status === 'ONLINE'),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/stream') {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-content-type-options': 'nosniff',
      });
      const sendEvent = () => {
        telemetryTick();
        response.write(
          `data: ${JSON.stringify({ state: snapshot(), at: new Date().toISOString() })}\n\n`,
        );
      };
      sendEvent();
      const interval = setInterval(sendEvent, 2500);
      request.once('close', () => clearInterval(interval));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/state') {
      telemetryTick();
      return json(response, 200, snapshot());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/telemetry') {
      telemetryTick();
      return json(response, 200, {
        metrics: state.metrics,
        system: state.system,
        at: new Date().toISOString(),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/evidence') {
      return json(response, 200, { evidence: state.evidence, activity: state.activity });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/view') {
      const input = await body(request);
      const view = validateChoice(String(input.view || ''), views, 'view');
      state.system.view = view;
      activity(`Operator review mode changed to ${view}.`, 'view');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/region') {
      const input = await body(request);
      const region = validateChoice(String(input.region || ''), regions, 'region');
      state.system.region = region;
      activity(`Operator region changed to ${region}.`, 'region');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/scenario') {
      const input = await body(request);
      const scenario = validateChoice(String(input.scenario || ''), scenarios, 'scenario');
      state.system.scenario = scenario;
      state.system.view = 'scenario';
      activity(`Scenario loaded: ${scenario}.`, 'scenario');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/reset') {
      state.system.region = 'New York Metro';
      state.system.view = 'live';
      state.system.scenario = 'peak-demand';
      state.optimization.currentCost = 12480;
      state.optimization.candidateCost = 10230;
      state.optimization.emissionsReduction = 24.3;
      state.optimization.renewableUtilizationGain = 16.7;
      activity('Operator review state reset to the New York Metro live baseline.', 'reset');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/optimize') {
      const input = await body(request);
      if (input.region && regions.includes(String(input.region))) state.system.region = String(input.region);
      if (input.scenario && scenarios.includes(String(input.scenario))) {
        state.system.scenario = String(input.scenario);
      }
      state.optimization.runCount += 1;
      const wiggle = state.optimization.runCount % 4;
      state.optimization.candidateCost = 10230 - wiggle * 35;
      state.optimization.emissionsReduction = Number((24.3 + wiggle * 0.4).toFixed(1));
      state.optimization.renewableUtilizationGain = Number((16.7 + wiggle * 0.3).toFixed(1));
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, optimization: state.optimization, ts: new Date().toISOString() }))
        .digest('hex');
      activity(
        `Bounded optimization completed for ${state.system.region} / ${state.system.scenario}; classical baseline retained.`,
        'optimization',
      );
      return json(response, 200, {
        status: 'completed',
        optimization: state.optimization,
        receipt,
        advisoryOnly: true,
        classicalBaselineRequired: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/chat') {
      const input = await body(request);
      const reply = aiReply(input.message);
      activity(`AI collaboration reviewed an operator question for ${state.system.region}.`, 'ai');
      return json(response, 200, {
        reply,
        agents: ['VÆLON', 'AUREN', 'SOLVÆR'],
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/export') {
      const input = await body(request);
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, state: snapshot(), ts: new Date().toISOString() }))
        .digest('hex');
      activity(`Evidence export prepared: ${input.kind || 'package'}.`, 'export');
      return json(response, 200, {
        receipt,
        format: 'json',
        advisoryOnly: true,
        generatedAt: new Date().toISOString(),
        state: snapshot(),
      });
    }

    if (!['GET', 'HEAD'].includes(request.method || '')) {
      return json(response, 405, { error: 'method_not_allowed' });
    }

    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const safe = normalize(requested)
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^[/\\]+/, '');
    const filePath = join(root, safe);

    if (!filePath.startsWith(root)) return json(response, 403, { error: 'forbidden' });

    const info = await stat(filePath);
    if (!info.isFile()) return json(response, 404, { error: 'not_found' });

    const data = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    response.end(data);
  } catch (error) {
    if (error?.code === 'ENOENT') return json(response, 404, { error: 'not_found' });
    const status = Number(error?.status || 500);
    json(response, status, {
      error: status === 400 ? 'invalid_request' : 'server_error',
      message: error.message,
    });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, '127.0.0.1', () => {
    activity(`ÆTHERGRID backend started on port ${port}.`, 'system');
    process.stdout.write(`ÆTHERGRID app listening on http://127.0.0.1:${port}\n`);
  });
}

export { regions, scenarios, server, state, views };