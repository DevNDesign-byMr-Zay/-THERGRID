export interface PublicRuntimeConfig {
  spatial: {
    provider: 'cesium' | 'native-webgl';
    cesiumIonToken: string | null;
    realityEnabled: boolean;
  };
}

const developmentCesiumToken =
  (import.meta.env.VITE_AETHERGRID_CESIUM_ION_TOKEN as string | undefined)?.trim() || null;

const FALLBACK_CONFIG: PublicRuntimeConfig = {
  spatial: {
    provider: developmentCesiumToken ? 'cesium' : 'native-webgl',
    cesiumIonToken: developmentCesiumToken,
    realityEnabled: false
  }
};

export async function loadPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  try {
    const response = await fetch('/api/aethergrid/config/public', {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return FALLBACK_CONFIG;

    const payload = (await response.json()) as Partial<PublicRuntimeConfig>;
    const spatial = payload.spatial;
    if (!spatial) return FALLBACK_CONFIG;

    return {
      spatial: {
        provider: spatial.provider === 'cesium' ? 'cesium' : 'native-webgl',
        cesiumIonToken:
          typeof spatial.cesiumIonToken === 'string' && spatial.cesiumIonToken.trim()
            ? spatial.cesiumIonToken.trim()
            : developmentCesiumToken,
        realityEnabled: spatial.realityEnabled === true
      }
    };
  } catch {
    return FALLBACK_CONFIG;
  }
}
