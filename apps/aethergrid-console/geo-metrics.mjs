import { createHash } from 'node:crypto';

function parseMetricHeight(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const numeric = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;
  if (/\b(ft|feet|foot)\b/u.test(raw) || /'\s*$/u.test(raw)) return numeric * 0.3048;
  return numeric;
}

function heightProfile(tags = {}, id = 'building') {
  const explicit = parseMetricHeight(tags.height);
  if (Number.isFinite(explicit) && explicit > 0) {
    return { heightM: Math.min(1200, explicit), source: 'height' };
  }
  const estimated = parseMetricHeight(tags.est_height);
  if (Number.isFinite(estimated) && estimated > 0) {
    return { heightM: Math.min(1200, estimated), source: 'est_height' };
  }
  const levels = Number.parseFloat(String(tags['building:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) {
    return { heightM: Math.min(1200, levels * 3.2), source: 'building:levels' };
  }
  const hash = createHash('sha256').update(String(id)).digest();
  return { heightM: 8 + (hash[0] / 255) * 34, source: 'inferred' };
}

function numericMinHeight(tags = {}) {
  const explicit = parseMetricHeight(tags.min_height);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(1200, explicit);
  const minLevel = Number.parseFloat(String(tags['building:min_level'] || ''));
  if (Number.isFinite(minLevel) && minLevel > 0) return Math.min(1200, minLevel * 3.2);
  return 0;
}

function numericRoofHeight(tags = {}) {
  const explicit = parseMetricHeight(tags['roof:height']);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(250, explicit);
  const levels = Number.parseFloat(String(tags['roof:levels'] || ''));
  if (Number.isFinite(levels) && levels > 0) return Math.min(250, levels * 3.2);
  return 0;
}

function roofHeightSource(tags = {}) {
  const explicit = parseMetricHeight(tags['roof:height']);
  if (Number.isFinite(explicit) && explicit >= 0) return 'roof:height';
  const levels = Number.parseFloat(String(tags['roof:levels'] || ''));
  return Number.isFinite(levels) && levels > 0 ? 'roof:levels' : 'inferred';
}

function numericVoltage(value) {
  const candidates = String(value || '')
    .split(';')
    .map((item) => Number.parseInt(item.replace(/[^0-9]/gu, ''), 10))
    .filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

export { heightProfile, numericMinHeight, numericRoofHeight, roofHeightSource, numericVoltage };
