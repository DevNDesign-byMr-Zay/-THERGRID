import { createProviderAdapter } from './provider-adapter.mjs';

export function createNoaaNwpsHydrologyProvider(options = {}) {
  const baseUrl = options.baseUrl || process.env.AETHERGRID_HYDROLOGY_BASE_URL || 'https://api.water.noaa.gov/nwps/v1';

  function configured() {
    return true;
  }

  async function request(params = {}, context = {}) {
    const gaugeId = params.gaugeId;

    if (!gaugeId || typeof gaugeId !== 'string' || gaugeId.trim() === '') {
      return {
        data: {
          gaugeId: null,
          status: 'unconfigured',
          message: 'Explicit gaugeId query parameter is required for hydrology lookup.',
          live: false,
        },
        receipt: {
          provider: 'noaa-nwps',
          capability: 'hydrology',
          dataset: 'hydrology-gauge',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'NOAA NWPS (Missing gaugeId)',
        },
      };
    }

    const cleanGaugeId = gaugeId.trim().toUpperCase();
    const url = `${baseUrl}/gauges/${cleanGaugeId}`;
    const stageflowUrl = `${baseUrl}/gauges/${cleanGaugeId}/stageflow`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`NOAA NWPS HTTP ${resp.status}`);
      }
      const json = await resp.json();

      let stageFlowData = null;
      try {
        const sfResp = await fetch(stageflowUrl);
        if (sfResp.ok) {
          stageFlowData = await sfResp.json();
        }
      } catch {
        // Stageflow query optional
      }

      const observedStage = stageFlowData?.observed?.primary ?? json.status?.observed?.primary;
      const observedFlow = stageFlowData?.observed?.secondary ?? json.status?.observed?.secondary;

      return {
        gaugeId: cleanGaugeId,
        name: json.name || null,
        observedStageFeet: Number.isFinite(Number(observedStage)) ? Number(observedStage) : null,
        observedFlowCfs: Number.isFinite(Number(observedFlow)) ? Number(observedFlow) : null,
        observedAt: stageFlowData?.observed?.validTime || json.status?.observed?.validTime || null,
        actionStageFeet: Number.isFinite(Number(json.flood?.action)) ? Number(json.flood.action) : null,
        minorFloodStageFeet: Number.isFinite(Number(json.flood?.minor)) ? Number(json.flood.minor) : null,
        moderateFloodStageFeet: Number.isFinite(Number(json.flood?.moderate)) ? Number(json.flood.moderate) : null,
        majorFloodStageFeet: Number.isFinite(Number(json.flood?.major)) ? Number(json.flood.major) : null,
        forecastStageFeet: Number.isFinite(Number(stageFlowData?.forecast?.primary || json.status?.forecast?.primary))
          ? Number(stageFlowData?.forecast?.primary || json.status?.forecast?.primary)
          : null,
        forecastAt: stageFlowData?.forecast?.validTime || json.status?.forecast?.validTime || null,
        status: 'NOAA NWPS Live',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'noaa-nwps',
        {
          url,
          capability: 'hydrology',
          dataset: 'hydrology-gauge',
          requestId: params.requestId || context.requestId,
          ttlMs: 180000,
          attribution: 'NOAA National Water Prediction Service (NWPS)',
        },
        fetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'noaa-nwps',
        capability: 'hydrology',
        dataset: 'hydrology-gauge',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'noaa-nwps',
    name: 'NOAA National Water Prediction Service Provider',
    capability: 'hydrology',
    capabilities: ['hydrology'],
    configured,
    request,
  });
}
