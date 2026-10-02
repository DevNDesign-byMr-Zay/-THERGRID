import { useEffect, useMemo, useState } from 'react';

import type { SpatialEntityDossier } from '../services/spatial-entity-dossier';
import {
  clearSpatialWorkset,
  downloadSpatialWorkset,
  loadSpatialWorkset,
  MAX_SPATIAL_WORKSET_ITEMS,
  SPATIAL_WORKSET_EVENT,
  pinSpatialEntityDossier,
  removeSpatialWorksetItem,
  type SpatialWorksetItem
} from '../services/spatial-workset';

interface SpatialWorksetPanelProps {
  current: SpatialEntityDossier | null;
  onLocate(dossier: SpatialEntityDossier): void;
  onAnalyze(dossier: SpatialEntityDossier): void;
}

function sourceStateLabel(item: SpatialWorksetItem): string {
  return item.dossier.entitySource.state.toUpperCase();
}

function frameLabel(item: SpatialWorksetItem): string {
  const parsed = new Date(item.dossier.temporal.iso);
  const time = Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString()
    : item.dossier.temporal.iso;
  return `${item.dossier.temporal.mode.toUpperCase()} · ${time}`;
}

export function SpatialWorksetPanel({
  current,
  onLocate,
  onAnalyze
}: SpatialWorksetPanelProps) {
  const [items, setItems] = useState<SpatialWorksetItem[]>(loadSpatialWorkset);

  useEffect(() => {
    const sync = () => setItems(loadSpatialWorkset());
    globalThis.addEventListener?.(SPATIAL_WORKSET_EVENT, sync);
    return () => globalThis.removeEventListener?.(SPATIAL_WORKSET_EVENT, sync);
  }, []);

  const currentPinned = useMemo(
    () =>
      current
        ? items.some(
            (item) => item.canonicalId === current.entity.canonicalId
          )
        : false,
    [items, current]
  );

  const summary = useMemo(() => {
    const live = items.filter(
      (item) => item.dossier.entitySource.state === 'live'
    ).length;
    const gersLinked = items.filter(
      (item) => item.dossier.entity.crossSourceJoinReady
    ).length;
    return {
      live,
      gersLinked,
      regions: new Set(items.map((item) => item.dossier.region)).size
    };
  }, [items]);

  const pinCurrent = () => {
    if (!current) return;
    setItems(pinSpatialEntityDossier(items, current));
  };

  const remove = (canonicalId: string) => {
    setItems(removeSpatialWorksetItem(items, canonicalId));
  };

  const clear = () => {
    setItems(clearSpatialWorkset());
  };

  return (
    <section className="spatial-workset intel-context-panel">
      <div className="spatial-workset-head">
        <span>
          <small>MULTI-ENTITY WORKSET</small>
          <strong>
            {items.length}/{MAX_SPATIAL_WORKSET_ITEMS} PINNED
          </strong>
        </span>
        <button
          type="button"
          disabled={!current}
          onClick={pinCurrent}
          aria-label="Pin active entity dossier"
        >
          {currentPinned ? 'UPDATE PIN' : 'PIN ACTIVE'}
        </button>
      </div>

      {items.length ? (
        <>
          <div className="spatial-workset-summary">
            <span>
              <small>REGIONS</small>
              <strong>{summary.regions}</strong>
            </span>
            <span>
              <small>LIVE SOURCE</small>
              <strong>{summary.live}</strong>
            </span>
            <span>
              <small>GERS LINKED</small>
              <strong>{summary.gersLinked}</strong>
            </span>
          </div>

          <div className="spatial-workset-list">
            {items.map((item) => {
              const position = item.dossier.entity.position;
              const canLocate =
                position.latitude != null && position.longitude != null;

              return (
                <article key={item.canonicalId}>
                  <header>
                    <span>
                      <small>{item.dossier.entity.kind}</small>
                      <strong>{item.dossier.entity.displayName}</strong>
                    </span>
                    <em data-source-state={item.dossier.entitySource.state}>
                      {sourceStateLabel(item)}
                    </em>
                  </header>

                  <code>{item.canonicalId}</code>
                  <p>{frameLabel(item)}</p>

                  <div className="spatial-workset-tags">
                    <span>
                      {item.dossier.entity.identityBasis.toUpperCase()}
                    </span>
                    <span>{item.dossier.region}</span>
                    <span>{item.dossier.coverage.percent}% CORE</span>
                  </div>

                  <div className="spatial-workset-actions">
                    <button
                      type="button"
                      disabled={!canLocate}
                      onClick={() => onLocate(item.dossier)}
                      title={
                        canLocate
                          ? 'Navigate to stored coordinate without asserting entity reselection'
                          : 'No stored geographic position'
                      }
                    >
                      LOCATE
                    </button>
                    <button
                      type="button"
                      onClick={() => onAnalyze(item.dossier)}
                    >
                      AUREN
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.canonicalId)}
                    >
                      REMOVE
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="spatial-workset-footer">
            <button type="button" onClick={() => downloadSpatialWorkset(items)}>
              EXPORT WORKSET JSON
            </button>
            <button type="button" onClick={clear}>
              CLEAR ALL
            </button>
          </div>
        </>
      ) : (
        <p className="spatial-workset-empty">
          Pin entity dossiers to carry multiple real-world objects across city
          and time navigation.
        </p>
      )}

      <div className="analysis-boundary spatial-workset-boundary">
        <strong>LOCAL WORKSET · NON-AUTHORITATIVE</strong>
        <span>
          Pinned dossiers are frozen local snapshots. LOCATE restores only the
          stored geographic anchor; it does not claim the original source
          feature has been reselected or is still live.
        </span>
      </div>
    </section>
  );
}
