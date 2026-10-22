import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BRIDGE = fileURLToPath(new URL('./qiskit-aer-bridge.py', import.meta.url));
const PYTHON =
  process.env.AETHERGRID_QISKIT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const MAX_OUTPUT_BYTES = 128 * 1024;
const MAX_INPUT_BYTES = 16 * 1024;
const RUN_TIMEOUT_MS = 15_000;
let activeWorker = false;
let statusProbe = null;
let cachedStatus = null;
let statusExpiresAt = 0;

function validateCircuit(input) {
  const invalid = () => {
    throw new AerBridgeError(
      'invalid-circuit-input',
      'Circuit input exceeds the supported bounded contract',
      400,
    );
  };
  const number = (value, minimum, maximum, integer = false) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum ||
      (integer && !Number.isInteger(value))
    )
      invalid();
  };
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const { experiment } = input;
  if (!['bell', 'qubo-qaoa'].includes(experiment)) invalid();
  number(input.shots === undefined ? 1024 : input.shots, 64, 4096, true);
  number(input.seed === undefined ? 42 : input.seed, 0, 4294967295, true);
  const allowed =
    experiment === 'bell'
      ? ['experiment', 'shots', 'seed']
      : ['experiment', 'shots', 'seed', 'linear', 'quadratic', 'gamma', 'beta'];
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid();
  if (experiment === 'bell') return;
  if (!Array.isArray(input.linear) || input.linear.length < 1 || input.linear.length > 8) invalid();
  input.linear.forEach((value) => number(value, -10000, 10000));
  const dimension = input.linear.length;
  if (input.quadratic != null) {
    if (!Array.isArray(input.quadratic) || input.quadratic.length !== dimension) invalid();
    input.quadratic.forEach((row, i) => {
      if (!Array.isArray(row) || row.length !== dimension) invalid();
      row.forEach((value, j) => {
        number(value, -10000, 10000);
        if (j <= i && value !== 0) invalid();
      });
    });
  }
  number(input.gamma === undefined ? 0.45 : input.gamma, 0, 2 * Math.PI);
  number(input.beta === undefined ? 0.7 : input.beta, 0, Math.PI);
}

function safePythonEnvironment() {
  // Never leak secret provider keys or inherited Python startup hooks to this worker.
  const variables = {};
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'WINDIR',
    'HOME',
    'USERPROFILE',
    'VIRTUAL_ENV',
  ]) {
    if (process.env[key] !== undefined) variables[key] = process.env[key];
  }
  return {
    ...variables,
    PYTHONIOENCODING: 'utf-8',
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    OPENBLAS_NUM_THREADS: '1',
    OMP_NUM_THREADS: '1',
  };
}

export class AerBridgeError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'AerBridgeError';
    this.code = code;
    this.status = status;
  }
}

function runBridge(
  argumentsList,
  input = '',
  { pythonExecutable = PYTHON, timeoutMs = RUN_TIMEOUT_MS } = {},
) {
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
    return Promise.reject(
      new AerBridgeError('invalid-circuit-input', 'Circuit request too large', 400),
    );
  }
  if (activeWorker) {
    return Promise.reject(
      new AerBridgeError('simulator-busy', 'An optional simulator worker is already running', 429),
    );
  }
  activeWorker = true;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = spawn(pythonExecutable, [BRIDGE, ...argumentsList], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        env: safePythonEnvironment(),
      });
    } catch {
      activeWorker = false;
      reject(new AerBridgeError('python-unavailable', 'Optional Python worker unavailable'));
      return;
    }
    let stdout = '';
    let stdoutBytes = 0;
    let timedOut = false;
    let settled = false;
    const finish = (error, payload) => {
      if (settled) return;
      settled = true;
      activeWorker = false;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(payload);
    };
    const timer = setTimeout(
      () => {
        timedOut = true;
        worker.kill('SIGKILL');
      },
      Math.min(Math.max(timeoutMs, 100), RUN_TIMEOUT_MS),
    );

    worker.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        worker.kill('SIGKILL');
        finish(
          new AerBridgeError('simulator-output-too-large', 'Simulator output exceeded limit', 502),
        );
      } else {
        stdout += chunk.toString('utf8');
      }
    });
    // Consume stderr but do not return it: it may include environment details.
    worker.stderr.resume();
    worker.on('error', () => {
      finish(
        new AerBridgeError('python-unavailable', 'Optional local Python interpreter unavailable'),
      );
    });
    worker.on('close', (code) => {
      if (timedOut) {
        finish(
          new AerBridgeError(
            'simulator-timeout',
            'Local circuit simulation exceeded time limit',
            504,
          ),
        );
        return;
      }
      if (code !== 0) {
        finish(
          new AerBridgeError('simulator-worker-failed', 'Local circuit simulator failed', 502),
        );
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('invalid response');
        finish(null, parsed);
      } catch {
        finish(
          new AerBridgeError('simulator-invalid-response', 'Simulator returned invalid data', 502),
        );
      }
    });
    worker.stdin.on('error', () => {});
    worker.stdin.end(input);
  });
}

async function probeStatus(options) {
  try {
    const status = await runBridge(['--check'], '', { ...options, timeoutMs: 5_000 });
    if (typeof status.available !== 'boolean' || status.provider !== 'qiskit-aer') {
      throw new AerBridgeError('simulator-invalid-response', 'Invalid simulator status', 502);
    }
    return status;
  } catch (error) {
    return {
      available: false,
      provider: 'qiskit-aer',
      executionType: 'quantum-circuit-simulation',
      reason: error instanceof AerBridgeError ? error.code : 'simulator-unavailable',
      hardwareSubmitted: false,
      hardwareExecuted: false,
    };
  }
}

export async function probeQiskitAer(options) {
  // The HTTP capability endpoint coalesces imports and caches only bounded public status.
  // Explicit interpreter overrides remain uncached for diagnostics and tests.
  if (options) return probeStatus(options);
  if (cachedStatus && Date.now() < statusExpiresAt) return cachedStatus;
  if (!statusProbe) {
    statusProbe = probeStatus()
      .then((status) => {
        if (status.reason !== 'simulator-busy') {
          cachedStatus = status;
          statusExpiresAt = Date.now() + (status.available ? 30000 : 5000);
        }
        return status;
      })
      .finally(() => {
        statusProbe = null;
      });
  }
  return statusProbe;
}

export async function runQiskitAer(input, options) {
  validateCircuit(input);
  const response = await runBridge([], JSON.stringify(input), options);
  if (response.ok !== true) {
    const errorCode = String(response.error || 'simulator-execution-failed');
    const status =
      errorCode === 'invalid-circuit-input'
        ? 400
        : errorCode === 'qiskit-aer-not-installed'
          ? 503
          : 502;
    throw new AerBridgeError(errorCode, String(response.message || errorCode), status);
  }
  const data = response.result;
  if (
    data?.provider !== 'qiskit-aer' ||
    data?.hardwareSubmitted !== false ||
    data?.hardwareExecuted !== false ||
    data?.executionType !== 'quantum-circuit-simulation'
  ) {
    throw new AerBridgeError('simulator-provenance-invalid', 'Simulator evidence is invalid', 502);
  }
  return data;
}
