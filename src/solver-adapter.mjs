import { buildSolverEvidence } from './solver-evaluation.mjs';

const ADAPTER_VERSION = 1;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export function createSolverAdapter({ model, solver, version, solve }) {
  requireText(model, 'model');
  requireText(solver, 'solver');
  requireText(version, 'version');
  if (typeof solve !== 'function') throw new TypeError('solve must be a function');

  return Object.freeze({
    adapterVersion: ADAPTER_VERSION,
    identity: Object.freeze({ model: model.trim(), solver: solver.trim(), version: version.trim() }),
    solve(input = {}) {
      return solve(requireObject(input, 'input'));
    },
  });
}

export function createClassicalReferenceAdapter() {
  return createSolverAdapter({
    model: 'thergrid-classical-reference',
    solver: 'thergrid-reference',
    version: 'v1',
    solve(input) {
      const proposal = requireObject(input.proposal, 'input.proposal');
      const objective = Math.abs(Number(proposal.projectedBalanceKw));
      return buildSolverEvidence({
        experimentId: requireText(input.experimentId, 'input.experimentId'),
        inputSnapshotId: requireText(input.snapshotId, 'input.snapshotId'),
        candidate: { model: 'thergrid-classical-reference', solver: 'thergrid-reference', version: 'v1' },
        constraints: input.constraints ?? null,
        seed: input.seed ?? 0,
        objective,
        feasible: Number.isFinite(objective),
        runtimeMs: 0,
        timeout: false,
        provenance: input.provenance ?? [],
      });
    },
  });
}

export function createQuantumInspiredAdapter() {
  return createSolverAdapter({
    model: 'quantum-inspired',
    solver: 'thergrid-quantum-inspired-contract',
    version: 'v1',
    solve(input) {
      return buildSolverEvidence({
        experimentId: requireText(input.experimentId, 'input.experimentId'),
        inputSnapshotId: requireText(input.snapshotId, 'input.snapshotId'),
        candidate: { model: 'quantum-inspired', solver: 'thergrid-quantum-inspired-contract', version: 'v1' },
        constraints: input.constraints ?? null,
        seed: input.seed ?? 0,
        objective: Number.isFinite(input.objective) ? input.objective : 0,
        feasible: input.feasible === true,
        runtimeMs: Number.isFinite(input.runtimeMs) ? input.runtimeMs : 0,
        timeout: input.timeout === true,
        fallback: input.fallback ?? null,
        provenance: input.provenance ?? [],
      });
    },
  });
}

export function createSolverAdapterContract() {
  return Object.freeze({
    adapterVersion: ADAPTER_VERSION,
    requiredEvidence: ['experimentId', 'inputSnapshotId', 'candidate', 'constraints', 'seed', 'objective', 'feasible', 'runtimeMs', 'timeout', 'fallback', 'provenance'],
    authoritative: false,
    promotion: 'thergrid-validation-gate-v1',
    adapters: ['classical-reference', 'quantum-inspired', 'solvear-external'],
  });
}

export { ADAPTER_VERSION };
