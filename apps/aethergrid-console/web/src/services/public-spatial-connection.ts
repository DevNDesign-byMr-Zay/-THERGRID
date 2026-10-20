const KEY = 'aethergrid.public-cesium-token';
export function readPublicSpatialToken(): string {
  try {
    return globalThis.localStorage?.getItem(KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}
export function savePublicSpatialToken(token: string): void {
  const value = token.trim();
  if (
    value &&
    (value.length < 20 || value.length > 4096 || /\s/.test(value) || !value.startsWith('eyJ'))
  )
    throw Error(
      'Use a Cesium ion public browser access token. Private provider keys belong in the backend.',
    );
  if (value) globalThis.localStorage.setItem(KEY, value);
  else globalThis.localStorage.removeItem(KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('aethergrid:spatial-config'));
}
