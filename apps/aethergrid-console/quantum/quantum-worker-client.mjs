import { prepareRequestSchema, dryRunRequestSchema } from './quantum-worker-schema.mjs';

export function createQuantumWorkerClient(options = {}) {
  const workerUrl = options.workerUrl || process.env.AETHERGRID_QUANTUM_WORKER_URL || 'http://127.0.0.1:8000';
  const timeoutMs = Number(options.timeoutMs || process.env.AETHERGRID_QUANTUM_WORKER_TIMEOUT_MS || 30000);

  async function prepare(requestPayload, context = {}) {
    const validated = prepareRequestSchema.parse(requestPayload);

    if (typeof options.fetchFn === 'function') {
      const resp = await options.fetchFn(`${workerUrl}/v1/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      return typeof resp.json === 'function' ? await resp.json() : resp;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(`${workerUrl}/v1/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Quantum Worker HTTP ${resp.status}: ${errorText}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function dryRun(requestPayload, context = {}) {
    const validated = dryRunRequestSchema.parse(requestPayload);

    if (typeof options.fetchFn === 'function') {
      const resp = await options.fetchFn(`${workerUrl}/v1/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      return typeof resp.json === 'function' ? await resp.json() : resp;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(`${workerUrl}/v1/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Quantum Worker HTTP ${resp.status}: ${errorText}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    prepare,
    dryRun,
  };
}
