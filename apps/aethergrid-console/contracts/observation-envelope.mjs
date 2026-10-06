/**
 * Universal Observation / Event Envelope Contract
 * Canonical standard for structured multi-domain observations across ÆTHERGRID.
 */

export function createObservationEnvelope({
  id = `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  domain,
  subdomain = null,
  providerId,
  metric,
  value,
  unit = null,
  observedAt = new Date().toISOString(),
  retrievedAt = new Date().toISOString(),
  provenance = {},
  metadata = {},
  confidence = 1.0,
  quality = 'VERIFIED'
} = {}) {
  if (!domain) throw new TypeError('Observation envelope requires domain');
  if (!providerId) throw new TypeError('Observation envelope requires providerId');
  if (!metric) throw new TypeError('Observation envelope requires metric');

  return {
    id,
    schemaVersion: '1.0.0',
    domain,
    subdomain,
    providerId,
    metric,
    value,
    unit,
    observedAt,
    retrievedAt,
    provenance: {
      live: Boolean(provenance.live),
      stale: Boolean(provenance.stale),
      fallback: Boolean(provenance.fallback),
      cacheHit: Boolean(provenance.cacheHit),
      source: provenance.source || providerId,
      attribution: provenance.attribution || null,
      ...provenance
    },
    metadata,
    confidence: Number(confidence) || 1.0,
    quality: ['VERIFIED', 'ESTIMATED', 'UNVERIFIED', 'DEGRADED'].includes(quality) ? quality : 'VERIFIED'
  };
}

export function validateObservationEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return false;
  if (typeof envelope.domain !== 'string' || !envelope.domain) return false;
  if (typeof envelope.providerId !== 'string' || !envelope.providerId) return false;
  if (typeof envelope.metric !== 'string' || !envelope.metric) return false;
  if (!('value' in envelope)) return false;
  return true;
}
