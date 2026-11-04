import { readFile } from 'node:fs/promises';

// Wiring assertions inspect the maintained renderer boundary. Drawing and lifecycle
// behavior is exercised independently by web's test:native and browser acceptance.
export async function nativeRendererSource() {
  const root = new URL('../../apps/aethergrid-console/web/src/renderer/native/', import.meta.url);
  const modules = [
    'native-webgl-renderer',
    'native-frame',
    'native-environment',
    'native-geometry',
    'native-canvas',
    'native-webgl-driver',
  ];
  return (
    await Promise.all(modules.map((name) => readFile(new URL(`${name}.ts`, root), 'utf8')))
  ).join('\n');
}
