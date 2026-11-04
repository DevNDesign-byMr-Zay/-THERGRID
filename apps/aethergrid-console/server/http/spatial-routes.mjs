import { createHash } from 'node:crypto';
import { readRequestJson as body } from '../../security/request-body.mjs';
import { CITY_USE_CASES } from '../../analysis/city-use-cases.mjs';
import { analyzeCityUseCase } from '../../analysis/city-planning.mjs';
import { summarizeGeospatialContext } from '../../analysis/geospatial-context.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createSpatialRoutes({
  geoRuntime,
  terrainRuntime,
  cityEnvironmentRuntime,
  cityLiveRuntime,
  spatialGraph,
  state,
  activity,
  json,
}) {
  let activeCityMesh = null;
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/global-live') {
      const live = await cityLiveRuntime.globalSnapshot(geoRuntime.cities, {
        force: url.searchParams.get('force') === '1',
      });
      return json(response, 200, live);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/runtime') {
      return json(response, 200, geoRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/cities') {
      return json(response, 200, {
        cities: geoRuntime.cities,
        runtime: geoRuntime.summary(),
      });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/aethergrid/geospatial/city/')) {
      const cityId = decodeURIComponent(
        url.pathname.slice('/api/aethergrid/geospatial/city/'.length),
      );
      const baseMesh = await geoRuntime.cityMesh(cityId, {
        force: url.searchParams.get('force') === '1',
      });
      if (url.searchParams.get('spatial') === '1') {
        activeCityMesh = baseMesh;
        return json(response, 200, baseMesh);
      }
      const [terrain, environment, liveContext] = await Promise.all([
        terrainRuntime.sample({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusM: baseMesh.city.radiusM,
          gridSize: 7,
        }),
        cityEnvironmentRuntime.current({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
        }),
        cityLiveRuntime.citySnapshot({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusKm: 1200,
          force: url.searchParams.get('force') === '1',
        }),
      ]);
      const mesh = { ...baseMesh, terrain, environment, liveContext };
      activeCityMesh = mesh;
      state.externalContext.geospatial = summarizeGeospatialContext(mesh);
      activity(
        `Geospatial city mesh loaded: ${mesh.city.name} via ${mesh.source.provider} (${mesh.buildings.length} buildings, ${(mesh.powerLines || []).length} power lines, ${(mesh.powerAssets || []).length} power assets).`,
        'geospatial',
      );
      return json(response, 200, {
        ...mesh,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/geospatial/point') {
      const backgroundTile = url.searchParams.get('tile') === '1';
      const baseMesh = await geoRuntime.pointMesh(
        {
          lat: url.searchParams.get('lat'),
          lon: url.searchParams.get('lon'),
          name: url.searchParams.get('name') || 'Coordinate Explorer',
          radiusM: backgroundTile ? 450 : url.searchParams.get('radiusM') || 900,
        },
        {
          force: url.searchParams.get('force') === '1',
        },
      );
      if (url.searchParams.get('spatial') === '1') {
        // Streaming requests are observational and must not change the
        // operator's selected city or its downstream analysis context.
        if (!backgroundTile) activeCityMesh = baseMesh;
        return json(response, 200, baseMesh);
      }
      const [terrain, environment, liveContext] = await Promise.all([
        terrainRuntime.sample({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusM: baseMesh.city.radiusM,
          gridSize: 7,
        }),
        cityEnvironmentRuntime.current({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
        }),
        cityLiveRuntime.citySnapshot({
          lat: baseMesh.city.lat,
          lon: baseMesh.city.lon,
          radiusKm: 1200,
          force: url.searchParams.get('force') === '1',
        }),
      ]);
      const mesh = { ...baseMesh, terrain, environment, liveContext };
      activeCityMesh = mesh;
      state.externalContext.geospatial = summarizeGeospatialContext(mesh);
      activity(
        `Coordinate mesh loaded: ${mesh.city.lat.toFixed(5)}, ${mesh.city.lon.toFixed(5)} via ${mesh.source.provider}.`,
        'geospatial',
      );
      return json(response, 200, {
        ...mesh,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-operations/use-cases') {
      return json(response, 200, {
        useCases: Object.values(CITY_USE_CASES),
        activeCity: activeCityMesh?.city || null,
        advisoryOnly: true,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/city-operations/analyze') {
      const input = await body(request);
      const analysis = analyzeCityUseCase(
        activeCityMesh,
        String(input.useCaseId || 'grid-resilience'),
      );
      const receipt = createHash('sha256')
        .update(JSON.stringify({ analysis, at: analysis.generatedAt }))
        .digest('hex');
      analysis.receipt = receipt;
      state.externalContext.geospatial = {
        ...(state.externalContext.geospatial || {}),
        useCase: {
          id: analysis.useCase.id,
          label: analysis.useCase.label,
          planningIndex: analysis.planningIndex,
          metrics: analysis.metrics,
          observations: analysis.observations,
          receipt,
        },
      };
      const record = {
        id: receipt.slice(0, 16),
        title: `${analysis.city.name}: ${analysis.useCase.label}`,
        type: 'CITY_OPERATION',
        age: 'just now',
        status: 'VERIFIED',
        receipt,
        details: {
          city: analysis.city.name,
          useCase: analysis.useCase.id,
          planningIndex: analysis.planningIndex,
          source: analysis.dataQuality.geometryProvider,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(record);
      state.evidence = state.evidence.slice(0, 24);
      activity(
        `City operation completed: ${analysis.useCase.label} for ${analysis.city.name}.`,
        'city-operation',
      );
      return json(response, 200, {
        analysis,
        evidence: record,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-live') {
      const live = await cityLiveRuntime.citySnapshot({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
        radiusKm: url.searchParams.get('radiusKm') || 1200,
        force: url.searchParams.get('force') === '1',
      });
      return json(response, 200, live);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/city-live/runtime') {
      return json(response, 200, cityLiveRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/environment') {
      const environment = await cityEnvironmentRuntime.current({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
      });
      return json(response, 200, environment);
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/environment/runtime') {
      return json(response, 200, cityEnvironmentRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/terrain') {
      const terrain = await terrainRuntime.sample({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
        radiusM: url.searchParams.get('radiusM') || 900,
        gridSize: url.searchParams.get('gridSize') || 7,
      });
      state.externalContext.geospatial = {
        ...(state.externalContext.geospatial || {}),
        terrain: {
          provider: terrain.source.provider,
          live: Boolean(terrain.source.live),
          minElevationM: terrain.minElevationM,
          maxElevationM: terrain.maxElevationM,
          gridSize: terrain.gridSize,
        },
      };
      activity(
        `Terrain sample loaded via ${terrain.source.provider} (${terrain.gridSize}×${terrain.gridSize}, ${terrain.minElevationM}–${terrain.maxElevationM} m).`,
        'terrain',
      );
      return json(response, 200, {
        ...terrain,
        externalContext: state.externalContext,
        activity: state.activity,
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/terrain/runtime') {
      return json(response, 200, terrainRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/spatial') {
      const requestedHour = Number(url.searchParams.get('hour') ?? 12);
      const hour = Math.max(0, Math.min(24, Number.isFinite(requestedHour) ? requestedHour : 12));
      return json(response, 200, {
        ...spatialGraph,
        timeHour: hour,
        region: state.system.region,
        scenario: state.system.scenario,
        advisoryOnly: true,
      });
    }
    return false;
  };
}
