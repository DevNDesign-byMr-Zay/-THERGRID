/**
 * Aviation Domain ADS-B Telemetry Provider
 * Provider-neutral ADS-B telemetry ingestion with truth state classifications.
 */

export class AviationTelemetryProvider {
  constructor(options = {}) {
    this.id = 'aviation-adsb';
    this.name = 'Aviation ADS-B Telemetry';
    this.baseUrl = options.baseUrl || 'https://api.adsb.lol/v2';
    this.cache = new Map();
    this.cacheTtlMs = options.cacheTtlMs || 10000;
  }

  getHealth() {
    return {
      providerId: this.id,
      name: this.name,
      status: 'configured',
      configured: true,
      capabilities: ['aircraft_positions', 'flight_telemetry', 'airspace_density']
    };
  }

  async getAircraftInBoundingBox({ minLat, maxLat, minLon, maxLon } = {}) {
    if (!minLat || !maxLat || !minLon || !maxLon) {
      throw new Error('Bounding box coordinates (minLat, maxLat, minLon, maxLon) are required');
    }

    const cacheKey = `${minLat},${maxLat},${minLon},${maxLon}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return {
        ...cached.data,
        truthState: 'cached',
        retrievedAt: new Date().toISOString()
      };
    }

    try {
      const url = `${this.baseUrl}/lat/${(minLat + maxLat) / 2}/lon/${(minLon + maxLon) / 2}/dist/100`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`ADS-B endpoint error: HTTP ${res.status}`);
      }

      const raw = await res.json();
      const aircraft = (raw.ac || []).map(ac => ({
        icao: ac.hex,
        callsign: (ac.flight || '').trim() || 'N/A',
        latitude: ac.lat,
        longitude: ac.lon,
        altitudeFeet: ac.alt_baro || ac.alt_geom || 0,
        groundSpeedKnots: ac.gs || 0,
        heading: ac.track || 0,
        truthState: ac.lat && ac.lon ? 'observed' : 'interpolated'
      }));

      const result = {
        success: true,
        providerId: this.id,
        count: aircraft.length,
        aircraft,
        truthState: 'observed',
        retrievedAt: new Date().toISOString()
      };

      this.cache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (err) {
      return {
        success: false,
        providerId: this.id,
        count: 0,
        aircraft: [],
        truthState: 'unavailable',
        error: err.message,
        retrievedAt: new Date().toISOString()
      };
    }
  }
}

export const defaultAviationProvider = new AviationTelemetryProvider();
