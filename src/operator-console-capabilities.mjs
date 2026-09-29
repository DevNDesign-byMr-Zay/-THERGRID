import { DEVICE_TYPES } from './holographic-device-registry.mjs';
import { createModelRoute } from './model-routing.mjs';
import {
  ALGORITHM as QUANTUM_INSPIRED_ALGORITHM,
  BACKEND as QUANTUM_INSPIRED_BACKEND,
} from '../packages/optimization-engine/quantum-inspired.js';

const OPERATOR_CONSOLE_CAPABILITIES_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function createOperatorConsoleCapabilities() {
  const vaelonRoute = createModelRoute({ model: 'VÆLON', version: 'unbound' });

  return deepFreeze({
    version: OPERATOR_CONSOLE_CAPABILITIES_VERSION,
    product: 'ÆTHERGRID',
    purpose:
      'Advisory operator intelligence for renewable-energy digital twins, AI-assisted planning, quantum and quantum-inspired optimization, holographic spatial review, and auditable evidence.',
    mode: 'operator-review-only',
    digitalTwin: {
      state: 'implemented',
      role: 'validated-grid-state-and-scenario-source',
      capabilities: [
        'asset-topology',
        'telemetry-normalization',
        'state-estimation',
        'renewable-generation-and-storage-state',
        'scenario-simulation',
      ],
    },
    ai: {
      state: 'advisory',
      models: [
        {
          id: 'VÆLON',
          role: 'optimization-and-scenario-exploration',
          capabilities: [...vaelonRoute.capabilities],
        },
        {
          id: 'AUREN',
          role: 'semantic-and-operator-meaning-layer',
          capabilities: ['operator-interpretation', 'spatial-annotation-context'],
        },
        {
          id: 'SOLVÆR',
          role: 'bounded-candidate-computation-and-simulation-evidence',
          capabilities: ['candidate-analysis', 'simulation-handoff', 'evidence-summary'],
        },
      ],
    },
    quantum: {
      state: 'experimental',
      authority: 'advisory-only',
      classicalBaselineRequired: true,
      localQuantumInspiredBackend: QUANTUM_INSPIRED_BACKEND,
      localQuantumInspiredAlgorithm: QUANTUM_INSPIRED_ALGORITHM,
      progression: [
        'deterministic-classical-reference',
        'local-quantum-inspired',
        'provider-neutral-adapters',
        'optional-remote-simulators-or-hardware',
        'comparative-benchmarks',
      ],
    },
    holographic: {
      state: 'renderer-neutral',
      role: 'spatial-presentation-and-operator-review',
      supportedTargets: [...DEVICE_TYPES].sort(),
      authoritative: false,
      actuatesHardware: false,
    },
    evidence: {
      state: 'implemented',
      capabilities: [
        'decision-receipts',
        'provenance-fingerprints',
        'operator-attention',
        'simulation-evidence',
        'render-packet-integrity',
      ],
    },
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
      dispatchesInfrastructure: false,
      deploysInfrastructure: false,
      requiresExplicitFutureAuthorizationForActuation: true,
    },
  });
}

export { OPERATOR_CONSOLE_CAPABILITIES_VERSION };
