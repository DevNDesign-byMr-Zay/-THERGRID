import { useMemo, useState } from 'react';

import type { EvidenceRecord } from '../services/evidence-client';
import type { SpatialIncident } from '../services/spatial-incidents';
import type { SpatialObservation } from '../services/spatial-comparison';
import type { SpatialWorksetItem } from '../services/spatial-workset';
import type { SpatialWorksetGeometrySummary } from '../services/spatial-workset-geometry';
import {
  addSpatialInvestigationHypothesis,
  addSpatialInvestigationNote,
  addSpatialInvestigationQuestion,
  assessSpatialInvestigationHypothesis,
  attachEvidenceToInvestigation,
  attachSpatialInvestigationContext,
  createSpatialInvestigation,
  downloadSpatialInvestigation,
  loadSpatialInvestigations,
  MAX_SPATIAL_INVESTIGATIONS,
  removeSpatialInvestigation,
  setSpatialInvestigationStatus,
  upsertSpatialInvestigation,
  type InvestigationAssessment,
  type SpatialInvestigation,
  type SpatialInvestigationStatus
} from '../services/spatial-investigation';

interface SpatialInvestigationBoardProps {
  workset: readonly SpatialWorksetItem[];
  incidents: readonly SpatialIncident[];
  observationA: SpatialObservation | null;
  observationB: SpatialObservation | null;
  geometry: SpatialWorksetGeometrySummary;
  selectedEvidence: EvidenceRecord | null;
  onAnalyze(investigation: SpatialInvestigation): void;
}

const ASSESSMENTS: readonly InvestigationAssessment[] = [
  'untested',
  'supported',
  'contradicted',
  'inconclusive'
];

const STATUSES: readonly SpatialInvestigationStatus[] = [
  'open',
  'monitoring',
  'closed'
];

export function SpatialInvestigationBoard({
  workset,
  incidents,
  observationA,
  observationB,
  geometry,
  selectedEvidence,
  onAnalyze
}: SpatialInvestigationBoardProps) {
  const [investigations, setInvestigations] =
    useState<SpatialInvestigation[]>(loadSpatialInvestigations);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadSpatialInvestigations()[0]?.id ?? null
  );
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [question, setQuestion] = useState('');
  const [note, setNote] = useState('');
  const [rationales, setRationales] = useState<Record<string, string>>({});

  const selected = useMemo(
    () =>
      investigations.find((investigation) => investigation.id === selectedId) ??
      null,
    [investigations, selectedId]
  );

  const persist = (investigation: SpatialInvestigation) => {
    const next = upsertSpatialInvestigation(investigations, investigation);
    setInvestigations(next);
    setSelectedId(investigation.id);
  };

  const create = () => {
    const investigation = createSpatialInvestigation(name, objective);
    persist(investigation);
    setName('');
    setObjective('');
  };

  const attachContext = () => {
    if (!selected) return;
    persist(
      attachSpatialInvestigationContext(selected, {
        workset,
        incidents,
        observationA,
        observationB,
        geometry,
        evidence: selectedEvidence
      })
    );
  };

  const attachEvidence = () => {
    if (!selected || !selectedEvidence) return;
    persist(attachEvidenceToInvestigation(selected, selectedEvidence));
  };

  const addHypothesis = () => {
    if (!selected || !hypothesis.trim()) return;
    persist(addSpatialInvestigationHypothesis(selected, hypothesis));
    setHypothesis('');
  };

  const addQuestion = () => {
    if (!selected || !question.trim()) return;
    persist(addSpatialInvestigationQuestion(selected, question));
    setQuestion('');
  };

  const addNote = () => {
    if (!selected || !note.trim()) return;
    persist(addSpatialInvestigationNote(selected, note));
    setNote('');
  };

  const remove = (id: string) => {
    const next = removeSpatialInvestigation(investigations, id);
    setInvestigations(next);
    setSelectedId(next[0]?.id ?? null);
  };

  return (
    <section className="spatial-investigation-board intel-context-panel">
      <div className="investigation-head">
        <span>
          <small>SPATIAL INVESTIGATION BOARD</small>
          <strong>
            {investigations.length}/{MAX_SPATIAL_INVESTIGATIONS} CASES
          </strong>
        </span>
        <em>OPERATOR</em>
      </div>

      <div className="investigation-create">
        <input
          value={name}
          maxLength={120}
          placeholder="Investigation name"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <textarea
          value={objective}
          maxLength={1000}
          placeholder="Objective / question being investigated"
          onChange={(event) => setObjective(event.currentTarget.value)}
        />
        <button type="button" onClick={create}>
          NEW INVESTIGATION
        </button>
      </div>

      {investigations.length ? (
        <div className="investigation-tabs">
          {investigations.map((investigation) => (
            <button
              key={investigation.id}
              type="button"
              className={selectedId === investigation.id ? 'active' : ''}
              onClick={() => setSelectedId(investigation.id)}
            >
              <small>{investigation.status.toUpperCase()}</small>
              <strong>{investigation.name}</strong>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <article className="investigation-case">
          <header>
            <span>
              <small>ACTIVE CASE</small>
              <strong>{selected.name}</strong>
            </span>
            <select
              value={selected.status}
              aria-label="Investigation status"
              onChange={(event) =>
                persist(
                  setSpatialInvestigationStatus(
                    selected,
                    event.currentTarget.value as SpatialInvestigationStatus
                  )
                )
              }
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.toUpperCase()}
                </option>
              ))}
            </select>
          </header>

          {selected.objective ? (
            <p className="investigation-objective">{selected.objective}</p>
          ) : null}

          <div className="investigation-reference-grid">
            <span>
              <small>ENTITIES</small>
              <strong>{selected.references.canonicalEntityIds.length}</strong>
            </span>
            <span>
              <small>INCIDENTS</small>
              <strong>{selected.references.incidentIds.length}</strong>
            </span>
            <span>
              <small>A/B CAPTURES</small>
              <strong>{selected.references.observationIds.length}</strong>
            </span>
            <span>
              <small>EVIDENCE REFS</small>
              <strong>{selected.references.evidenceReceipts.length}</strong>
            </span>
          </div>

          <div className="investigation-context-actions">
            <button type="button" onClick={attachContext}>
              ATTACH CURRENT CONTEXT
            </button>
            <button
              type="button"
              disabled={!selectedEvidence}
              onClick={attachEvidence}
              title={
                selectedEvidence
                  ? selectedEvidence.receipt || selectedEvidence.id
                  : 'Select a provenance-ledger record first'
              }
            >
              LINK SELECTED EVIDENCE
            </button>
          </div>

          {selected.geometry ? (
            <div className="investigation-geometry-ref">
              <small>GEOMETRY SNAPSHOT</small>
              <strong>
                {selected.geometry.positionedEntityCount} nodes ·{' '}
                {selected.geometry.edgeCount} analytical links ·{' '}
                {(selected.geometry.totalTreeDistanceMeters / 1000).toFixed(2)} km
              </strong>
              <span>{selected.geometry.relationshipBasis}</span>
            </div>
          ) : null}

          <div className="investigation-compose">
            <input
              value={hypothesis}
              maxLength={1000}
              placeholder="Add operator hypothesis"
              onChange={(event) => setHypothesis(event.currentTarget.value)}
            />
            <button type="button" onClick={addHypothesis}>
              ADD HYPOTHESIS
            </button>
            <input
              value={question}
              maxLength={800}
              placeholder="Add open question"
              onChange={(event) => setQuestion(event.currentTarget.value)}
            />
            <button type="button" onClick={addQuestion}>
              ADD QUESTION
            </button>
            <textarea
              value={note}
              maxLength={2000}
              placeholder="Add investigation note"
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <button type="button" onClick={addNote}>
              ADD NOTE
            </button>
          </div>

          {selected.hypotheses.length ? (
            <div className="investigation-hypotheses">
              {selected.hypotheses.map((item) => (
                <div key={item.id} data-assessment={item.assessment}>
                  <p>{item.text}</p>
                  <select
                    value={item.assessment}
                    aria-label="Hypothesis assessment"
                    onChange={(event) =>
                      persist(
                        assessSpatialInvestigationHypothesis(
                          selected,
                          item.id,
                          event.currentTarget.value as InvestigationAssessment,
                          rationales[item.id] ?? item.rationale
                        )
                      )
                    }
                  >
                    {ASSESSMENTS.map((assessment) => (
                      <option key={assessment} value={assessment}>
                        {assessment.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    value={rationales[item.id] ?? item.rationale}
                    maxLength={2000}
                    placeholder="Operator rationale"
                    onChange={(event) =>
                      setRationales((current) => ({
                        ...current,
                        [item.id]: event.currentTarget.value
                      }))
                    }
                    onBlur={() =>
                      persist(
                        assessSpatialInvestigationHypothesis(
                          selected,
                          item.id,
                          item.assessment,
                          rationales[item.id] ?? item.rationale
                        )
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          {selected.openQuestions.length ? (
            <div className="investigation-questions">
              <small>OPEN QUESTIONS</small>
              {selected.openQuestions.map((item, index) => (
                <p key={`${index}:${item}`}>{item}</p>
              ))}
            </div>
          ) : null}

          {selected.notes.length ? (
            <div className="investigation-notes">
              <small>OPERATOR NOTES</small>
              {selected.notes.slice(0, 6).map((item, index) => (
                <p key={`${index}:${item}`}>{item}</p>
              ))}
            </div>
          ) : null}

          <div className="investigation-actions">
            <button type="button" onClick={() => onAnalyze(selected)}>
              ANALYZE WITH TEAM
            </button>
            <button
              type="button"
              onClick={() => downloadSpatialInvestigation(selected)}
            >
              EXPORT CASE JSON
            </button>
            <button type="button" onClick={() => remove(selected.id)}>
              REMOVE CASE
            </button>
          </div>
        </article>
      ) : (
        <p className="investigation-empty">
          Create an investigation to organize spatial references, hypotheses,
          questions and evidence receipts.
        </p>
      )}

      <div className="analysis-boundary investigation-boundary">
        <strong>OPERATOR ASSESSMENT · NOT A VERIFIED FINDING</strong>
        <span>
          SUPPORTED / CONTRADICTED / INCONCLUSIVE are human-entered analytical
          states. Linked evidence remains a separate provenance record and must
          be inspected independently before an operational decision.
        </span>
      </div>
    </section>
  );
}
