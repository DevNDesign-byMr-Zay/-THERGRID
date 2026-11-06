import type { DwaveJobState, DwaveSolver, QuantumJob } from '../services/quantum-client';

interface JsonObjectParse {
  value: Record<string, unknown> | null;
  error: string | null;
}

export function parseJsonObject(input: string, allowEmpty: boolean): JsonObjectParse {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: 'JSON must be an object.' };
    }
    const value = parsed as Record<string, unknown>;
    if (!allowEmpty && Object.keys(value).length === 0) {
      return { value: null, error: 'Problem payload cannot be empty.' };
    }
    return { value, error: null };
  } catch {
    return { value: null, error: 'Invalid JSON.' };
  }
}

export function jobState(job: QuantumJob | null): string {
  if (!job) return 'NO RUN';
  if (job.hardwareExecuted) return 'HARDWARE EXECUTED';
  if (job.hardwareSubmitted) return 'HARDWARE SUBMITTED';
  return job.status === 'COMPLETED'
    ? 'LOCAL COMPLETED'
    : String(job.status || 'UNKNOWN');
}

export function dwaveJobState(job: DwaveJobState | null): string {
  if (!job) return 'NO D-WAVE RUN';
  if (job.hardwareExecuted) return 'HARDWARE EXECUTED';
  if (job.hardwareSubmitted) return 'HARDWARE SUBMITTED';
  return String(job.status || 'UNKNOWN');
}

export function solverName(solver: DwaveSolver): string {
  return solver.name || solver.id || 'UNNAMED SOLVER';
}
