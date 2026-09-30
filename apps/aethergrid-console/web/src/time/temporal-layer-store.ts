import type { TemporalMode } from '../renderer/spatial-renderer';
import type { TemporalLayer, TemporalSnapshot, TimeRange } from './temporal-model';

export interface TemporalSampleReport {
  cursorIso: string;
  mode: TemporalMode;
  snapshots: ReadonlyMap<string, TemporalSnapshot>;
  unsupported: readonly string[];
  failed: ReadonlyMap<string, string>;
}

export class TemporalLayerStore {
  #layers = new Map<string, TemporalLayer>();

  register(layer: TemporalLayer): () => void {
    if (this.#layers.has(layer.id)) throw new Error(`temporal layer already registered: ${layer.id}`);
    this.#layers.set(layer.id, layer);
    return () => this.#layers.delete(layer.id);
  }

  list(): readonly TemporalLayer[] {
    return [...this.#layers.values()];
  }

  availableRange(): TimeRange | null {
    const ranges = [...this.#layers.values()]
      .map((layer) => layer.availableRange())
      .filter((range): range is TimeRange => Boolean(range));

    if (!ranges.length) return null;

    const starts = ranges.map((range) => Date.parse(range.start)).filter(Number.isFinite);
    const ends = ranges.map((range) => Date.parse(range.end)).filter(Number.isFinite);
    if (!starts.length || !ends.length) return null;

    return {
      start: new Date(Math.min(...starts)).toISOString(),
      end: new Date(Math.max(...ends)).toISOString()
    };
  }

  async sample(cursorIso: string, mode: TemporalMode): Promise<TemporalSampleReport> {
    const snapshots = new Map<string, TemporalSnapshot>();
    const failed = new Map<string, string>();
    const unsupported: string[] = [];

    await Promise.all(
      [...this.#layers.values()].map(async (layer) => {
        if (!layer.supports(cursorIso, mode)) {
          unsupported.push(layer.id);
          return;
        }
        try {
          const snapshot = await layer.sample(cursorIso, mode);
          snapshots.set(layer.id, snapshot);
        } catch (error) {
          failed.set(layer.id, error instanceof Error ? error.message : String(error));
        }
      })
    );

    return {
      cursorIso,
      mode,
      snapshots,
      unsupported,
      failed
    };
  }
}
