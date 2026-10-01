import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 temporal navigator builds only bounded local incidents and captured A/B analysis frames', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/temporal-event-navigator.ts',
  );

  assert.match(service, /operator-incident/u);
  assert.match(service, /observation-a/u);
  assert.match(service, /observation-b/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /operator-local/u);
  assert.match(service, /captured-frame/u);
  assert.match(service, /buildTemporalNavigatorEvents/u);
  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
});

test('v4 temporal event navigation demotes old LIVE captures to historical context', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/temporal-event-navigator.ts',
  );

  assert.match(service, /temporalEventNavigationMode/u);
  assert.match(service, /event\.originalMode === 'scenario'/u);
  assert.match(service, /Math\.abs\(delta\) < 30_000/u);
  assert.match(service, /return delta < 0 \? 'historical' : 'forecast'/u);
});

test('v4 temporal rail exposes event markers inside the same bounded -6h to +7d control window', async () => {
  const rail = await text('apps/aethergrid-console/web/src/components/TemporalRail.tsx');

  assert.match(rail, /TEMPORAL_RAIL_PAST_MINUTES/u);
  assert.match(rail, /TEMPORAL_RAIL_FUTURE_MINUTES/u);
  assert.match(rail, /temporalEventInRailWindow/u);
  assert.match(rail, /temporalEventRailPercent/u);
  assert.match(rail, /time-event-markers/u);
  assert.match(rail, /time-event-marker/u);
  assert.match(rail, /Jump to/u);
});

test('v4 temporal event navigator supports source filters and bounded previous next traversal', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/TemporalEventNavigator.tsx');

  assert.match(panel, /4D EVENT NAVIGATOR/u);
  assert.match(panel, /INCIDENTS/u);
  assert.match(panel, /A\/B CAPTURES/u);
  assert.match(panel, /PREV/u);
  assert.match(panel, /NEXT/u);
  assert.match(panel, /filterTemporalNavigatorEvents/u);
  assert.match(panel, /Math\.max\(0, Math\.min\(filtered\.length - 1/u);
});

test('v4 temporal event jumps preserve scenario identity and never relabel old event timestamps as live', async () => {
  const [rail, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx'),
    text('apps/aethergrid-console/web/src/components/TemporalEventNavigator.tsx'),
  ]);

  for (const source of [rail, panel]) {
    assert.match(source, /temporalEventNavigationMode/u);
    assert.match(source, /clock\.pause\(\)/u);
    assert.match(source, /clock\.setMode\('scenario', event\.scenarioId\)/u);
    assert.match(source, /clock\.scrub\(event\.timeIso, 'scenario'\)/u);
    assert.match(source, /clock\.scrub\(event\.timeIso, mode\)/u);
  }
});

test('v4 app shares one temporal event model with both navigator controls and rail markers', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /buildTemporalNavigatorEvents/u);
  assert.match(
    app,
    /buildTemporalNavigatorEvents\([\s\S]*spatialIncidents,[\s\S]*observationA,[\s\S]*observationB/u,
  );
  assert.match(app, /<TemporalEventNavigator/u);
  assert.match(app, /events=\{temporalEvents\}/u);
  assert.match(app, /<TemporalRail clock=\{clock\} state=\{temporal\} events=\{temporalEvents\}/u);
});

test('v4 temporal navigator truth copy explicitly separates operator incidents from captured analysis snapshots', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/TemporalEventNavigator.tsx');

  assert.match(panel, /TIME NAVIGATION · NON-AUTHORITATIVE/u);
  assert.match(panel, /old LIVE capture converts the view to historical context/u);
  assert.match(panel, /Operator incidents remain local annotations/u);
  assert.match(panel, /captured frames remain[\s\S]*operator analysis snapshots/u);
});
