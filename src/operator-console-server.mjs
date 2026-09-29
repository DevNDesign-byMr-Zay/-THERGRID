import http from 'node:http';
import { readFile } from 'node:fs/promises';

import { createOperatorConsoleCapabilities } from './operator-console-capabilities.mjs';
import { createOperatorConsoleState } from './operator-console-state.mjs';

const STATIC_FILES = Object.freeze({
  '/': { path: '../apps/operator-console/index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { path: '../apps/operator-console/index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { path: '../apps/operator-console/styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { path: '../apps/operator-console/app.js', type: 'text/javascript; charset=utf-8' },
  '/model-logos.js': {
    path: '../apps/operator-console/model-logos.js',
    type: 'text/javascript; charset=utf-8',
  },
  '/assets/aethergrid-mark.svg': {
    path: '../apps/operator-console/assets/aethergrid-mark.svg',
    type: 'image/svg+xml; charset=utf-8',
  },
  '/assets/brand/aethergrid-logo-transparent.webp': {
    path: '../apps/operator-console/assets/brand/aethergrid-logo-transparent.webp',
    type: 'image/webp',
  },
  '/assets/brand/agents/solvaer.webp': {
    path: '../apps/operator-console/assets/brand/agents/solvaer.webp',
    type: 'image/webp',
  },
  '/assets/brand/agents/auren.webp': {
    path: '../apps/operator-console/assets/brand/agents/auren.webp',
    type: 'image/webp',
  },
  '/assets/brand/agents/vaelon.webp': {
    path: '../apps/operator-console/assets/brand/agents/vaelon.webp',
    type: 'image/webp',
  },
});

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function parsePort(value, fallback = 8090) {
  if (value == null || value === '') return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('AETHERGRID_CONSOLE_PORT must be an integer from 1 through 65535');
  }
  return port;
}

export function createOperatorConsoleServer({
  capabilities = createOperatorConsoleCapabilities(),
  operatorState = createOperatorConsoleState(),
} = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/api/capabilities') {
      json(res, 200, capabilities);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/operator-state') {
      json(res, 200, operatorState);
      return;
    }

    if (req.method !== 'GET') {
      json(res, 405, { status: 'method_not_allowed' });
      return;
    }

    const asset = STATIC_FILES[url.pathname];
    if (!asset) {
      json(res, 404, { status: 'not_found' });
      return;
    }

    try {
      const body = await readFile(new URL(asset.path, import.meta.url));
      res.writeHead(200, {
        'content-type': asset.type,
        'content-length': body.byteLength,
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      json(res, 500, { status: 'asset_unavailable' });
    }
  });
}

export async function startOperatorConsole(environment = process.env) {
  const port = parsePort(environment.AETHERGRID_CONSOLE_PORT);
  const server = createOperatorConsoleServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, port };
}

export { parsePort as parseOperatorConsolePort };
