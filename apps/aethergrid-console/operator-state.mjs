const regions = Object.freeze([
  'New York Metro',
  'Long Island',
  'Hudson Valley',
  'Upstate New York',
]);

const scenarios = Object.freeze([
  'peak-demand',
  'renewable-surge',
  'storage-stress',
  'weather-event',
  'custom',
]);

const views = Object.freeze(['live', 'forecast', 'scenario']);

const state = {
  system: {
    status: 'All Systems Nominal',
    region: 'New York Metro',
    mode: 'ADVISORY ONLY',
    view: 'live',
    scenario: 'peak-demand',
    scenarioParameters: {
      loadMultiplierPercent: 110,
      renewableAvailabilityPercent: 100,
      storageReservePercent: 18,
      weatherRiskPercent: 20,
    },
    physicalActuation: false,
    infrastructureDispatch: false,
  },
  metrics: {
    generationMw: 2130,
    loadMw: 2410,
    renewablePercent: 46.8,
    storageMw: 590,
  },
  optimization: {
    currentCost: 12480,
    candidateCost: 10230,
    classicalCandidateCost: 11790,
    emissionsReduction: 24.3,
    renewableUtilizationGain: 16.7,
    reliabilityScore: 90.0,
    runCount: 0,
    history: [],
  },
  agents: {
    'VÆLON': {
      role: 'Optimization & Scenario Exploration',
      description:
        'Runs bounded multi-objective scenario exploration with renewable prioritization and classical-baseline comparison.',
      status: 'ONLINE',
    },
    AUREN: {
      role: 'Semantic Analysis & Spatial Intelligence',
      description:
        'Interprets grid-resilience patterns, spatial relationships, operator context, and evidence-linked meaning.',
      status: 'ONLINE',
    },
    'SOLVÆR': {
      role: 'Simulation & Evidence Generation',
      description:
        'Generates bounded simulations, validation evidence, provenance records, and candidate-comparison packages.',
      status: 'ONLINE',
    },
  },
  evidence: [
    { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', age: '12 min', status: 'VERIFIED' },
    { id: 'quantum-optimization', title: 'Quantum Optimization Run', age: '28 min', status: 'VERIFIED' },
    { id: 'grid-resilience', title: 'Grid Resilience Analysis', age: '1 hour', status: 'VERIFIED' },
    { id: 'renewable-integration', title: 'Renewable Integration Study', age: '2 hours', status: 'VERIFIED' },
  ],
  activity: [],
  externalContext: {
    geospatial: null,
    quantum: null,
  },
};

function buildSpatialGraph() {
  const nodes = [
    { id: 'renewables-west', label: 'Renewable Generation', type: 'generation', position: [-6, 0.35, -3], capacityMw: 2130 },
    { id: 'midtown-load', label: 'Grid Load', type: 'load', position: [-2, 0.55, 1], loadMw: 2410 },
    { id: 'battery-east', label: 'Energy Storage', type: 'storage', position: [2, 0.65, -2], capacityMw: 590 },
    { id: 'nyc-core', label: 'New York City', type: 'city', position: [5, 0.48, 3], loadMw: 1240 },
    { id: 'north-hub', label: 'North Hub', type: 'transmission', position: [0, 0.72, 5], capacityMw: 880 },
    { id: 'coastal-hub', label: 'Coastal Hub', type: 'transmission', position: [7, 0.38, -5], capacityMw: 720 },
    { id: 'west-hub', label: 'West Hub', type: 'transmission', position: [-7, 0.44, 5], capacityMw: 760 },
  ];
  const routeIndexes = [[0,1],[1,2],[2,3],[1,4],[3,5],[4,6],[6,0],[4,3],[2,5]];
  const routes = routeIndexes.map(([a,b], index) => ({
    id: `route-${index + 1}`,
    from: nodes[a].id,
    to: nodes[b].id,
    capacityMw: 480 + index * 55,
    phase: index * 0.57,
  }));
  let seed = 31;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const structures = Array.from({ length: 72 }, (_, index) => ({
    id: `structure-${index + 1}`,
    x: random() * 18 - 9,
    z: random() * 18 - 9,
    width: 0.28 + random() * 0.62,
    depth: 0.28 + random() * 0.62,
    height: 0.35 + random() * 2.8,
    temporalPhase: random() * Math.PI * 2,
  }));
  return {
    schemaVersion: 1,
    dimensions: ['x', 'y', 'z', 'time'],
    coordinateSystem: 'normalized-operator-grid',
    temporal: { minHour: 0, maxHour: 24, unit: 'hour' },
    nodes,
    routes,
    structures,
  };
}


export { regions, scenarios, views, state, buildSpatialGraph };
