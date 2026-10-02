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
    const metadataUrl = `${baseUrl}/gauges/${cleanGaugeId}`;
    const stageflowUrl = `${baseUrl}/gauges/${cleanGaugeId}/stageflow`;

    // 1. Governed Metadata Request
    const fetchMetadata = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(metadataUrl);
      }
      const resp = await fetch(metadataUrl);
      if (!resp.ok) {
        throw new Error(`NOAA NWPS Metadata HTTP ${resp.status}`);
      }
      return resp.json();
    };

    let metadataResult;
    if (typeof context.executeProviderRequest === 'function') {
      metadataResult = await context.executeProviderRequest(
        'noaa-nwps',
        {
          url: metadataUrl,
          capability: 'hydrology',
          dataset: 'hydrology-gauge-metadata',
          requestId: params.requestId || context.requestId,
          ttlMs: 180000,
          attribution: 'NOAA National Water Prediction Service (NWPS)',
        },
        fetchMetadata,
      );
    } else {
      const data = await fetchMetadata();
      metadataResult = { data, receipt: { provider: 'noaa-nwps', capability: 'hydrology', dataset: 'hydrology-gauge-metadata', live: true } };
    }

    const meta = metadataResult.data || {};

    // 2. Governed Stageflow Request
    const fetchStageflow = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(stageflowUrl);
      }
      const resp = await fetch(stageflowUrl);
      if (!resp.ok) {
        throw new Error(`NOAA NWPS Stageflow HTTP ${resp.status}`);
      }
      return resp.json();
    };

    let stageflowData = null;
    let stageflowLive = false;
    try {
      if (typeof context.executeProviderRequest === 'function') {
        const sfExec = await context.executeProviderRequest(
          'noaa-nwps',
          {
            url: stageflowUrl,
            capability: 'hydrology',
            dataset: 'hydrology-gauge-stageflow',
            requestId: params.requestId || context.requestId,
            ttlMs: 180000,
            attribution: 'NOAA National Water Prediction Service (NWPS)',
          },
          fetchStageflow,
        );
        stageflowData = sfExec.data;
        stageflowLive = sfExec.receipt?.live ?? true;
      } else {
        stageflowData = await fetchStageflow();
        stageflowLive = true;
      }
    } catch {
      stageflowData = null;
      stageflowLive = false;
    }

    const observedStage = stageflowData?.observed?.primary ?? meta.status?.observed?.primary;
    const observedFlow = stageflowData?.observed?.secondary ?? meta.status?.observed?.secondary;

    const normalizedData = {
      gaugeId: cleanGaugeId,
      name: meta.name || null,
      latitude: meta.latitude !== undefined ? Number(meta.latitude) : null,
      longitude: meta.longitude !== undefined ? Number(meta.longitude) : null,
      observedStageFeet: Number.isFinite(Number(observedStage)) ? Number(observedStage) : null,
      observedFlowCfs: Number.isFinite(Number(observedFlow)) ? Number(observedFlow) : null,
      observedAt: stageflowData?.observed?.validTime || meta.status?.observed?.validTime || null,
      actionStageFeet: Number.isFinite(Number(meta.flood?.action)) ? Number(meta.flood.action) : null,
      minorFloodStageFeet: Number.isFinite(Number(meta.flood?.minor)) ? Number(meta.flood.minor) : null,
      moderateFloodStageFeet: Number.isFinite(Number(meta.flood?.moderate)) ? Number(meta.flood.moderate) : null,
      majorFloodStageFeet: Number.isFinite(Number(meta.flood?.major)) ? Number(meta.flood.major) : null,
      forecastStageFeet: Number.isFinite(Number(stageflowData?.forecast?.primary || meta.status?.forecast?.primary))
        ? Number(stageflowData?.forecast?.primary || meta.status?.forecast?.primary)
        : null,
      forecastAt: stageflowData?.forecast?.validTime || meta.status?.forecast?.validTime || null,
      status: stageflowLive ? 'NOAA NWPS Live' : 'NOAA NWPS Partial (Metadata Only)',
      live: Boolean(metadataResult.receipt?.live),
    };

    return {
      data: normalizedData,
      receipt: {
        provider: 'noaa-nwps',
        capability: 'hydrology',
        dataset: 'hydrology-gauge',
        requestId: params.requestId || context.requestId,
        live: Boolean(metadataResult.receipt?.live),
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
