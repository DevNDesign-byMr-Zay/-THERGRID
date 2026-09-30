export type ScenarioId =
  | 'peak-demand'
  | 'renewable-surge'
  | 'storage-stress'
  | 'weather-event'
  | 'custom';

export interface ScenarioParameters {
  loadMultiplierPercent: number;
  renewableAvailabilityPercent: number;
  storageReservePercent: number;
  weatherRiskPercent: number;
}

export interface ScenarioState {
  scenario: ScenarioId;
  view: string;
  scenarioParameters: ScenarioParameters;
}

interface ScenarioResponse {
  state?: {
    system?: Partial<ScenarioState>;
  };
  evidence?: {
    id?: string;
    receipt?: string;
    status?: string;
  };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `scenario request failed with HTTP ${response.status}`);
  }
  return payload;
}

export function applyScenario(
  scenario: ScenarioId,
  parameters?: ScenarioParameters
): Promise<ScenarioResponse> {
  return post('/api/aethergrid/scenario', {
    scenario,
    ...(scenario === 'custom' ? { parameters } : {})
  });
}

export function returnToLiveView(): Promise<ScenarioResponse> {
  return post('/api/aethergrid/view', { view: 'live' });
}
