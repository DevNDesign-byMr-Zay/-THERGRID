import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 forecast weather uses the backend provider route and bounded nearest-sample selection', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/city-environment.ts');

  assert.match(service, /loadCityEnvironmentForecast/u);
  assert.match(service, /\/api\/aethergrid\/weather\/forecast/u);
  assert.match(service, /selectCityEnvironmentForecast/u);
  assert.match(service, /bestDistance/u);
  assert.match(service, /bestDistance > maxDistanceMs/u);
  assert.match(service, /90 \* 60 \* 1000/u);
  assert.match(service, /receipt\.stale/u);
  assert.match(service, /receipt\.fallback/u);
  assert.match(service, /sourceBacked/u);
  assert.doesNotMatch(service, /Math\.random/u);
});

test('v4 forecast weather keeps Tomorrow and Open-Meteo shapes separate without inventing a shared code system', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/city-environment.ts');

  assert.match(service, /openMeteoHourly/u);
  assert.match(service, /providerData\.timelines/u);
  assert.match(service, /tomorrowHourly/u);
  assert.match(service, /weatherCode: null/u);
  assert.match(service, /temperatureApparent/u);
  assert.match(service, /windSpeed\) \* 3\.6/u);
});

test('v4 forecast cursor drives one active atmosphere through scene operations and AI context', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const forecastAtmosphere = useMemo/u);
  assert.match(app, /selectCityEnvironmentForecast/u);
  assert.match(app, /const activeAtmosphere/u);
  assert.match(app, /temporal\.mode === 'forecast'/u);
  assert.match(app, /atmosphere=\{scope === 'city' \? activeAtmosphere : null\}/u);
  assert.match(app, /PROVIDER FORECAST · 4D CURSOR/u);
  assert.match(app, /NOT LIVE OBSERVATION/u);
  assert.match(app, /forecast: temporal\.mode === 'forecast'/u);
  assert.match(app, /state:[\s\S]{0,260}'forecast'/u);
});

test('v4 Cesium and native failover render forecast weather without promoting AQI or seismic', async () => {
  const [cesium, nativeRenderer, rail] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/weather-atmosphere-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/components/TemporalRail.tsx'),
  ]);

  assert.match(cesium, /this\.#temporalMode === 'forecast'/u);
  assert.match(cesium, /this\.#snapshot\?\.fallback !== true/u);
  assert.match(nativeRenderer, /this\.#time\.mode === 'forecast'/u);
  assert.match(nativeRenderer, /forecastPresentation/u);
  assert.match(nativeRenderer, /presentationPrecipitation/u);
  assert.match(rail, /FORECAST \+ STATIC/u);
  assert.match(rail, /AQI\/seismic hidden/u);
});

test('v4 forecast presentation has distinct source-state styling', async () => {
  const styles = await text('apps/aethergrid-console/web/src/app/app.css');

  assert.match(styles, /\.forecast-scene-badge/u);
  assert.match(styles, /data-source-state='forecast'/u);
  assert.match(styles, /data-provider-state='forecast'/u);
});
