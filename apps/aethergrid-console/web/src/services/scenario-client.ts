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

export interface ScenarioVisualState {
  stressFactor: number;
  renewableBias: number;
  storageStress: number;
  weatherRisk: number;
}

export interface ScenarioResponse {
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


function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function scenarioVisualState(
  scenario: ScenarioId,
  parameters: ScenarioParameters
): ScenarioVisualState {
  if (scenario === 'renewable-surge') {
    return {
      stressFactor: 0.88,
      renewableBias: 1,
      storageStress: 0,
      weatherRisk: 0
    };
  }
  if (scenario === 'storage-stress') {
    return {
      stressFactor: 1.12,
      renewableBias: 0,
      storageStress: 1,
      weatherRisk: 0
    };
  }
  if (scenario === 'weather-event') {
    return {
      stressFactor: 1.18,
      renewableBias: 0,
      storageStress: 0.3,
      weatherRisk: 1
    };
  }
  if (scenario === 'peak-demand') {
    return {
      stressFactor: 1,
      renewableBias: 0,
      storageStress: 0,
      weatherRisk: 0
    };
  }

  const stressFactor =
    (parameters.loadMultiplierPercent / 100) *
    (1 + parameters.weatherRiskPercent / 1000) *
    (1 + Math.max(0, parameters.storageReservePercent - 18) / 500) *
    (1 - Math.max(0, parameters.renewableAvailabilityPercent - 100) / 1000);

  return {
    stressFactor: clamp(stressFactor, 0.65, 1.5),
    renewableBias: clamp(
      (parameters.renewableAvailabilityPercent - 100) / 60,
      -1,
      1
    ),
    storageStress: clamp(
      (18 - parameters.storageReservePercent) / 13,
      -1,
      1
    ),
    weatherRisk: clamp(parameters.weatherRiskPercent / 100, 0, 1)
  };
}
