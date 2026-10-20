import type { OverlayCoordinate } from './spatial-overlay';

/** S3DB default ridge follows the longest side; across reverses that orientation. */
export function rectangularRoof(ring: readonly OverlayCoordinate[], shape: string, wallM: number, topM: number, orientation: unknown): readonly (readonly OverlayCoordinate[])[] {
  if (ring.length !== 4 || !['gabled', 'hipped'].includes(shape)) return [];
  const lonScale = Math.cos(ring.reduce((sum, p) => sum + p.latitude, 0) / 4 * Math.PI / 180);
  const vectors = ring.map((p, i) => {
    const next = ring[(i + 1) % 4];
    return [(next.longitude - p.longitude) * lonScale, next.latitude - p.latitude];
  });
  const lengths = vectors.map(v => Math.hypot(...v));
  if (lengths.some(n => n <= 0)) return [];
  for (let i = 0; i < 4; i++) {
    const a = vectors[i], b = vectors[(i + 1) % 4];
    if (Math.abs(a[0] * b[0] + a[1] * b[1]) / (lengths[i] * lengths[(i + 1) % 4]) > .02) return [];
    if (Math.abs(lengths[i] - lengths[(i + 2) % 4]) / lengths[i] > .02) return [];
  }
  if (orientation != null && orientation !== '' && orientation !== 'along' && orientation !== 'across') return [];
  const across = orientation === 'across';
  const offset = (lengths[0] >= lengths[1]) !== across ? 0 : 1;
  const [a, b, c, d] = [0,1,2,3].map(i => ({...ring[(i + offset) % 4], heightMeters: wallM}));
  const middle = (p: OverlayCoordinate, q: OverlayCoordinate) => ({longitude: (p.longitude + q.longitude) / 2, latitude: (p.latitude + q.latitude) / 2, heightMeters: topM});
  const start = middle(a, d), end = middle(b, c);
  const inset = shape === 'hipped' ? Math.min(.5, lengths[(offset + 1) % 4] / (2 * lengths[offset])) : 0;
  const ridgeA = {...start, longitude: start.longitude + (end.longitude - start.longitude) * inset, latitude: start.latitude + (end.latitude - start.latitude) * inset};
  const ridgeB = {...end, longitude: end.longitude + (start.longitude - end.longitude) * inset, latitude: end.latitude + (start.latitude - end.latitude) * inset};
  // Hip roofs on square footprints converge at a single apex.
  if (inset === .5) return [[a,b,ridgeA],[b,c,ridgeA],[c,d,ridgeA],[d,a,ridgeA]];
  return [[a,b,ridgeB,ridgeA],[b,c,ridgeB],[c,d,ridgeA,ridgeB],[d,a,ridgeA]];
}
