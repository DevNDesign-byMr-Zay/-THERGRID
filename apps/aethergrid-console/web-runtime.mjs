import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

async function fileExists(path) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function safeRelativePath(pathname) {
  const decoded = decodeURIComponent(pathname || '/');
  const withoutLeadingSlash = decoded.replace(/^[/\\]+/u, '');
  const normalized = withoutLeadingSlash.replace(/\\/gu, '/');
  if (
    normalized === '.env' ||
    normalized.startsWith('.env.') ||
    normalized.split('/').includes('..')
  ) {
    return null;
  }
  return normalized;
}

export function createCanonicalWebRuntime({ appRoot, webRoot } = {}) {
  if (!appRoot) throw new Error('appRoot is required');
  const resolvedAppRoot = resolve(appRoot);
  const resolvedWebRoot = resolve(webRoot || resolvedAppRoot, 'web', 'dist');
  const indexPath = resolve(resolvedWebRoot, 'index.html');

  async function serveFile(request, response, path) {
    const bytes = await readFile(path);
    const extension = extname(path).toLowerCase();
    response.writeHead(200, {
      'content-type': MIME_TYPES[extension] || 'application/octet-stream',
      'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') return response.end();
    response.end(bytes);
  }

  return Object.freeze({
    appRoot: resolvedAppRoot,
    webRoot: resolvedWebRoot,

    async serve(request, response, url) {
      if (!['GET', 'HEAD'].includes(request.method || '')) {
        sendJson(response, 405, { error: 'method_not_allowed' });
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }

      if (!(await fileExists(indexPath))) {
        sendJson(response, 503, {
          error: 'canonical_web_build_missing',
          message:
            'The canonical React/Cesium build is missing. Run the maintained web build before starting the production server.',
          expectedPath: 'web/dist/index.html',
        });
        return;
      }

      const relativePath = safeRelativePath(url.pathname === '/' ? '/index.html' : url.pathname);
      if (relativePath === null) {
        sendJson(response, 403, { error: 'forbidden' });
        return;
      }

      const candidate = resolve(resolvedWebRoot, relativePath);
      const withinRoot =
        candidate === resolvedWebRoot || candidate.startsWith(`${resolvedWebRoot}${sep}`);
      if (!withinRoot) {
        sendJson(response, 403, { error: 'forbidden' });
        return;
      }

      if (await fileExists(candidate)) {
        await serveFile(request, response, candidate);
        return;
      }

      if (extname(relativePath)) {
        sendJson(response, 404, { error: 'not_found' });
        return;
      }

      await serveFile(request, response, indexPath);
    },
  });
}
