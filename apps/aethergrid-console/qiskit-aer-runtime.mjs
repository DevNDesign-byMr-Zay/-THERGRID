import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BRIDGE = fileURLToPath(new URL('./qiskit-aer-bridge.py', import.meta.url));
const PYTHON = process.env.AETHERGRID_QISKIT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const MAX_OUTPUT_BYTES = 128 * 1024;
const MAX_INPUT_BYTES = 16 * 1024;
const RUN_TIMEOUT_MS = 15_000;
let activeRun = false;

function safePythonEnvironment() {
  // Never leak secret provider keys or inherited Python startup hooks to this worker.
  const variables = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'HOME', 'USERPROFILE', 'VIRTUAL_ENV']) {
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

function runBridge(argumentsList, input = '', {
  pythonExecutable = PYTHON,
  timeoutMs = RUN_TIMEOUT_MS,
} = {}) {
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
    return Promise.reject(new AerBridgeError('invalid-circuit-input', 'Circuit request too large', 400));
  }
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
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(payload);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      worker.kill('SIGKILL');
    }, Math.min(Math.max(timeoutMs, 100), RUN_TIMEOUT_MS));

    worker.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        worker.kill('SIGKILL');
        finish(new AerBridgeError('simulator-output-too-large', 'Simulator output exceeded limit', 502));
      } else {
        stdout += chunk.toString('utf8');
      }
    });
    // Consume stderr but do not return it: it may include environment details.
    worker.stderr.resume();
    worker.on('error', () => {
      finish(new AerBridgeError('python-unavailable', 'Optional local Python interpreter unavailable'));
    });
    worker.on('close', (code) => {
      if (timedOut) {
        finish(new AerBridgeError('simulator-timeout', 'Local circuit simulation exceeded time limit', 504));
        return;
      }
      if (code !== 0) {
        finish(new AerBridgeError('simulator-worker-failed', 'Local circuit simulator failed', 502));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid response');
        finish(null, parsed);
      } catch {
        finish(new AerBridgeError('simulator-invalid-response', 'Simulator returned invalid data', 502));
      }
    });
    worker.stdin.on('error', () => {});
    worker.stdin.end(input);
  });
}

export async function probeQiskitAer(options) {
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

export async function runQiskitAer(input, options) {
  if (activeRun) {
    throw new AerBridgeError('simulator-busy', 'A local circuit simulation is already running', 429);
  }
  activeRun = true;
  try {
    const response = await runBridge([], JSON.stringify(input), options);
    if (response.ok !== true) {
      const errorCode = String(response.error || 'simulator-execution-failed');
      const status = errorCode === 'invalid-circuit-input' ? 400 :
        errorCode === 'qiskit-aer-not-installed' ? 503 : 502;
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
  } finally {
    activeRun = false;
  }
}
