/**
 * Universal Domain Pack SDK
 * Canonical manifest registration and domain pack interface for ÆTHERGRID.
 */

export class DomainPack {
  constructor(manifest = {}) {
    if (!manifest.id) throw new TypeError('DomainPack requires id');
    if (!manifest.name) throw new TypeError('DomainPack requires name');
    this.id = manifest.id;
    this.name = manifest.name;
    this.version = manifest.version || '1.0.0';
    this.capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
    this.providers = Array.isArray(manifest.providers) ? manifest.providers : [];
    this.kpis = Array.isArray(manifest.kpis) ? manifest.kpis : [];
  }

  getManifest() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      capabilities: this.capabilities,
      providers: this.providers,
      kpis: this.kpis
    };
  }
}

export class DomainPackRegistry {
  constructor() {
    this.packs = new Map();
  }

  register(pack) {
    if (!(pack instanceof DomainPack)) {
      pack = new DomainPack(pack);
    }
    this.packs.set(pack.id, pack);
    return pack;
  }

  get(id) {
    return this.packs.get(id) || null;
  }

  list() {
    return Array.from(this.packs.values()).map(p => p.getManifest());
  }
}

export const defaultDomainRegistry = new DomainPackRegistry();
