import { createHash } from 'node:crypto';

// Presentation-only synthetic geometry: deterministic but never provider observations.
function seededRandom(seedText) {
  let seed = createHash('sha256').update(seedText).digest().readUInt32LE(0);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function seededFallback(city, count = 110) {
  const random = seededRandom(city.id);
  return Array.from({ length: count }, (_, index) => {
    const x = (random() - 0.5) * 1500;
    const z = (random() - 0.5) * 1500;
    const width = 12 + random() * 42;
    const depth = 12 + random() * 42;
    return {
      id: `fallback-${index + 1}`,
      name: '',
      heightM: 10 + random() * 95,
      heightSource: 'synthetic-fallback',
      minHeightM: 0,
      roofShape: '',
      roofHeightM: 0,
      footprint: [
        [x - width, z - depth],
        [x + width, z - depth],
        [x + width, z + depth],
        [x - width, z + depth],
        [x - width, z - depth],
      ],
    };
  });
}

function fallbackRoads(city, count = 20) {
  const random = seededRandom(`${city.id}:roads`);
  return Array.from({ length: count }, (_, index) => {
    const horizontal = index % 2 === 0;
    const offset = (random() - 0.5) * 1250;
    const wobble = (random() - 0.5) * 90;
    return {
      id: `fallback-road-${index + 1}`,
      name: '',
      highwayType: index % 5 === 0 ? 'primary' : 'residential',
      path: horizontal
        ? [
            [-720, offset],
            [-260, offset + wobble],
            [260, offset - wobble],
            [720, offset],
          ]
        : [
            [offset, -720],
            [offset + wobble, -260],
            [offset - wobble, 260],
            [offset, 720],
          ],
    };
  });
}

function fallbackPower(city) {
  const random = seededRandom(`${city.id}:power`);
  const powerAssets = Array.from({ length: 9 }, (_, index) => ({
    id: `fallback-power-asset-${index + 1}`,
    name: index % 3 === 0 ? `Local Substation ${index + 1}` : '',
    powerType: index % 3 === 0 ? 'substation' : 'transformer',
    voltage: index % 3 === 0 ? 138000 : 13800,
    operator: '',
    position: [(random() - 0.5) * 1300, (random() - 0.5) * 1300],
  }));
  const powerLines = Array.from({ length: 8 }, (_, index) => {
    const horizontal = index % 2 === 0;
    const offset = (random() - 0.5) * 1050;
    return {
      id: `fallback-power-line-${index + 1}`,
      name: '',
      powerType: index % 4 === 0 ? 'line' : 'minor_line',
      voltage: index % 4 === 0 ? 138000 : 33000,
      operator: '',
      path: horizontal
        ? [
            [-700, offset],
            [-180, offset + (random() - 0.5) * 80],
            [280, offset + (random() - 0.5) * 80],
            [700, offset],
          ]
        : [
            [offset, -700],
            [offset + (random() - 0.5) * 80, -180],
            [offset + (random() - 0.5) * 80, 280],
            [offset, 700],
          ],
    };
  });
  return { powerLines, powerAssets };
}

export { seededFallback, fallbackRoads, fallbackPower };
