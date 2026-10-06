/**
 * Federal Reserve Economic Data (FRED) Macroeconomic Provider Adapter
 */

export function createFredProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_FRED_API_KEY || '';
  const baseUrl = options.baseUrl || 'https://api.stlouisfed.org/fred';

  const isConfigured = Boolean(apiKey);

  return {
    id: 'fred',
    name: 'Federal Reserve Economic Data (FRED)',

    getHealth() {
      return {
        providerId: 'fred',
        name: 'Federal Reserve Economic Data (FRED)',
        status: isConfigured ? 'configured' : 'unconfigured',
        configured: isConfigured,
        capabilities: ['macroeconomic_series', 'interest_rates', 'inflation_indices', 'gdp_observations']
      };
    },

    async getSeriesObservations(seriesId = 'FEDFUNDS') {
      if (!isConfigured) {
        return { success: false, status: 'unconfigured', error: 'FRED API key missing' };
      }

      try {
        const url = `${baseUrl}/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&file_type=json`;
        const res = await fetch(url);
        if (!res.ok) {
          return { success: false, status: 'failed', error: `FRED API request failed: HTTP ${res.status}` };
        }

        const data = await res.json();
        const rawObs = data.observations || [];
        const observations = rawObs.map(o => ({
          date: o.date,
          value: o.value === '.' ? null : Number(o.value)
        }));

        return {
          success: true,
          status: 'configured',
          seriesId,
          count: observations.length,
          observations,
          retrievedAt: new Date().toISOString()
        };
      } catch (err) {
        return { success: false, status: 'failed', error: err.message };
      }
    }
  };
}
