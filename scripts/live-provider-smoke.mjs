import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const targetProvider = process.argv.find((arg) => arg.startsWith('--provider='))?.split('=')[1] || 'all-safe';

console.log(`Starting ÆTHERGRID Live Provider Smoke Acceptance Run for: ${targetProvider}`);

const results = {
  schemaVersion: 1,
  runAt: new Date().toISOString(),
  targetProvider,
  providers: {},
};

async function recordResult(id, fn) {
  const start = Date.now();
  try {
    const res = await fn();
    const latencyMs = Date.now() - start;
    results.providers[id] = {
      configured: true,
      reachable: true,
      state: res.state || 'CONNECTED',
      latencyMs,
      live: res.live ?? true,
      reason: res.reason || 'Read-only connectivity verified',
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    results.providers[id] = {
      configured: true,
      reachable: false,
      state: 'FAILED',
      latencyMs,
      live: false,
      reason: err.message ? err.message.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]') : 'Failed to reach endpoint',
    };
  }
}

// 1. Open-Meteo Weather (no secret)
await recordResult('open-meteo', async () => {
  const resp = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006&current_weather=true');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return { state: 'LIVE_RESPONSE_VERIFIED', live: true };
});

// Save report
const distDir = fileURLToPath(new URL('../dist', import.meta.url));
await mkdir(distDir, { recursive: true });
await writeFile(`${distDir}/live-provider-smoke-report.json`, JSON.stringify(results, null, 2), 'utf8');

console.log('Sanitized acceptance report generated at dist/live-provider-smoke-report.json');
