export interface QuantumRuntimeSummary {
  provider: string;
  apiVersion?: string | null;
  configured: boolean;
  defaultBackend: string | null;
  baseUrl?: string | null;
  primitives: readonly string[];
  hardwareExecution: boolean;
  credentialsExposed: boolean;
}

export interface QuantumBackend {
  name: string;
  status: string;
  statusReason?: string | null;
  simulator: boolean;
  pendingJobs?: number | null;
  qubits?: number | null;
  description?: string;
}

export interface QuantumJob {
  id: string | null;
  provider: string;
  backend: string | null;
  programId: string | null;
  status: string | null;
  submittedAt?: string | null;
  created?: string | null;
  hardwareSubmitted: boolean;
  hardwareExecuted: boolean;
  shots?: number | null;
  distribution?: Readonly<Record<string, number>>;
  expectationValue?: number | null;
  observable?: unknown;
  receipt?: string | null;
  advisoryOnly?: boolean;
}

interface BackendResponse {
  provider: string;
  backends: QuantumBackend[];
}

interface JobsResponse {
  provider: string;
  jobs: QuantumJob[];
}

interface SubmitResponse {
  job: QuantumJob;
  advisoryOnly: boolean;
}

async function jsonRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `quantum request failed with HTTP ${response.status}`
    );
  }
  return payload;
}

export function loadQuantumRuntime(): Promise<QuantumRuntimeSummary> {
  return jsonRequest('/api/aethergrid/quantum/runtime');
}

export function loadQuantumBackends(): Promise<BackendResponse> {
  return jsonRequest('/api/aethergrid/quantum/backends');
}

export function loadQuantumJobs(limit = 8): Promise<JobsResponse> {
  return jsonRequest(`/api/aethergrid/quantum/jobs?limit=${Math.max(1, Math.min(20, limit))}`);
}

export function loadQuantumJob(id: string): Promise<QuantumJob> {
  return jsonRequest(`/api/aethergrid/quantum/jobs/${encodeURIComponent(id)}`);
}

export function loadQuantumResults(id: string): Promise<unknown> {
  return jsonRequest(`/api/aethergrid/quantum/jobs/${encodeURIComponent(id)}/results`);
}

export async function submitBellSampler(
  backend: string | null,
  shots = 1024
): Promise<QuantumJob> {
  const payload = await jsonRequest<SubmitResponse>('/api/aethergrid/quantum/jobs', {
    method: 'POST',
    body: JSON.stringify({
      primitive: 'sampler',
      backend: backend || undefined,
      shots,
      circuit:
        'OPENQASM 3.0; include "stdgates.inc"; bit[2] c; h $0; cx $0, $1; c[0] = measure $0; c[1] = measure $1;'
    })
  });
  return payload.job;
}


export interface DwaveReceipt {
  provider?: string;
  capability?: string;
  dataset?: string;
  requestId?: string;
  retrievedAt?: string | null;
  live?: boolean;
  stale?: boolean;
  fallback?: boolean;
  attribution?: string | null;
}

export interface DwaveSolver {
  id: string | null;
  name: string | null;
  type: string | null;
  description: string;
  properties: Readonly<Record<string, unknown>>;
  parameters: Readonly<Record<string, unknown>>;
}

export interface DwaveJobState {
  problemId: string;
  status: string;
  rawStatus?: string | null;
  solver?: string | null;
  type?: string | null;
  hardwareSubmitted: boolean;
  hardwareExecuted: boolean;
  submitted_on?: string | null;
  solved_on?: string | null;
  live?: boolean;
  result?: unknown;
  message?: string | null;
}

export interface DwaveEnvelope<T> {
  data: T;
  receipt?: DwaveReceipt;
}

export interface DwaveDiscovery {
  status: string;
  solvers: readonly DwaveSolver[];
  hardwareSubmitted: boolean;
  hardwareExecuted: boolean;
  live: boolean;
  message?: string | null;
}

export type DwaveProblemType = 'qubo' | 'ising' | 'cqm' | 'bqm';

export interface DwaveSubmissionInput {
  solver: string;
  problemType: DwaveProblemType;
  problemPayload: unknown;
  parameters?: Readonly<Record<string, unknown>>;
  confirmSubmission: true;
}

export function loadDwaveSolvers(
  signal?: AbortSignal
): Promise<DwaveEnvelope<DwaveDiscovery>> {
  return jsonRequest('/api/aethergrid/quantum/dwave/solvers', { signal });
}

export function loadDwaveJob(
  id: string,
  signal?: AbortSignal
): Promise<DwaveEnvelope<DwaveJobState>> {
  const query = new URLSearchParams({ id });
  return jsonRequest(`/api/aethergrid/quantum/dwave/jobs?${query.toString()}`, {
    signal
  });
}

export function loadDwaveResult(
  id: string,
  signal?: AbortSignal
): Promise<DwaveEnvelope<DwaveJobState>> {
  return jsonRequest(
    `/api/aethergrid/quantum/dwave/jobs/${encodeURIComponent(id)}/result`,
    { signal }
  );
}

export function submitDwaveJob(
  input: DwaveSubmissionInput,
  signal?: AbortSignal
): Promise<DwaveEnvelope<DwaveJobState>> {
  return jsonRequest('/api/aethergrid/quantum/dwave/jobs', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      confirmSubmission: true,
      solver: input.solver,
      problemType: input.problemType,
      problemPayload: input.problemPayload,
      parameters: input.parameters ?? {}
    })
  });
}
