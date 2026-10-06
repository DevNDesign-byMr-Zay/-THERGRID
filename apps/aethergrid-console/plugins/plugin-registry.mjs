/**
 * System Plugin Registry
 * Dynamically registers and manages capability extensions and runtime hooks.
 */

export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
  }

  registerPlugin({ id, name, version = '1.0.0', capabilities = [], hooks = {}, onInit }) {
    if (!id || !name) throw new TypeError('Plugin requires id and name');
    const entry = {
      id,
      name,
      version,
      capabilities,
      hooks,
      onInit,
      active: false
    };
    this.plugins.set(id, entry);
    return entry;
  }

  async initializePlugin(id, context = {}) {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    if (plugin.onInit && typeof plugin.onInit === 'function') {
      await plugin.onInit(context);
    }
    plugin.active = true;
    return plugin;
  }

  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      capabilities: p.capabilities,
      active: p.active
    }));
  }
}

export const defaultPluginRegistry = new PluginRegistry();
