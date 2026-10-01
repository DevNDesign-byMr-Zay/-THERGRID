import { useMemo, useState } from 'react';

import type { TemporalInstant } from '../renderer/spatial-renderer';
import type { SpatialEntityDossier } from '../services/spatial-entity-dossier';
import {
  clearSpatialIncidents,
  createSpatialIncident,
  downloadSpatialIncidents,
  MAX_SPATIAL_INCIDENTS,
  removeSpatialIncident,
  syncSpatialIncidentWorksetLink,
  updateSpatialIncidentNote,
  updateSpatialIncidentStatus,
  type SpatialIncident,
  type SpatialIncidentCategory,
  type SpatialIncidentSeverity,
  type SpatialIncidentStatus
} from '../services/spatial-incidents';

interface SpatialIncidentPanelProps {
  incidents: readonly SpatialIncident[];
  current: SpatialEntityDossier | null;
  temporal: TemporalInstant;
  region: string;
  coordinate: {
    latitude: number;
    longitude: number;
    heightMeters?: number | null;
  };
  onChange(items: SpatialIncident[]): void;
  onLocate(incident: SpatialIncident): void;
  onAnalyze(incident: SpatialIncident): void;
}

const CATEGORIES: readonly SpatialIncidentCategory[] = [
  'note',
  'incident',
  'risk',
  'maintenance',
  'infrastructure',
  'environment'
];

const SEVERITIES: readonly SpatialIncidentSeverity[] = [
  'info',
  'low',
  'medium',
  'high',
  'critical'
];

const STATUSES: readonly SpatialIncidentStatus[] = [
  'open',
  'monitoring',
  'resolved',
  'dismissed'
];

function localTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

export function SpatialIncidentPanel({
  incidents,
  current,
  temporal,
  region,
  coordinate,
  onChange,
  onLocate,
  onAnalyze
}: SpatialIncidentPanelProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] =
    useState<SpatialIncidentCategory>('note');
  const [severity, setSeverity] =
    useState<SpatialIncidentSeverity>('info');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState('');

  const summary = useMemo(
    () => ({
      open: incidents.filter((incident) => incident.status === 'open').length,
      monitoring: incidents.filter(
        (incident) => incident.status === 'monitoring'
      ).length,
      high: incidents.filter(
        (incident) =>
          incident.severity === 'high' || incident.severity === 'critical'
      ).length
    }),
    [incidents]
  );

  const addIncident = () => {
    if (!title.trim()) return;
    const anchorCoordinate = current
      ? {
          latitude:
            current.entity.position.latitude ?? coordinate.latitude,
          longitude:
            current.entity.position.longitude ?? coordinate.longitude,
          heightMeters:
            current.entity.position.heightMeters ?? coordinate.heightMeters
        }
      : coordinate;

    onChange(
      createSpatialIncident(incidents, {
        title,
        note,
        category,
        severity,
        temporal,
        region,
        dossier: current,
        coordinate: anchorCoordinate
      })
    );
    setTitle('');
    setNote('');
    setCategory('note');
    setSeverity('info');
  };

  const changeStatus = (
    incident: SpatialIncident,
    status: SpatialIncidentStatus
  ) => {
    onChange(
      updateSpatialIncidentStatus(
        incidents,
        incident.id,
        status,
        temporal.iso
      )
    );
  };

  const beginEdit = (incident: SpatialIncident) => {
    setEditingId(incident.id);
    setEditingNote(incident.note);
  };

  const saveNote = (incident: SpatialIncident) => {
    onChange(updateSpatialIncidentNote(incidents, incident.id, editingNote));
    setEditingId(null);
    setEditingNote('');
  };

  return (
    <section className="spatial-incidents intel-context-panel">
      <div className="spatial-incidents-head">
        <span>
          <small>4D OPERATOR ANNOTATIONS</small>
          <strong>
            {incidents.length}/{MAX_SPATIAL_INCIDENTS} RECORDS
          </strong>
        </span>
        <em>LOCAL</em>
      </div>

      <div className="spatial-incidents-summary">
        <span>
          <small>OPEN</small>
          <strong>{summary.open}</strong>
        </span>
        <span>
          <small>MONITORING</small>
          <strong>{summary.monitoring}</strong>
        </span>
        <span>
          <small>HIGH / CRITICAL</small>
          <strong>{summary.high}</strong>
        </span>
      </div>

      <div className="spatial-incident-compose">
        <input
          value={title}
          maxLength={160}
          placeholder={
            current
              ? `Annotate ${current.entity.displayName}`
              : 'Annotate current view anchor'
          }
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          value={note}
          maxLength={2000}
          placeholder="Operator note, observation or incident context"
          onChange={(event) => setNote(event.target.value)}
        />
        <div>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as SpatialIncidentCategory)
            }
            aria-label="Annotation category"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as SpatialIncidentSeverity)
            }
            aria-label="Annotation severity"
          >
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
          <button type="button" disabled={!title.trim()} onClick={addIncident}>
            ADD TO 4D MAP
          </button>
        </div>
        <small>
          Anchor: {current ? current.entity.canonicalId : region} ·{' '}
          {temporal.mode.toUpperCase()} · {localTime(temporal.iso)}
        </small>
      </div>

      {incidents.length ? (
        <div className="spatial-incident-list">
          {incidents.map((incident) => (
            <article
              key={incident.id}
              data-incident-severity={incident.severity}
              data-incident-status={incident.status}
            >
              <header>
                <span>
                  <small>
                    {incident.category.toUpperCase()} ·{' '}
                    {incident.severity.toUpperCase()}
                  </small>
                  <strong>{incident.title}</strong>
                </span>
                <em>{incident.status.toUpperCase()}</em>
              </header>

              <code>{incident.id}</code>
              <p>
                {incident.anchor.region} · {incident.temporalMode.toUpperCase()} ·{' '}
                {localTime(incident.observedAt)}
              </p>

              <div className="spatial-incident-links">
                <span>
                  ENTITY:{' '}
                  {incident.anchor.canonicalId ?? 'VIEW-ANCHOR ONLY'}
                </span>
                <span>
                  WORKSET:{' '}
                  {incident.linkedWorksetCanonicalId
                    ? 'LINKED'
                    : 'NOT LINKED'}
                </span>
                <span>
                  GERS: {incident.anchor.gersId ?? '—'}
                </span>
              </div>

              {editingId === incident.id ? (
                <div className="spatial-incident-note-edit">
                  <textarea
                    value={editingNote}
                    maxLength={2000}
                    onChange={(event) => setEditingNote(event.target.value)}
                  />
                  <button type="button" onClick={() => saveNote(incident)}>
                    SAVE NOTE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditingNote('');
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ) : incident.note ? (
                <p className="spatial-incident-note">{incident.note}</p>
              ) : null}

              <div className="spatial-incident-statuses">
                {STATUSES.map((status) => (
                  <button
                    type="button"
                    key={status}
                    className={incident.status === status ? 'active' : ''}
                    onClick={() => changeStatus(incident, status)}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="spatial-incident-actions">
                <button type="button" onClick={() => onLocate(incident)}>
                  LOCATE
                </button>
                <button type="button" onClick={() => onAnalyze(incident)}>
                  AUREN
                </button>
                <button type="button" onClick={() => beginEdit(incident)}>
                  NOTE
                </button>
                <button
                  type="button"
                  disabled={!incident.anchor.canonicalId}
                  onClick={() =>
                    onChange(
                      syncSpatialIncidentWorksetLink(
                        incidents,
                        incident.id
                      )
                    )
                  }
                >
                  SYNC WORKSET
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(removeSpatialIncident(incidents, incident.id))
                  }
                >
                  REMOVE
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="spatial-incidents-empty">
          No local operator annotations exist yet for this workspace.
        </p>
      )}

      {incidents.length ? (
        <div className="spatial-incidents-footer">
          <button
            type="button"
            onClick={() => downloadSpatialIncidents(incidents)}
          >
            EXPORT INCIDENTS JSON
          </button>
          <button
            type="button"
            onClick={() => onChange(clearSpatialIncidents())}
          >
            CLEAR ALL
          </button>
        </div>
      ) : null}

      <div className="analysis-boundary spatial-incidents-boundary">
        <strong>OPERATOR-CREATED · NON-AUTHORITATIVE</strong>
        <span>
          These records are local annotations, not provider telemetry,
          verified incidents, causal findings, or server evidence-ledger
          records. Status changes describe the operator record only.
        </span>
      </div>
    </section>
  );
}
