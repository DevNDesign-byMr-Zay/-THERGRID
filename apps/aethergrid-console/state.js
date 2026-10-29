(() => {
  'use strict';
  // Classic-script companion: keeps file:// and legacy/standalone.html operational.
  const SETTINGS_KEY = 'aethergrid.operator.settings.v2';
  const DEFAULT_GLOBAL_CITIES = Object.freeze([
    { id: 'new-york', name: 'New York', country: 'United States', district: 'Midtown Manhattan', lat: 40.7549, lon: -73.984, radiusM: 1600 },
    { id: 'london', name: 'London', country: 'United Kingdom', district: 'City of London / South Bank', lat: 51.5136, lon: -0.0917, radiusM: 1700 },
    { id: 'tokyo', name: 'Tokyo', country: 'Japan', district: 'Shinjuku', lat: 35.6896, lon: 139.6917, radiusM: 1700 },
    { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', district: 'Downtown Dubai', lat: 25.1972, lon: 55.2744, radiusM: 1800 },
    { id: 'singapore', name: 'Singapore', country: 'Singapore', district: 'Marina Bay / Downtown Core', lat: 1.2838, lon: 103.8515, radiusM: 1700 },
    { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', district: 'Paulista / Bela Vista', lat: -23.5614, lon: -46.6559, radiusM: 1700 },
    { id: 'lagos', name: 'Lagos', country: 'Nigeria', district: 'Victoria Island / Eko Atlantic', lat: 6.4281, lon: 3.4219, radiusM: 1800 },
    { id: 'sydney', name: 'Sydney', country: 'Australia', district: 'CBD / Circular Quay', lat: -33.8651, lon: 151.2099, radiusM: 1700 },
  ]);

  const defaultSettings = Object.freeze({
    theme: 'dark',
    defaultWorkspace: 'grid',
    density: 'comfortable',
    animationIntensity: 100,
    reducedMotion: false,
    autoRotate: false,
    spatialLabels: true,
    defaultHour: 12,
    liveStream: true,
    refreshMs: 2500,
  });

  const createState = () => ({
    workspace: 'grid',
    selectedAgent: 'TEAM',
    agentChats: { TEAM: [], 'VÆLON': [], AUREN: [], 'SOLVÆR': [] },
    settings: { ...defaultSettings },
    system: {
      status: 'All Systems Nominal',
      region: 'New York Metro',
      view: 'live',
      scenario: 'peak-demand',
      scenarioParameters: {
        loadMultiplierPercent: 110,
        renewableAvailabilityPercent: 100,
        storageReservePercent: 18,
        weatherRiskPercent: 20,
      },
      mode: 'ADVISORY ONLY',
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
    },
    agents: {
      'VÆLON': { role: 'Optimization & Scenario Exploration', status: 'READY' },
      AUREN: { role: 'Semantic & Spatial Intelligence', status: 'READY' },
      'SOLVÆR': { role: 'Simulation & Evidence Generation', status: 'READY' },
    },
    activity: [],
    evidence: [
      { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', type: 'Scenario', age: '12 min ago', status: 'Verified' },
      { id: 'quantum-optimization', title: 'Quantum Optimization Run', type: 'Optimization', age: '28 min ago', status: 'Verified' },
      { id: 'grid-resilience', title: 'Grid Resilience Analysis', type: 'AI Analysis', age: '1 hour ago', status: 'Verified' },
      { id: 'renewable-integration', title: 'Renewable Integration Study', type: 'Simulation', age: '2 hours ago', status: 'Verified' },
    ],
    optimizationHistory: [],
    runtime: null,
    geospatial: {
      runtime: null,
      cities: DEFAULT_GLOBAL_CITIES.map((city) => ({ ...city })),
      selectedCityId: 'new-york',
      cityMesh: null,
      globalLive: null,
      activeUseCase: null,
    },
    quantumRuntime: null,
    profile: {
      id: 'local-operator',
      displayName: 'Operator',
      initials: 'IM',
      title: 'ÆTHERGRID Operator',
      organization: '',
      homeRegion: 'New York Metro',
      timezone: 'America/New_York',
      bio: '',
      avatarDataUrl: '',
      updatedAt: null,
    },
  });

  globalThis.AETHERGRID_LEGACY_STATE = Object.freeze({
    SETTINGS_KEY,
    DEFAULT_GLOBAL_CITIES,
    defaultSettings,
    createState,
  });
})();
