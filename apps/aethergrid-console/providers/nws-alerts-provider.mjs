import { validateCoordinates } from "./coordinate-validator.mjs";
import { createProviderAdapter } from './provider-adapter.mjs';

export function createNwsAlertsProvider(options = {}) {
  const baseUrl = options.baseUrl || process.env.AETHERGRID_NWS_URL || 'https://api.weather.gov';

  function configured() {
    return true;
  }

  async function request(params = {}, context = {}) {
    const lat = params.lat;
    const lon = params.lon;

    if (lat !== undefined && lon !== undefined) {
      const coordVal = validateCoordinates(lat, lon);
      if (!coordVal.valid) {
        return {
          data: {
            status: 'missing_coordinates',
            message: 'Valid lat/lon parameters are required for NWS active alerts.',
            alerts: [],
            count: 0,
            live: false,
          },
          receipt: {
            provider: 'nws',
            capability: 'hazards',
            dataset: 'active-alerts',
            requestId: params.requestId || context.requestId,
            live: false,
            fallback: true,
            attribution: 'US National Weather Service (api.weather.gov)',
          },
        };
      }
    }

    const url = (lat !== undefined && lon !== undefined)
      ? `${baseUrl}/alerts/active?point=${lat},${lon}`
      : `${baseUrl}/alerts/active`;

    const fetcher = async () => {
      let rawJson;
      if (typeof options.fetchFn === 'function') {
        rawJson = await options.fetchFn(url);
      } else {
        const resp = await fetch(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'AETHERGRID/4.0 (contact@aethergrid.org)',
          },
        });
        if (!resp.ok) {
          throw new Error(`NWS Active Alerts HTTP ${resp.status}`);
        }
        rawJson = await resp.json();
      }

      const features = Array.isArray(rawJson.features) ? rawJson.features : [];

      const alerts = features.map((f) => {
        const props = f.properties || {};
        return {
          id: f.id || props.id || null,
          event: props.event || null,
          severity: props.severity || null,
          urgency: props.urgency || null,
          certainty: props.certainty || null,
          headline: props.headline || null,
          description: props.description || null,
          instruction: props.instruction || null,
          effective: props.effective || null,
          onset: props.onset || null,
          expires: props.expires || null,
          areaDesc: props.areaDesc || null,
          affectedArea: props.areaDesc || null,
          affectedZones: Array.isArray(props.affectedZones) ? props.affectedZones : [],
          geometry: f.geometry || null,
        };
      });

      return {
        count: alerts.length,
        alerts,
        location: (lat !== undefined && lon !== undefined) ? { lat, lon } : null,
        status: 'NWS Live Alerts',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      const exec = await context.executeProviderRequest(
        'nws',
        {
          url,
          capability: 'hazards',
          dataset: 'active-alerts',
          requestId: params.requestId || context.requestId,
          ttlMs: 60000,
          attribution: 'US National Weather Service (api.weather.gov)',
        },
        fetcher,
      );
      return { data: exec.data, receipt: exec.receipt };
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'nws',
        capability: 'hazards',
        dataset: 'active-alerts',
        requestId: params.requestId || context.requestId,
        live: true,
      },
    };
  }

  return createProviderAdapter({
    id: 'nws',
    name: 'National Weather Service Active Hazards Provider',
    capability: 'hazards',
    capabilities: ['hazards', 'weather-alerts'],
    configured,
    request,
  });
}
