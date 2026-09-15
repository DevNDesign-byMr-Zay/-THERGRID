import { createHash } from 'node:crypto';
import { validateProvenanceGraph } from './provenance.mjs';
import { validateSolvaerOperatorAttention } from './solvaer-operator-attention.mjs';
import { validateOperatorProvenanceReadModel } from './operator-provenance-read-model.mjs';

const OPERATOR_EVIDENCE_PACKAGE_VERSION = 1;
const PACKAGE_KEYS = Object.freeze([
  'version',
  'experimentId',
  'snapshotId',
  'requestId',
  'attention',
  'provenance',
  'readModel',
  'manifest',
  'interpretation',
  'safety',
  'packageFingerprint',
]);
const MANIFEST_KEYS = Object.freeze([
  'attentionFingerprint',
  'provenanceNodeId',
  'provenanceFingerprint',
  'viewFingerprint',
]);
const SAFETY_KEYS = Object.freeze([
  'advisoryOnly',
  'authoritative',
  'actuatesHardware',
  'promotionEligible',
  'dispatchesInfrastructure',
  'deploysInfrastructure',
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function canonicalEqual(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function readExactDataObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (
    actualKeys.length !== expected.length ||
    actualKeys.some((key, index) => key !== expected[index])
  ) {
    return null;
  }

  const copy = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function packageSafety() {
  return Object.freeze({
    advisoryOnly: true,
    authoritative: false,
    actuatesHardware: false,
    promotionEligible: false,
    dispatchesInfrastructure: false,
    deploysInfrastructure: false,
  });
}

function validatedArtifacts({ attention, provenance, readModel }) {
  if (!validateSolvaerOperatorAttention(attention)) {
    throw new TypeError('sealed operator attention is required');
  }
  if (!validateProvenanceGraph(provenance, { requiredTypes: ['operator-attention'] })) {
    throw new TypeError('validated operator-attention provenance is required');
  }
  if (!validateOperatorProvenanceReadModel(readModel, { graph: provenance, attention })) {
    throw new TypeError('validated operator provenance read model is required');
  }
  if (provenance.experimentId !== attention.experimentId) {
    throw new TypeError('provenance experiment does not match attention');
  }
  if (readModel.experimentId !== attention.experimentId) {
    throw new TypeError('read model experiment does not match attention');
  }
  if (readModel.snapshotId !== attention.snapshotId || readModel.requestId !== attention.requestId) {
    throw new TypeError('read model identity does not match attention');
  }

  const attentionNodes = provenance.nodes.filter((node) => node.type === 'operator-attention');
  if (attentionNodes.length !== 1) {
    throw new TypeError('exactly one operator-attention provenance node is required');
  }
  const node = attentionNodes[0];
  if (node.sourceFingerprint !== attention.attentionFingerprint) {
    throw new TypeError('operator attention fingerprint is not anchored in provenance');
  }
  if (readModel.provenanceNodeId !== node.id) {
    throw new TypeError('read model provenance node does not match the sealed attention node');
  }

  return { node };
}

function derivePackageFields({ attention, provenance, readModel }) {
  const { node } = validatedArtifacts({ attention, provenance, readModel });
  return {
    version: OPERATOR_EVIDENCE_PACKAGE_VERSION,
    experimentId: attention.experimentId,
    snapshotId: attention.snapshotId,
    requestId: attention.requestId,
    attention,
    provenance,
    readModel,
    manifest: {
      attentionFingerprint: attention.attentionFingerprint,
      provenanceNodeId: node.id,
      provenanceFingerprint: fingerprint(provenance),
      viewFingerprint: readModel.viewFingerprint,
    },
    interpretation: 'operator-evidence-package-read-only',
    safety: packageSafety(),
  };
}

function packageBody(artifacts) {
  return deepFreeze(derivePackageFields(artifacts));
}

function packageIdentity(body) {
  return {
    version: body.version,
    experimentId: body.experimentId,
    snapshotId: body.snapshotId,
    requestId: body.requestId,
    manifest: body.manifest,
    interpretation: body.interpretation,
    safety: body.safety,
  };
}

export function createOperatorEvidencePackage({ attention, provenance, readModel } = {}) {
  const body = packageBody({ attention, provenance, readModel });
  return deepFreeze({
    ...body,
    packageFingerprint: fingerprint(packageIdentity(body)),
  });
}

export function validateOperatorEvidencePackage(
  evidencePackage,
  expectedArtifacts = undefined,
) {
  try {
    const values = readExactDataObject(evidencePackage, PACKAGE_KEYS);
    if (!values) return false;
    if (values.version !== OPERATOR_EVIDENCE_PACKAGE_VERSION) return false;
    if (values.interpretation !== 'operator-evidence-package-read-only') return false;
    if (
      typeof values.packageFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(values.packageFingerprint)
    ) {
      return false;
    }

    const manifest = readExactDataObject(values.manifest, MANIFEST_KEYS);
    const safety = readExactDataObject(values.safety, SAFETY_KEYS);
    if (!manifest || !safety) return false;
    if (
      safety.advisoryOnly !== true ||
      safety.authoritative !== false ||
      safety.actuatesHardware !== false ||
      safety.promotionEligible !== false ||
      safety.dispatchesInfrastructure !== false ||
      safety.deploysInfrastructure !== false
    ) {
      return false;
    }

    const embeddedArtifacts = {
      attention: values.attention,
      provenance: values.provenance,
      readModel: values.readModel,
    };
    const expected = derivePackageFields(embeddedArtifacts);
    if (
      values.experimentId !== expected.experimentId ||
      values.snapshotId !== expected.snapshotId ||
      values.requestId !== expected.requestId
    ) {
      return false;
    }
    if (
      manifest.attentionFingerprint !== expected.manifest.attentionFingerprint ||
      manifest.provenanceNodeId !== expected.manifest.provenanceNodeId ||
      manifest.provenanceFingerprint !== expected.manifest.provenanceFingerprint ||
      manifest.viewFingerprint !== expected.manifest.viewFingerprint
    ) {
      return false;
    }
    if (expectedArtifacts !== undefined) {
      if (!expectedArtifacts || typeof expectedArtifacts !== 'object') return false;
      if (
        !canonicalEqual(values.attention, expectedArtifacts.attention) ||
        !canonicalEqual(values.provenance, expectedArtifacts.provenance) ||
        !canonicalEqual(values.readModel, expectedArtifacts.readModel)
      ) {
        return false;
      }
    }

    return values.packageFingerprint === fingerprint(packageIdentity(expected));
  } catch {
    return false;
  }
}

export { OPERATOR_EVIDENCE_PACKAGE_VERSION };
