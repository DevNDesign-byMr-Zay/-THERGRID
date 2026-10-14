import original from '@cesium/engine/Source/Core/buildModuleUrl.js?original';

const embeddedUrl = (relativeUrl: string): string => {
  const urls = (globalThis as typeof globalThis & { __AETHERGRID_ASSETS__?: Record<string, string> }).__AETHERGRID_ASSETS__;
  return urls?.[relativeUrl.replace(/\/+/g, '/')] ?? original(relativeUrl);
};

export default Object.assign(embeddedUrl, original);
