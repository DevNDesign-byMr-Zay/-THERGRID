/**
 * Universal KPI Calculation Engine
 * Deterministic calculation of standard financial, energy, urban, and operational KPIs.
 */

export function calculateReturns(prices = []) {
  if (!Array.isArray(prices) || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = Number(prices[i - 1]);
    const curr = Number(prices[i]);
    if (prev <= 0 || isNaN(prev) || isNaN(curr)) continue;
    returns.push((curr - prev) / prev);
  }
  return returns;
}

export function calculateVolatility(returns = [], scale = Math.sqrt(252)) {
  if (!Array.isArray(returns) || returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev * scale;
}

export function calculateSharpeRatio(returns = [], riskFreeRate = 0.02, scale = 252) {
  if (!Array.isArray(returns) || returns.length < 2) return 0;
  const annualizedReturn = (returns.reduce((a, b) => a + b, 0) / returns.length) * scale;
  const annVol = calculateVolatility(returns, Math.sqrt(scale));
  if (annVol === 0) return 0;
  return (annualizedReturn - riskFreeRate) / annVol;
}

export function calculateValueAtRisk(returns = [], confidenceLevel = 0.95) {
  if (!Array.isArray(returns) || returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);
  return Math.abs(sorted[index] || 0);
}

export function calculateSpread(ask, bid) {
  if (typeof ask !== 'number' || typeof bid !== 'number' || ask <= 0 || bid <= 0) return 0;
  return ask - bid;
}

export function calculateEnergyEfficiencyIndex(actualMWh, baselineMWh) {
  if (!actualMWh || !baselineMWh || baselineMWh <= 0) return 1.0;
  return Number((actualMWh / baselineMWh).toFixed(4));
}
