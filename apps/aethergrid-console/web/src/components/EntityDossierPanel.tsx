import {
  downloadSpatialEntityDossier,
  type SpatialEntityDossier
} from '../services/spatial-entity-dossier';

interface EntityDossierPanelProps {
  current: SpatialEntityDossier | null;
  frozen: SpatialEntityDossier | null;
  onFreeze(): void;
  onClearFrozen(): void;
  onAnalyze(dossier: SpatialEntityDossier): void;
}

function stateLabel(dossier: SpatialEntityDossier): string {
  return dossier.entitySource.state.toUpperCase();
}

function timeLabel(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

export function EntityDossierPanel({
  current,
  frozen,
  onFreeze,
  onClearFrozen,
  onAnalyze
}: EntityDossierPanelProps) {
  const active = frozen ?? current;

  return (
    <section className="selection-card entity-dossier intel-context-panel">
      <div className="entity-dossier-head">
        <span>
          <small>ENTITY DOSSIER</small>
          <strong>{frozen ? 'FROZEN 4D SNAPSHOT' : 'ACTIVE SELECTION'}</strong>
        </span>
        {active ? (
          <em data-source-state={active.entitySource.state}>
            {stateLabel(active)}
          </em>
        ) : null}
      </div>

      {active ? (
        <>
          <div className="entity-dossier-title">
            <h3>{active.entity.displayName}</h3>
            <p>{active.entity.kind}</p>
            {frozen ? (
              <small>
                Snapshot retained independently of the active scene until cleared.
              </small>
            ) : (
              <small>ESC clears the scene selection.</small>
            )}
          </div>

          <div className="entity-dossier-badges">
            <span>{active.entity.identityBasis.toUpperCase()}</span>
            <span>
              {active.entity.crossSourceJoinReady ? 'GERS LINKED' : 'NO GERS JOIN'}
            </span>
            <span>{active.coverage.percent}% CORE COVERAGE</span>
          </div>

          <dl className="entity-dossier-grid">
            <div>
              <dt>CANONICAL ID</dt>
              <dd>{active.entity.canonicalId}</dd>
            </div>
            <div>
              <dt>SOURCE FEATURE</dt>
              <dd>{active.entity.sourceFeatureId ?? '—'}</dd>
            </div>
            <div>
              <dt>SCENE ID</dt>
              <dd>{active.entity.sceneId}</dd>
            </div>
            <div>
              <dt>LAYER</dt>
              <dd>{active.entity.layerId ?? '—'}</dd>
            </div>
            <div>
              <dt>FRAME</dt>
              <dd>{active.temporal.mode.toUpperCase()}</dd>
            </div>
            <div>
              <dt>FRAME TIME</dt>
              <dd>{timeLabel(active.temporal.iso)}</dd>
            </div>
            <div>
              <dt>ENTITY SOURCE</dt>
              <dd>{active.entitySource.provider ?? active.entity.source ?? 'UNKNOWN'}</dd>
            </div>
            <div>
              <dt>SOURCE TIME</dt>
              <dd>{timeLabel(active.entitySource.sourceTime)}</dd>
            </div>
            <div>
              <dt>LAT</dt>
              <dd>
                {active.entity.position.latitude?.toFixed(5) ?? '—'}
              </dd>
            </div>
            <div>
              <dt>LON</dt>
              <dd>
                {active.entity.position.longitude?.toFixed(5) ?? '—'}
              </dd>
            </div>
          </dl>

          <div className="entity-dossier-sources">
            <strong>CONTEXT SOURCES</strong>
            {active.contextSources.length ? (
              active.contextSources.map((source) => (
                <div key={`${source.role}:${source.provider ?? source.dataset ?? 'unknown'}`}>
                  <span>{source.role.replace('-', ' ').toUpperCase()}</span>
                  <small>{source.provider ?? source.dataset ?? 'UNKNOWN'}</small>
                  <em data-source-state={source.state}>
                    {source.state.toUpperCase()}
                  </em>
                </div>
              ))
            ) : (
              <p>No additional contextual sources are attached to this frame.</p>
            )}
          </div>

          <div className="entity-dossier-coverage">
            <strong>DATA COVERAGE</strong>
            {active.coverage.checks.map((check) => (
              <div key={check.id}>
                <span>{check.label}</span>
                <em className={check.present ? 'present' : 'missing'}>
                  {check.present ? 'PRESENT' : check.required ? 'MISSING' : 'OPTIONAL'}
                </em>
              </div>
            ))}
          </div>

          {active.operatorMeasurement ? (
            <div className="entity-dossier-measurement">
              <strong>OPERATOR MEASUREMENT</strong>
              <span>
                {(active.operatorMeasurement.distanceMeters / 1000).toFixed(3)} km ·{' '}
                {active.operatorMeasurement.bearingDegrees.toFixed(1)}°
              </span>
              <small>
                Scene context only · {active.operatorMeasurement.precision}
              </small>
            </div>
          ) : null}

          <div className="entity-dossier-observations">
            <strong>MATCHING A/B FRAMES</strong>
            {active.matchingObservations.length ? (
              active.matchingObservations.map((observation) => (
                <span key={observation.slot}>
                  {observation.slot} · {observation.temporalMode.toUpperCase()} ·{' '}
                  {timeLabel(observation.frameIso)}
                </span>
              ))
            ) : (
              <span>No captured A/B frame currently matches this canonical entity.</span>
            )}
          </div>

          <div className="entity-dossier-actions">
            {current ? (
              <button type="button" onClick={onFreeze}>
                {frozen ? 'REPLACE FROZEN SNAPSHOT' : 'FREEZE 4D SNAPSHOT'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => downloadSpatialEntityDossier(active)}
            >
              EXPORT DOSSIER JSON
            </button>
            <button type="button" onClick={() => onAnalyze(active)}>
              ANALYZE WITH AUREN
            </button>
            {frozen ? (
              <button type="button" onClick={onClearFrozen}>
                CLEAR FROZEN
              </button>
            ) : null}
          </div>

          <div className="analysis-boundary entity-dossier-boundary">
            <strong>LOCAL OPERATOR SNAPSHOT · NON-AUTHORITATIVE</strong>
            <span>{active.limitations[0]}</span>
            <span>{active.limitations[1]}</span>
          </div>
        </>
      ) : (
        <p>No feature selected and no frozen dossier retained.</p>
      )}
    </section>
  );
}
