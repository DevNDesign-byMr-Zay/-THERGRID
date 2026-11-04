import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createProfileStore } from '../../profile-store.mjs';
import { readRequestJson as body } from '../../security/request-body.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createAuthorizationHandler({ sessionRuntime, dataDir, json }) {
  const operatorQuotas = new Map();
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    const fileBridgePaths = ['/api/aethergrid/health', '/api/aethergrid/domains/aviation/aircraft'];
    if (
      ['GET', 'OPTIONS'].includes(request.method) &&
      request.headers.origin === 'null' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      fileBridgePaths.includes(url.pathname)
    ) {
      response.setHeader('access-control-allow-origin', 'null');
      response.setHeader('vary', 'Origin');
      response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
      response.setHeader('access-control-allow-private-network', 'true');
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return true;
      }
    }
    const authPrefix = '/api/aethergrid/auth/';
    response.setHeader('cache-control', 'no-store');
    if (url.pathname.startsWith('/api/aethergrid/') && !['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.origin;
      if (
        origin &&
        origin !== `http://${request.headers.host}` &&
        origin !== process.env.AETHERGRID_PUBLIC_ORIGIN
      )
        return json(response, 403, { error: 'origin_rejected' });
    }
    if (request.method === 'GET' && url.pathname === `${authPrefix}session`) {
      const session = sessionRuntime.session(request);
      return json(response, 200, {
        enabled: sessionRuntime.enabled,
        user: session?.user || null,
        csrf: session?.csrf || null,
      });
    }
    if (request.method === 'POST' && url.pathname === `${authPrefix}login`) {
      const input = await body(request);
      const session = sessionRuntime.login(
        input.username,
        input.password,
        request.socket.remoteAddress,
      );
      response.setHeader(
        'set-cookie',
        `aethergrid_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.AETHERGRID_PUBLIC_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`,
      );
      return json(response, 200, { enabled: true, user: session.user, csrf: session.csrf });
    }
    if (request.method === 'POST' && url.pathname === `${authPrefix}logout`) {
      const session = sessionRuntime.session(request);
      if (session && request.headers['x-aethergrid-csrf'] !== session.csrf)
        return json(response, 403, { error: 'csrf_rejected' });
      sessionRuntime.logout(request);
      response.setHeader(
        'set-cookie',
        'aethergrid_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
      );
      return json(response, 200, { ok: true });
    }
    const publicPaths = ['/api/aethergrid/health', '/api/aethergrid/config/public'];
    if (url.pathname.startsWith('/api/aethergrid/') && !publicPaths.includes(url.pathname)) {
      const session = sessionRuntime.authorize(request, request.method, url.pathname);
      request.operator = session.user;
      if (
        sessionRuntime.enabled &&
        request.method === 'POST' &&
        /\/(agents\/|team$|chat$|optimize$)/.test(url.pathname)
      ) {
        const key = session.user.username;
        const window = operatorQuotas.get(key);
        const quota =
          window && window.until > Date.now() ? window : { count: 0, until: Date.now() + 60_000 };
        operatorQuotas.set(key, quota);
        if (++quota.count > 20) return json(response, 429, { error: 'operator_request_quota' });
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        await mkdir(dataDir, { recursive: true, mode: 0o700 });
        await appendFile(
          join(dataDir, 'operator-audit.jsonl'),
          JSON.stringify({
            at: new Date().toISOString(),
            operator: session.user.username,
            role: session.user.role,
            method: request.method,
            path: url.pathname,
          }) + '\n',
          { mode: 0o600 },
        );
      }
    }
    return false;
  };
}

export function createProfileRoutes({
  sessionRuntime,
  dataDir,
  profileStore,
  activity,
  state,
  json,
}) {
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/profile') {
      return json(response, 200, {
        profile: await (
          sessionRuntime.enabled
            ? createProfileStore({ dataDir: join(dataDir, 'profiles', request.operator.username) })
            : profileStore
        ).load(),
      });
    }

    if (request.method === 'PUT' && url.pathname === '/api/aethergrid/profile') {
      const input = await body(request);
      const profile = await (
        sessionRuntime.enabled
          ? createProfileStore({ dataDir: join(dataDir, 'profiles', request.operator.username) })
          : profileStore
      ).save(input.profile || input);
      activity(`Operator profile updated for ${profile.displayName}.`, 'profile');
      return json(response, 200, { profile, activity: state.activity });
    }
    return false;
  };
}
