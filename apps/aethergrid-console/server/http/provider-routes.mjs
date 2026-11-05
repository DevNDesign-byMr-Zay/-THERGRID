import { createPublicConfig } from '../../config/public-config.mjs';
import { validateCoordinates } from '../../providers/coordinate-validator.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createProviderRoutes({
  providerRegistry,
  tomorrowWeatherProvider,
  nwsAlertsProvider,
  eiaProvider,
  noaaNwpsProvider,
  transitlandProvider,
  transitFeedConfig,
  transitRegistry,
  liveMapRuntime,
  agentRuntime,
  geoRuntime,
  cityEnvironmentRuntime,
  cityLiveRuntime,
  terrainRuntime,
  quantumRuntime,
  profileStore,
  state,
  json,
}) {
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/health') {
      const runtime = agentRuntime.summary();
      return json(response, 200, {
        ok: true,
        product: 'ÆTHERGRID',
        authority: 'advisory-only',
        region: state.system.region,
        view: state.system.view,
        scenario: state.system.scenario,
        agentsOnline: Object.values(state.agents).every((agent) => agent.status === 'ONLINE'),
        aiRuntime: {
          mode: runtime.mode,
          liveProviders: runtime.liveProviders,
        },
        geospatialRuntime: {
          provider: geoRuntime.summary().provider,
          liveProviderConfigured: geoRuntime.summary().liveProviderConfigured,
        },
        environmentRuntime: {
          provider: cityEnvironmentRuntime.summary().provider,
          liveProviderConfigured: cityEnvironmentRuntime.summary().liveProviderConfigured,
        },
        liveContextRuntime: {
          airQualityProvider: cityLiveRuntime.summary().airQualityProvider,
          seismicProvider: cityLiveRuntime.summary().seismicProvider,
          liveAirQualityConfigured: cityLiveRuntime.summary().liveAirQualityConfigured,
          liveSeismicConfigured: cityLiveRuntime.summary().liveSeismicConfigured,
        },
        quantumRuntime: {
          provider: quantumRuntime.summary().provider,
          configured: quantumRuntime.summary().configured,
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/config/public') {
      return json(
        response,
        200,
        providerRegistry.redactor.redactValue(createPublicConfig(providerRegistry.config)),
      );
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/domains/aviation/aircraft') {
      try {
        const scope = url.searchParams.get('scope') || 'global';
        const result = await liveMapRuntime.aviation({
          scope,
          latitude: url.searchParams.get('latitude'),
          longitude: url.searchParams.get('longitude'),
          radiusKm: url.searchParams.get('radiusKm') ?? 250,
        });
        return json(response, 200, result);
      } catch (error) {
        return json(response, String(error.message).startsWith('Invalid') ? 400 : 503, {
          error: 'aviation_unavailable',
          message: error.message,
          live: false,
        });
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/radar') {
      try {
        return json(response, 200, await liveMapRuntime.radar());
      } catch (error) {
        return json(response, 503, {
          error: 'radar_unavailable',
          message: error.message,
          live: false,
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/current') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');

      const coordVal = validateCoordinates(latParam, lonParam);
      if (!coordVal.valid) {
        return json(response, 400, {
          error: 'invalid_coordinates',
          message: coordVal.message,
          live: false,
        });
      }

      const { lat, lon } = coordVal;

      if (providerRegistry.config.weather.provider === 'tomorrow-io') {
        const result = await tomorrowWeatherProvider.request(
          { lat, lon, mode: 'realtime' },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }

      const fetcher = () => cityEnvironmentRuntime.current({ lat, lon });
      const result = await providerRegistry.executeProviderRequest(
        'open-meteo-weather',
        {
          lat,
          lon,
          requestId: reqContext.requestId,
          capability: 'weather',
          dataset: 'open-meteo-weather',
          ttlMs: 120000,
          attribution: 'Open-Meteo Weather API',
        },
        fetcher,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/weather/forecast') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');

      const coordVal = validateCoordinates(latParam, lonParam);
      if (!coordVal.valid) {
        return json(response, 400, {
          error: 'invalid_coordinates',
          message: coordVal.message,
          live: false,
        });
      }

      const { lat, lon } = coordVal;

      if (providerRegistry.config.weather.provider === 'tomorrow-io') {
        const result = await tomorrowWeatherProvider.request(
          { lat, lon, mode: 'forecast' },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }

      const fetcher = () => cityEnvironmentRuntime.forecast({ lat, lon });
      const result = await providerRegistry.executeProviderRequest(
        'open-meteo-weather',
        {
          lat,
          lon,
          requestId: reqContext.requestId,
          capability: 'weather',
          dataset: 'open-meteo-forecast',
          ttlMs: 300000,
          attribution: 'Open-Meteo Weather API',
        },
        fetcher,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/hazards/alerts') {
      const latParam = url.searchParams.get('lat');
      const lonParam = url.searchParams.get('lon');
      if (latParam !== null || lonParam !== null) {
        const coordVal = validateCoordinates(latParam, lonParam);
        if (!coordVal.valid) {
          return json(response, 400, {
            error: 'invalid_coordinates',
            message: coordVal.message,
            live: false,
          });
        }
        const result = await nwsAlertsProvider.request(
          { lat: coordVal.lat, lon: coordVal.lon },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      }
      const result = await nwsAlertsProvider.request({}, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/hydrology/gauges') {
      const gaugeId = url.searchParams.get('gaugeId') || undefined;
      const result = await noaaNwpsProvider.request({ gaugeId }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/energy/context') {
      const region = url.searchParams.get('region') || undefined;
      const result = await eiaProvider.request({ region }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/transit/discovery') {
      const city = url.searchParams.get('city') || url.searchParams.get('query') || '';
      const latitude = url.searchParams.get('lat') ?? url.searchParams.get('latitude');
      const longitude = url.searchParams.get('lon') ?? url.searchParams.get('longitude');
      const radius = url.searchParams.get('radius');
      const limit = url.searchParams.get('limit');
      const result = await transitlandProvider.request(
        {
          city,
          query: city,
          ...(latitude !== null ? { lat: latitude } : {}),
          ...(longitude !== null ? { lon: longitude } : {}),
          ...(radius !== null ? { radius } : {}),
          ...(limit !== null ? { limit } : {}),
        },
        execCtx,
      );
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (
      request.method === 'GET' &&
      ['/api/aethergrid/transit/vehicles', '/api/aethergrid/transit/realtime'].includes(
        url.pathname,
      )
    ) {
      const cityId = url.searchParams.get('cityId') || undefined;
      const result = await transitRegistry.adapter.request({ cityId }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime/providers') {
      const runtimeMetadata = providerRegistry.getSafePublicRuntimeMetadata();
      const safeRuntimeMetadata = {
        ...runtimeMetadata,
        transit: {
          ...runtimeMetadata.transit,
          configuredFeedCount: transitFeedConfig.metadata.configuredFeedCount,
          enabledFeedCount: transitFeedConfig.metadata.enabledFeedCount,
          cityCount: transitFeedConfig.metadata.cityCount,
          configSource: transitFeedConfig.metadata.source,
        },
      };
      return json(response, 200, providerRegistry.redactor.redactValue(safeRuntimeMetadata));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/runtime') {
      const ai = agentRuntime.summary();
      return json(response, 200, {
        ...ai,
        ai,
        geospatial: geoRuntime.summary(),
        environment: cityEnvironmentRuntime.summary(),
        liveContext: cityLiveRuntime.summary(),
        terrain: terrainRuntime.summary(),
        quantum: quantumRuntime.summary(),
        profile: profileStore.safeSummary(),
      });
    }
    return false;
  };
}
