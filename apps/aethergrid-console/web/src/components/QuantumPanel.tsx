import { useEffect, useMemo, useRef, useState } from 'react';

import {
  loadQuantumBackends,
  loadQuantumJob,
  loadQuantumJobs,
  loadQuantumRuntime,
  submitBellSampler,
  type QuantumBackend,
  type QuantumJob,
  type QuantumRuntimeSummary
} from '../services/quantum-client';

function jobState(job: QuantumJob | null): string {
  if (!job) return 'NO RUN';
  if (job.hardwareExecuted) return 'HARDWARE EXECUTED';
  if (job.hardwareSubmitted) return 'HARDWARE SUBMITTED';
  return job.status === 'COMPLETED' ? 'LOCAL COMPLETED' : String(job.status || 'UNKNOWN');
}

export function QuantumPanel() {
  const [runtime, setRuntime] = useState<QuantumRuntimeSummary | null>(null);
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [recentJobs, setRecentJobs] = useState<QuantumJob[]>([]);
  const [backend, setBackend] = useState('');
  const [activeJob, setActiveJob] = useState<QuantumJob | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const hardware = runtime?.hardwareExecution === true;
  const configured = runtime?.configured === true;

  const selectedBackend = useMemo(
    () => backends.find((item) => item.name === backend) ?? null,
    [backends, backend]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadQuantumRuntime(), loadQuantumBackends(), loadQuantumJobs()])
      .then(([runtimeResult, backendResult, jobsResult]) => {
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
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });

    return () => {
      cancelled = true;
      if (pollRef.current != null) globalThis.clearInterval(pollRef.current);
    };
  }, []);

  const beginPolling = (job: QuantumJob) => {
    if (!job.id || !job.hardwareSubmitted || job.hardwareExecuted) return;
    if (pollRef.current != null) globalThis.clearInterval(pollRef.current);

    pollRef.current = globalThis.setInterval(() => {
      if (!job.id) return;
      void loadQuantumJob(job.id)
        .then((next) => {
          setActiveJob(next);
          if (next.hardwareExecuted || ['FAILED', 'CANCELLED'].includes(String(next.status))) {
            if (pollRef.current != null) globalThis.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        })
        .catch(() => undefined);
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
      const job = await submitBellSampler(backend || runtime.defaultBackend, 1024);
      setActiveJob(job);
      setRecentJobs((current) => [job, ...current.filter((item) => item.id !== job.id)].slice(0, 8));
      beginPolling(job);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="quantum-panel">
      <div className="quantum-head">
        <span>
          <small>QUANTUM COMPUTE</small>
          <strong>{runtime?.provider?.toUpperCase() || 'LOADING'}</strong>
        </span>
        <em className={hardware && configured ? 'hardware' : 'simulator'}>
          {hardware && configured ? 'QPU READY' : 'SIMULATOR'}
        </em>
      </div>

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
        <select value={backend} onChange={(event) => setBackend(event.currentTarget.value)}>
          {backends.map((item) => (
            <option value={item.name} key={item.name}>
              {item.name} · {item.simulator ? 'SIM' : item.qubits ? `${item.qubits}Q` : 'QPU'} · {item.status}
            </option>
          ))}
        </select>
      </label>

      {selectedBackend ? (
        <div className="quantum-backend-meta">
          <span>{selectedBackend.simulator ? 'SIMULATOR' : 'HARDWARE'}</span>
          <span>{selectedBackend.qubits ? `${selectedBackend.qubits} QUBITS` : 'QUBITS —'}</span>
          <span>{selectedBackend.pendingJobs != null ? `${selectedBackend.pendingJobs} QUEUED` : 'QUEUE —'}</span>
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
        <small>{activeJob?.backend || runtime?.defaultBackend || 'NO BACKEND'}</small>
        {activeJob?.receipt ? <code>{activeJob.receipt.slice(0, 12)}</code> : null}
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
    </section>
  );
}
