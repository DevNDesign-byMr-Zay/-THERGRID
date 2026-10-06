/**
 * Alpaca Financial Markets Provider Adapter
 * Real-time stock market data, paper account status, and paper trading execution.
 */

export function createAlpacaProvider(options = {}) {
  const apiKey = options.apiKey || process.env.AETHERGRID_ALPACA_API_KEY || '';
  const apiSecret = options.apiSecret || process.env.AETHERGRID_ALPACA_API_SECRET || '';
  const paper = options.paper !== false;
  const baseUrl = options.baseUrl || (paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets');
  const dataUrl = options.dataUrl || 'https://data.alpaca.markets';

  const isConfigured = Boolean(apiKey && apiSecret);

  function getHeaders() {
    return {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'Content-Type': 'application/json'
    };
  }

  return {
    id: 'alpaca',
    name: 'Alpaca Financial Markets',

    getHealth() {
      return {
        providerId: 'alpaca',
        name: 'Alpaca Financial Markets',
        status: isConfigured ? 'configured' : 'unconfigured',
        configured: isConfigured,
        paper,
        capabilities: ['market_quotes', 'market_bars', 'paper_account', 'paper_trading']
      };
    },

    async getAccount() {
      if (!isConfigured) {
        return { success: false, status: 'unconfigured', error: 'Alpaca API credentials missing' };
      }

      try {
        const res = await fetch(`${baseUrl}/v2/account`, { headers: getHeaders() });
        if (!res.ok) {
          const err = await res.text();
          return { success: false, status: 'failed', error: `Alpaca account failed: HTTP ${res.status}` };
        }
        const data = await res.json();
        return {
          success: true,
          status: 'configured',
          accountNumber: data.account_number,
          cash: Number(data.cash),
          portfolioValue: Number(data.portfolio_value),
          buyingPower: Number(data.buying_power),
          currency: data.currency || 'USD',
          status: data.status
        };
      } catch (err) {
        return { success: false, status: 'failed', error: err.message };
      }
    },

    async getLatestQuote(symbol = 'AAPL') {
      if (!isConfigured) {
        return { success: false, status: 'unconfigured', error: 'Alpaca API credentials missing' };
      }

      try {
        const res = await fetch(`${dataUrl}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`, { headers: getHeaders() });
        if (!res.ok) {
          return { success: false, status: 'failed', error: `Alpaca quote failed: HTTP ${res.status}` };
        }
        const data = await res.json();
        const quote = data.quote || {};
        return {
          success: true,
          status: 'configured',
          symbol,
          askPrice: Number(quote.ap || 0),
          bidPrice: Number(quote.bp || 0),
          askSize: Number(quote.as || 0),
          bidSize: Number(quote.bs || 0),
          timestamp: quote.t || new Date().toISOString()
        };
      } catch (err) {
        return { success: false, status: 'failed', error: err.message };
      }
    },

    async createPaperOrder({ symbol, qty, side = 'buy', type = 'market', timeInForce = 'gtc' } = {}) {
      if (!isConfigured) {
        return { success: false, status: 'unconfigured', error: 'Alpaca API credentials missing' };
      }
      if (!paper) {
        return { success: false, status: 'blocked', error: 'Alpaca order submission blocked: only paper trading is allowed in this environment' };
      }

      try {
        const payload = {
          symbol,
          qty: String(qty),
          side,
          type,
          time_in_force: timeInForce
        };

        const res = await fetch(`${baseUrl}/v2/orders`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, status: 'failed', error: `Alpaca paper order failed: HTTP ${res.status}: ${errText.substring(0, 100)}` };
        }

        const data = await res.json();
        return {
          success: true,
          status: 'executed',
          orderId: data.id,
          symbol: data.symbol,
          qty: Number(data.qty),
          side: data.side,
          type: data.type,
          orderStatus: data.status,
          createdAt: data.created_at
        };
      } catch (err) {
        return { success: false, status: 'failed', error: err.message };
      }
    }
  };
}
