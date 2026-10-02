import { useEffect, useMemo, useRef, useState } from 'react';

import {
  loadDwaveJob,
  loadDwaveResult,
  loadDwaveSolvers,
  loadQuantumBackends,
  loadQuantumJob,
  loadQuantumJobs,
  loadQuantumRuntime,
  submitBellSampler,
  submitDwaveJob,
  type DwaveDiscovery,
  type DwaveJobState,
  type DwaveProblemType,
  type DwaveReceipt,
  type DwaveSolver,
  type QuantumBackend,
  type QuantumJob,
  type QuantumRuntimeSummary
} from '../services/quantum-client';

type QuantumWorkspace = 'gate-model' | 'annealing';

interface JsonObjectParse {
  value: Record<string, unknown> | null;
  error: string | null;
}

function parseJsonObject(input: string, allowEmpty: boolean): JsonObjectParse {
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

function jobState(job: QuantumJob | null): string {
  if (!job) return 'NO RUN';
  if (job.hardwareExecuted) return 'HARDWARE EXECUTED';
  if (job.hardwareSubmitted) return 'HARDWARE SUBMITTED';
  return job.status === 'COMPLETED'
    ? 'LOCAL COMPLETED'
    : String(job.status || 'UNKNOWN');
}

function dwaveJobState(job: DwaveJobState | null): string {
  if (!job) return 'NO D-WAVE RUN';
  if (job.hardwareExecuted) return 'HARDWARE EXECUTED';
  if (job.hardwareSubmitted) return 'HARDWARE SUBMITTED';
  return String(job.status || 'UNKNOWN');
}

function solverName(solver: DwaveSolver): string {
  return solver.name || solver.id || 'UNNAMED SOLVER';
}

export function QuantumPanel() {
  const [workspace, setWorkspace] = useState<QuantumWorkspace>('gate-model');

  const [runtime, setRuntime] = useState<QuantumRuntimeSummary | null>(null);
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [recentJobs, setRecentJobs] = useState<QuantumJob[]>([]);
  const [backend, setBackend] = useState('');
  const [activeJob, setActiveJob] = useState<QuantumJob | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const [dwaveDiscovery, setDwaveDiscovery] =
    useState<DwaveDiscovery | null>(null);
  const [dwaveReceipt, setDwaveReceipt] = useState<DwaveReceipt | null>(null);
  const [dwaveSolver, setDwaveSolver] = useState('');
  const [dwaveProblemType, setDwaveProblemType] =
    useState<DwaveProblemType>('qubo');
  const [dwaveProblemJson, setDwaveProblemJson] = useState('{}');
  const [dwaveParametersJson, setDwaveParametersJson] = useState('{}');
  const [dwaveConfirmed, setDwaveConfirmed] = useState(false);
  const [dwaveJob, setDwaveJob] = useState<DwaveJobState | null>(null);
  const [dwaveResult, setDwaveResult] = useState<unknown>(null);
  const [dwaveRunning, setDwaveRunning] = useState(false);
  const [dwaveError, setDwaveError] = useState<string | null>(null);
  const dwavePollRef = useRef<number | null>(null);

  const hardware = runtime?.hardwareExecution === true;
  const configured = runtime?.configured === true;

  const selectedBackend = useMemo(
    () => backends.find((item) => item.name === backend) ?? null,
    [backends, backend]
  );

  const dwaveSolvers = dwaveDiscovery?.solvers ?? [];
  const selectedDwaveSolver = useMemo(
    () =>
      dwaveSolvers.find(
        (item) => item.id === dwaveSolver || item.name === dwaveSolver
      ) ?? null,
    [dwaveSolvers, dwaveSolver]
  );
  const parsedProblem = useMemo(
    () => parseJsonObject(dwaveProblemJson, false),
    [dwaveProblemJson]
  );
  const parsedParameters = useMemo(
    () => parseJsonObject(dwaveParametersJson, true),
    [dwaveParametersJson]
  );
  const dwaveConfigured =
    dwaveDiscovery != null &&
    dwaveDiscovery.status !== 'unconfigured' &&
    dwaveReceipt?.fallback !== true;
  const canSubmitDwave =
    dwaveConfigured &&
    Boolean(dwaveSolver) &&
    parsedProblem.value != null &&
    parsedParameters.value != null &&
    dwaveConfirmed &&
    !dwaveRunning;

  const clearGatePoll = () => {
    if (pollRef.current != null) {
      globalThis.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearDwavePoll = () => {
    if (dwavePollRef.current != null) {
      globalThis.clearInterval(dwavePollRef.current);
      dwavePollRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadQuantumRuntime(),
      loadQuantumBackends(),
      loadQuantumJobs(),
      loadDwaveSolvers()
    ])
      .then(([runtimeResult, backendResult, jobsResult, dwaveResult]) => {
        if (cancelled) return;
        setRuntime(runtimeResult);
        setBackends(backendResult.backends || []);
        setRecentJobs(jobsResult.jobs || []);
        setBackend(
          runtimeResult.defaultBackend ||
            backendResult.backends?.find((item) => item.status !== 'offline')?.name ||
            backendResult.backends?.[0]?.name ||
            ''
        );
        setDwaveDiscovery(dwaveResult.data);
        setDwaveReceipt(dwaveResult.receipt ?? null);
        const firstDwaveSolver =
          dwaveResult.data.solvers.find((item) => item.id || item.name) ?? null;
        setDwaveSolver(
          firstDwaveSolver?.id || firstDwaveSolver?.name || ''
        );
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError)
          );
        }
      });

    return () => {
      cancelled = true;
      clearGatePoll();
      clearDwavePoll();
    };
  }, []);

  const beginPolling = (job: QuantumJob) => {
    if (!job.id || !job.hardwareSubmitted || job.hardwareExecuted) return;
    clearGatePoll();

    pollRef.current = globalThis.setInterval(() => {
      if (!job.id) return;
      void loadQuantumJob(job.id)
        .then((next) => {
          setActiveJob(next);
          if (
            next.hardwareExecuted ||
            ['FAILED', 'CANCELLED'].includes(String(next.status))
          ) {
            clearGatePoll();
          }
        })
        .catch(() => undefined);
    }, 5000);
  };

  const beginDwavePolling = (job: DwaveJobState) => {
    if (!job.problemId || !job.hardwareSubmitted || job.hardwareExecuted) return;
    clearDwavePoll();

    dwavePollRef.current = globalThis.setInterval(() => {
      void loadDwaveJob(job.problemId)
        .then((envelope) => {
          const next = envelope.data;
          setDwaveReceipt(envelope.receipt ?? null);
          setDwaveJob(next);

          if (next.status === 'COMPLETED' || next.hardwareExecuted) {
            clearDwavePoll();
            void loadDwaveResult(next.problemId)
              .then((resultEnvelope) => {
                setDwaveReceipt(resultEnvelope.receipt ?? null);
                setDwaveJob(resultEnvelope.data);
                setDwaveResult(resultEnvelope.data.result ?? null);
              })
              .catch((resultError) =>
                setDwaveError(
                  resultError instanceof Error
                    ? resultError.message
                    : String(resultError)
                )
              );
          } else if (
            ['FAILED', 'CANCELLED'].includes(String(next.status).toUpperCase())
          ) {
            clearDwavePoll();
          }
        })
        .catch((pollError) => {
          clearDwavePoll();
          setDwaveError(
            pollError instanceof Error ? pollError.message : String(pollError)
          );
        });
    }, 5000);
  };

  const runBell = async () => {
    if (!runtime || running) return;
    if (hardware) {
      const approved = globalThis.confirm(
        `Submit the Bell Sampler test to IBM Quantum backend ${backend || runtime.defaultBackend || 'selected backend'}? This creates a real cloud quantum job.`
      );
      if (!approved) return;
    }

    setRunning(true);
    setError(null);
    try {
      const job = await submitBellSampler(
        backend || runtime.defaultBackend,
        1024
      );
      setActiveJob(job);
      setRecentJobs((current) =>
        [job, ...current.filter((item) => item.id !== job.id)].slice(0, 8)
      );
      beginPolling(job);
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : String(runError)
      );
    } finally {
      setRunning(false);
    }
  };

  const submitAnnealingProblem = async () => {
    if (!canSubmitDwave || !parsedProblem.value || !parsedParameters.value) {
      return;
    }

    const approved = globalThis.confirm(
      `Submit this ${dwaveProblemType.toUpperCase()} problem to D-Wave solver ${dwaveSolver}? This requests a real cloud QPU/solver job and may consume provider quota.`
    );
    if (!approved) return;

    setDwaveRunning(true);
    setDwaveError(null);
    setDwaveResult(null);
    try {
      const envelope = await submitDwaveJob({
        confirmSubmission: true,
        solver: dwaveSolver,
        problemType: dwaveProblemType,
        problemPayload: parsedProblem.value,
        parameters: parsedParameters.value
      });
      setDwaveReceipt(envelope.receipt ?? null);
      setDwaveJob(envelope.data);
      setDwaveConfirmed(false);
      beginDwavePolling(envelope.data);
    } catch (runError) {
      setDwaveError(
        runError instanceof Error ? runError.message : String(runError)
      );
    } finally {
      setDwaveRunning(false);
    }
  };

  return (
    <section className="quantum-panel">
      <div className="quantum-head">
        <span>
          <small>QUANTUM COMPUTE</small>
          <strong>
            {workspace === 'gate-model'
              ? runtime?.provider?.toUpperCase() || 'LOADING'
              : 'D-WAVE ANNEALING'}
          </strong>
        </span>
        {workspace === 'gate-model' ? (
          <em className={hardware && configured ? 'hardware' : 'simulator'}>
            {hardware && configured ? 'QPU READY' : 'SIMULATOR'}
          </em>
        ) : (
          <em className={dwaveConfigured ? 'hardware' : 'simulator'}>
            {dwaveConfigured ? 'SAPI CONNECTED' : 'UNCONFIGURED'}
          </em>
        )}
      </div>

      <div className="quantum-workspace-tabs" role="tablist" aria-label="Quantum provider workspace">
        <button
          type="button"
          className={workspace === 'gate-model' ? 'active' : ''}
          onClick={() => setWorkspace('gate-model')}
        >
          GATE / IBM
        </button>
        <button
          type="button"
          className={workspace === 'annealing' ? 'active' : ''}
          onClick={() => setWorkspace('annealing')}
        >
          ANNEAL / D-WAVE
        </button>
      </div>

      {workspace === 'gate-model' ? (
        <>
          <div className="quantum-runtime-grid">
            <span>
              <small>API</small>
              <strong>{runtime?.apiVersion || 'LOCAL'}</strong>
            </span>
            <span>
              <small>BACKENDS</small>
              <strong>{backends.length}</strong>
            </span>
            <span>
              <small>SECRETS</small>
              <strong>{runtime?.credentialsExposed ? 'EXPOSED' : 'SERVER'}</strong>
            </span>
          </div>

          <label className="quantum-backend">
            <span>BACKEND</span>
            <select
              value={backend}
              onChange={(event) => setBackend(event.currentTarget.value)}
            >
              {backends.map((item) => (
                <option value={item.name} key={item.name}>
                  {item.name} ·{' '}
                  {item.simulator
                    ? 'SIM'
                    : item.qubits
                      ? `${item.qubits}Q`
                      : 'QPU'}{' '}
                  · {item.status}
                </option>
              ))}
            </select>
          </label>

          {selectedBackend ? (
            <div className="quantum-backend-meta">
              <span>{selectedBackend.simulator ? 'SIMULATOR' : 'HARDWARE'}</span>
              <span>
                {selectedBackend.qubits
                  ? `${selectedBackend.qubits} QUBITS`
                  : 'QUBITS —'}
              </span>
              <span>
                {selectedBackend.pendingJobs != null
                  ? `${selectedBackend.pendingJobs} QUEUED`
                  : 'QUEUE —'}
              </span>
            </div>
          ) : null}

          <button
            className={hardware ? 'quantum-run hardware' : 'quantum-run'}
            type="button"
            onClick={() => void runBell()}
            disabled={running || !runtime || (hardware && !configured)}
          >
            {running
              ? 'SUBMITTING…'
              : hardware
                ? 'SUBMIT BELL TEST TO QPU'
                : 'RUN LOCAL BELL TEST'}
          </button>

          <div className="quantum-job-state">
            <span>{jobState(activeJob)}</span>
            <strong>{activeJob?.status || '—'}</strong>
            <small>
              {activeJob?.backend || runtime?.defaultBackend || 'NO BACKEND'}
            </small>
            {activeJob?.receipt ? (
              <code>{activeJob.receipt.slice(0, 12)}</code>
            ) : null}
          </div>

          {error ? <div className="agent-error">{error}</div> : null}

          <details className="quantum-history">
            <summary>RECENT JOBS · {recentJobs.length}</summary>
            {recentJobs.length ? (
              recentJobs.map((job, index) => (
                <div key={job.id || `job-${index}`}>
                  <span>{job.programId || 'JOB'}</span>
                  <strong>{job.status || 'UNKNOWN'}</strong>
                  <small>
                    {job.hardwareExecuted
                      ? 'EXECUTED'
                      : job.hardwareSubmitted
                        ? 'SUBMITTED'
                        : 'LOCAL'}
                  </small>
                </div>
              ))
            ) : (
              <p>No remote job history returned.</p>
            )}
          </details>
        </>
      ) : (
        <div className="dwave-workspace">
          <div className="quantum-runtime-grid">
            <span>
              <small>STATUS</small>
              <strong>{dwaveDiscovery?.status || 'LOADING'}</strong>
            </span>
            <span>
              <small>SOLVERS</small>
              <strong>{dwaveSolvers.length}</strong>
            </span>
            <span>
              <small>SECRETS</small>
              <strong>SERVER</strong>
            </span>
          </div>

          <label className="quantum-backend">
            <span>SOLVER</span>
            <select
              value={dwaveSolver}
              onChange={(event) => setDwaveSolver(event.currentTarget.value)}
              disabled={!dwaveSolvers.length}
            >
              {dwaveSolvers.length ? (
                dwaveSolvers.map((item, index) => {
                  const value = item.id || item.name || '';
                  return (
                    <option value={value} key={value || `solver-${index}`}>
                      {solverName(item)}
                    </option>
                  );
                })
              ) : (
                <option value="">NO SOLVERS RETURNED</option>
              )}
            </select>
          </label>

          {selectedDwaveSolver ? (
            <div className="quantum-backend-meta">
              <span>{selectedDwaveSolver.type || 'REMOTE SOLVER'}</span>
              <span>SOURCE · D-WAVE SAPI</span>
            </div>
          ) : null}

          <label className="quantum-backend">
            <span>PROBLEM TYPE</span>
            <select
              value={dwaveProblemType}
              onChange={(event) =>
                setDwaveProblemType(event.currentTarget.value as DwaveProblemType)
              }
            >
              <option value="qubo">QUBO</option>
              <option value="ising">ISING</option>
              <option value="cqm">CQM</option>
              <option value="bqm">BQM</option>
            </select>
          </label>

          <label className="dwave-json-field">
            <span>ENCODED PROBLEM DATA</span>
            <textarea
              value={dwaveProblemJson}
              onChange={(event) => setDwaveProblemJson(event.currentTarget.value)}
              spellCheck={false}
              rows={7}
              placeholder="Paste the exact D-Wave SAPI encoded data object for the selected problem type."
            />
            <small className={parsedProblem.error ? 'invalid' : 'valid'}>
              {parsedProblem.error ||
                'VALID JSON · sent unchanged as the provider problem payload'}
            </small>
          </label>

          <label className="dwave-json-field">
            <span>PROVIDER PARAMETERS</span>
            <textarea
              value={dwaveParametersJson}
              onChange={(event) =>
                setDwaveParametersJson(event.currentTarget.value)
              }
              spellCheck={false}
              rows={4}
            />
            <small className={parsedParameters.error ? 'invalid' : 'valid'}>
              {parsedParameters.error || 'VALID JSON · optional provider parameters'}
            </small>
          </label>

          <label className="dwave-confirmation">
            <input
              type="checkbox"
              checked={dwaveConfirmed}
              onChange={(event) =>
                setDwaveConfirmed(event.currentTarget.checked)
              }
            />
            <span>
              I confirm this action may submit a real problem to the selected
              D-Wave cloud solver. No job is sent until I press submit.
            </span>
          </label>

          <button
            className="quantum-run hardware"
            type="button"
            disabled={!canSubmitDwave}
            onClick={() => void submitAnnealingProblem()}
          >
            {dwaveRunning
              ? 'SUBMITTING…'
              : 'SUBMIT CONFIRMED D-WAVE PROBLEM'}
          </button>

          <div className="quantum-job-state">
            <span>{dwaveJobState(dwaveJob)}</span>
            <strong>{dwaveJob?.status || '—'}</strong>
            <small>
              {dwaveJob?.problemId || dwaveSolver || 'NO PROBLEM ID'}
            </small>
            <code>
              {dwaveReceipt?.attribution || 'D-WAVE OCEAN SAPI QUANTUM CLOUD'}
            </code>
          </div>

          {dwaveError ? <div className="agent-error">{dwaveError}</div> : null}

          {dwaveResult != null ? (
            <details className="dwave-result">
              <summary>HARDWARE RESULT · SOURCE RESPONSE</summary>
              <pre>{JSON.stringify(dwaveResult, null, 2)}</pre>
            </details>
          ) : null}

          <p className="dwave-boundary">
            ÆTHERGRID does not synthesize an annealing result. “Hardware executed”
            is shown only after the provider returns a completed answer.
          </p>
        </div>
      )}
    </section>
  );
}
