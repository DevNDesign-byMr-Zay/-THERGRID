export interface RadarManifest {
  provider: string;
  generatedAt: string;
  fetchedAt: string;
  stale: boolean;
  maximumLevel: number;
  attribution: string;
  attributionUrl: string;
  coverage: string;
  coverageUrl: string;
  frames: readonly { time: string; urlTemplate: string }[];
}
export function createLiveMapRuntime(options?: {
  fetchImpl?: typeof fetch;
  now?: () => number;
  clientId?: string;
  clientSecret?: string;
}): {
  aviation(query: {
    scope: 'city' | 'global';
    latitude?: number | null;
    longitude?: number | null;
    radiusKm?: number;
  }): Promise<unknown>;
  radar(): Promise<RadarManifest>;
};
