/**
 * Scoped MCP Server Handler
 * Handles Model Context Protocol tools and resources with scoped permissions.
 */

import { defaultAgentToolRegistry } from '../agents/tool-registry.mjs';

export class AethergridMcpServer {
  constructor(options = {}) {
    this.toolRegistry = options.toolRegistry || defaultAgentToolRegistry;
  }

  async handleRequest(request = {}, context = {}) {
    const { method, params } = request;

    if (method === 'tools/list') {
      const tools = this.toolRegistry.listTools();
      return {
        tools: tools.map(t => ({
          name: `aethergrid:${t.name}`,
          description: t.description,
          inputSchema: t.parameters
        }))
      };
    }

    if (method === 'tools/call') {
      const rawName = params?.name || '';
      const name = rawName.replace(/^aethergrid:/, '');
      const args = params?.arguments || {};

      try {
        const result = await this.toolRegistry.executeTool(name, args, context);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `MCP Execution Error: ${err.message}` }]
        };
      }
    }

    throw new Error(`Unsupported MCP method: ${method}`);
  }
}

export const defaultMcpServer = new AethergridMcpServer();
