import { useEffect, useState } from 'react';

import { loadOpenQuantumBackends, type OpenQuantumDiscovery } from '../services/quantum-client';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  unconfigured: 'Configure an Open Quantum SDK credential on the server.',
  invalid_credentials_format: 'The server could not read the configured SDK credential.',
  sdk_missing: 'Install the optional Open Quantum SDK on the server.',
  authentication_failed: 'Open Quantum rejected authentication.',
  provider_rejected: 'Open Quantum denied the discovery request.',
  provider_timeout: 'Open Quantum did not respond in time.',
  provider_unreachable: 'The server could not reach Open Quantum.',
  worker_timeout: 'The discovery worker did not respond in time.',
  worker_unavailable: 'The discovery worker is unavailable.',
};

export function OpenQuantumDiscoveryPanel() {
  const [result, setResult] = useState<OpenQuantumDiscovery | null>(null);
  const [request, setRequest] = useState(0);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (request === 0) return;
    const controller = new AbortController();
    void loadOpenQuantumBackends(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult(data); },
      () => { if (!controller.signal.aborted) setFailed(true); },
    );
    return () => controller.abort();
  }, [request]);

  const pending = request > 0 && !result && !failed;
  const authenticated = result?.status === 'ready' && result.live;
  const search = query.trim().toLowerCase();
  const backends = result?.backends.filter((backend) =>
    [backend.name, backend.shortCode, backend.providerId, backend.type].some(
      (value) => value?.toLowerCase().includes(search),
    ),
  ) ?? [];

  return (
    <fieldset className="dwave-workspace">
      <legend>Open Quantum backend discovery</legend>
      <p>Read-only catalog. Discovery does not check credit eligibility or submit jobs.</p>
      <button type="button" disabled={pending} onClick={() => {
        setResult(null);
        setFailed(false);
        setRequest((value) => value + 1);
      }}>
        {request === 0 ? 'Discover backends' : 'Refresh backends'}
      </button>
      <p role="status">
        {pending ? 'Checking Open Quantum…' : failed ? 'Unable to load Open Quantum discovery.'
          : authenticated ? `Authenticated. ${result.backends.length} backends returned.`
          : result ? STATUS_LABELS[result.status] || 'Discovery unavailable.'
          : 'Run discovery to check server credentials and list backends.'}
      </p>
      {authenticated && (
        <>
          <label>Filter backends <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          {backends.length === 0 ? <p>No matching backends.</p> : (
            <ul aria-label="Discovered Open Quantum backends">
              {backends.map((backend, index) => (
                <li key={`${backend.shortCode || backend.name}-${index}`}>
                  <strong>{backend.name || backend.shortCode || 'Unnamed backend'}</strong>
                  {' · '}{backend.type === 'QPU' ? 'Hardware QPU' : backend.type === 'SIMULATOR' ? 'Simulator' : 'Type unknown'}
                  {backend.providerId && ` · ${backend.providerId}`}
                  {' · '}{backend.status}
                  {backend.queueDepth !== null && ` · Queue ${backend.queueDepth}`}
                  {backend.acceptingJobs !== null && (backend.acceptingJobs ? ' · Accepting jobs' : ' · Job intake closed')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </fieldset>
  );
}
