import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.AETHERGRID_PORT || process.env.PORT || 8090);

const state = {
  system: {
    status: 'All Systems Nominal',
    region: 'New York Metro',
    mode: 'ADVISORY ONLY',
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
    { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', status: 'VERIFIED' },
    { id: 'quantum-optimization', title: 'Quantum Optimization Run', status: 'VERIFIED' },
    { id: 'grid-resilience', title: 'Grid Resilience Analysis', status: 'VERIFIED' },
    { id: 'renewable-integration', title: 'Renewable Integration Study', status: 'VERIFIED' },
  ],
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
  return 'The AI team can explore the request as an advisory scenario. VÆLON handles optimization, AUREN handles semantic/spatial interpretation, and SOLVÆR handles simulation evidence. Human review remains required.';
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/health') {
      return json(response, 200, {
        ok: true,
        product: 'ÆTHERGRID',
        authority: 'advisory-only',
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/state') {
      return json(response, 200, state);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/evidence') {
      return json(response, 200, { evidence: state.evidence });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/optimize') {
      const input = await body(request);
      state.optimization.runCount += 1;
      const wiggle = state.optimization.runCount % 3;
      state.optimization.candidateCost = 10230 - wiggle * 35;
      state.optimization.emissionsReduction = Number((24.3 + wiggle * 0.4).toFixed(1));
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, optimization: state.optimization, ts: new Date().toISOString() }))
        .digest('hex');
      return json(response, 200, {
        status: 'completed',
        optimization: state.optimization,
        receipt,
        advisoryOnly: true,
        classicalBaselineRequired: true,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/chat') {
      const input = await body(request);
      return json(response, 200, {
        reply: aiReply(input.message),
        agents: ['VÆLON', 'AUREN', 'SOLVÆR'],
        advisoryOnly: true,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/export') {
      const input = await body(request);
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, ts: new Date().toISOString() }))
        .digest('hex');
      return json(response, 200, {
        receipt,
        format: 'json',
        advisoryOnly: true,
        generatedAt: new Date().toISOString(),
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
    json(response, 500, { error: 'server_error', message: error.message });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`ÆTHERGRID app listening on http://127.0.0.1:${port}\n`);
  });
}

export { server, state };