import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import react from '@vitejs/plugin-react';
import { createServer, type ViteDevServer } from 'vite';

type Props = Parameters<typeof import('../src/components/LiveSceneBadges').LiveSceneBadges>[0];
let LiveSceneBadges: typeof import('../src/components/LiveSceneBadges').LiveSceneBadges;
let vite: ViteDevServer;

test.beforeAll(async () => {
  // Playwright's own TSX transformer represents JSX as test metadata, not React elements.
  // Load the production component through Vite's React transform for real server rendering.
  vite = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true } });
  ({ LiveSceneBadges } = await vite.ssrLoadModule('/src/components/LiveSceneBadges.tsx'));
});

test.afterAll(async () => {
  await vite?.close();
});

const idle = {
  scope: 'city' as const,
  cityName: 'TOKYO',
  live: true,
  streamingState: { count: 0, error: null },
  cityLoad: { spatial: false, environment: false, liveContext: false },
  hazardContext: null,
  hazardError: null,
  transitContext: null,
  transitError: null,
  hydrologyContext: null,
  hydrologyError: null
};

function render(props: Props): string {
  return renderToStaticMarkup(createElement(LiveSceneBadges, props));
}

test('live city streams and loading statuses preserve source-backed and degraded labels', () => {
  const markup = render({
    ...idle,
    streamingState: { count: 2, error: 'tile unavailable' },
    cityLoad: { spatial: false, environment: true, liveContext: true }
  });
  expect(markup).toContain('data-live-city-tiles="2"');
  expect(markup).toContain('2 VISIBLE TILES · SOURCE-BACKED');
  expect(markup).toContain('data-live-city-stream="degraded"');
  expect(markup).toContain('CORE GEOMETRY PRESERVED');
  expect(markup).toContain('LOADING TOKYO');
  expect(markup).toContain('2 SOURCES PENDING');
  expect(markup).toContain('data-ready="true">GEOMETRY');
  expect(markup).toContain('data-ready="false">ATMOSPHERE');
});

test('NWS alert badges distinguish live, stale, fallback and unavailable receipts', () => {
  const alert = { event: 'Flood Warning', severity: 'Severe' };
  const context = { alerts: [alert], live: true, stale: false };
  expect(render({ ...idle, hazardContext: context })).toContain('data-source-state="live"');
  expect(render({ ...idle, hazardContext: context })).toContain('Flood Warning · Severe SEVERITY');
  expect(render({ ...idle, hazardContext: { ...context, stale: true } })).toContain('data-source-state="stale"');
  expect(render({ ...idle, hazardContext: { ...context, live: false } })).toContain('data-source-state="fallback"');
  expect(render({ ...idle, hazardError: 'NWS request failed' })).toContain('NWS request failed');
  expect(render({ ...idle, hazardError: 'NWS request failed' })).toContain('data-source-state="unavailable"');
});

test('GTFS and NOAA badges preserve unconfigured, stale, partial and measured-stage truth', () => {
  const transit = {
    unconfigured: true,
    stale: false,
    live: false,
    vehicles: [],
    agencyName: null,
    provider: 'GTFS'
  };
  const hydrology = {
    partial: true,
    stale: false,
    live: true,
    gauge: { gaugeId: 'BATN6', observedStageFeet: null, name: 'Battery Park' }
  };
  const markup = render({ ...idle, transitContext: transit, hydrologyContext: hydrology });
  expect(markup).toContain('data-source-state="unconfigured"');
  expect(markup).toContain('FEED NOT CONFIGURED');
  expect(markup).toContain('NO LIVE POSITION FEED');
  expect(markup).toContain('data-source-state="partial"');
  expect(markup).toContain('STAGE UNAVAILABLE');
  expect(markup).toContain('PARTIAL · METADATA SOURCE LIVE');

  const measured = render({
    ...idle,
    transitContext: { ...transit, unconfigured: false, stale: true, vehicles: [{ id: 'v1' }] },
    hydrologyContext: { ...hydrology, partial: false, gauge: { ...hydrology.gauge, observedStageFeet: 3.127 } }
  });
  expect(measured).toContain('STALE SOURCE POSITIONS');
  expect(measured).toContain('1 VEHICLE');
  expect(measured).toContain('3.13 FT STAGE');
  expect(measured).toContain('Battery Park');
});

test('world and non-live frames never show live provider badges', () => {
  const fake = { ...idle, hazardError: 'hidden hazard', transitError: 'hidden transit', hydrologyError: 'hidden hydrology' };
  expect(render({ ...fake, scope: 'world' })).toBe('');
  expect(render({ ...fake, live: false })).toBe('');
});
