/**
 * Agent Tool Registry
 * Manages tool definitions and permissions for agentic runtime execution.
 */

export class AgentToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool({ name, description, parameters, handler, requiredScopes = [] }) {
    if (!name) throw new TypeError('Tool requires a name');
    if (typeof handler !== 'function') throw new TypeError('Tool requires a function handler');

    this.tools.set(name, {
      name,
      description: description || '',
      parameters: parameters || { type: 'object', properties: {} },
      handler,
      requiredScopes
    });
  }

  getTool(name) {
    return this.tools.get(name) || null;
  }

  listTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      requiredScopes: t.requiredScopes
    }));
  }

  async executeTool(name, args, context = {}) {
    const tool = this.getTool(name);
    if (!tool) throw new Error(`Tool ${name} not found`);

    if (tool.requiredScopes && tool.requiredScopes.length > 0) {
      const userScopes = context.scopes || [];
      const hasPermission = tool.requiredScopes.every(s => userScopes.includes(s) || userScopes.includes('aethergrid:admin'));
      if (!hasPermission) {
        throw new Error(`Insufficient scope to execute tool ${name}. Required: ${tool.requiredScopes.join(', ')}`);
      }
    }

    return await tool.handler(args, context);
  }
}

export const defaultAgentToolRegistry = new AgentToolRegistry();
