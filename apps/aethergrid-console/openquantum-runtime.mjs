import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BRIDGE = fileURLToPath(new URL('./openquantum-bridge.py', import.meta.url));

function hasCredentials(env) {
  return Boolean(
    String(env.AETHERGRID_OPENQUANTUM_SDK_KEY_JSON || env.OPENQUANTUM_SDK_KEY_JSON || '').trim() ||
    (String(env.OPENQUANTUM_SDK_KEY || '').trim() && existsSync(env.OPENQUANTUM_SDK_KEY)) ||
    (String(env.OPENQUANTUM_CLIENT_ID || '').trim() && String(env.OPENQUANTUM_CLIENT_SECRET || '').trim()),
  );
}

async function executeBridge(action, env) {
  const python = env.AETHERGRID_OPENQUANTUM_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  try {
    const result = await execFileAsync(python, [BRIDGE, '--action', action], {
      env, timeout: 20_000, maxBuffer: 64 * 1024, windowsHide: true,
    });
    return JSON.parse(result.stdout.trim());
  } catch {
    return { provider: 'openquantum', status: 'worker_unavailable', backends: [] };
  }
}

// Separate, optional read-only provider. No quote approval or QPU submit method exists.
export function createOpenQuantumRuntime({ env = process.env, runWorker = executeBridge } = {}) {
  const configured = hasCredentials(env);
  return Object.freeze({
    summary() {
      return { provider: 'openquantum', status: configured ? 'configured' : 'unconfigured',
        configured, mode: 'read-only-discovery', hardwareSubmitted: false, hardwareExecuted: false };
    },
    async status() {
      const result = await runWorker('status', env);
      return { provider: 'openquantum', status: String(result.status || 'unavailable'),
        sdkInstalled: result.sdkInstalled === true,
        sdkVersion: result.sdkVersion ? String(result.sdkVersion).slice(0, 32) : null,
        configured, mode: 'read-only-discovery', hardwareSubmitted: false, hardwareExecuted: false };
    },
    async listBackends() {
      if (!configured) return { ...this.summary(), backends: [] };
      const result = await runWorker('backends', env);
      return { provider: 'openquantum', status: String(result.status || 'unavailable'),
        backends: result.status === 'ready' && Array.isArray(result.backends)
          ? result.backends.slice(0, 50).map((b) => ({
            name: String(b.name || '').slice(0, 160),
            shortCode: String(b.shortCode || '').slice(0, 100),
            type: String(b.type || '').slice(0, 32),
            status: String(b.status || 'unknown').slice(0, 48),
            acceptingJobs: typeof b.acceptingJobs === 'boolean' ? b.acceptingJobs : null,
            queueDepth: Number.isInteger(b.queueDepth) ? b.queueDepth : null,
          })) : [],
        live: result.status === 'ready' && result.live === true,
        hardwareSubmitted: false, hardwareExecuted: false };
    },
  });
}
