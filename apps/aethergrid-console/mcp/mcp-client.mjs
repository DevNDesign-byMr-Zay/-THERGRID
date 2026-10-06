/**
 * MCP Client Handler
 * Connects to external or internal MCP endpoints with authorization.
 */

export class AethergridMcpClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || null;
    this.token = options.token || null;
  }

  async callTool(toolName, args = {}) {
    if (!this.endpoint) {
      throw new Error('MCP client has no configured endpoint');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      })
    });

    if (!response.ok) {
      throw new Error(`MCP remote request failed: HTTP ${response.status}`);
    }

    const json = await response.json();
    return json.result || json;
  }
}
