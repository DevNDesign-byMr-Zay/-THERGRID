import { useEffect, useState } from 'react';

import {
  downloadEvidencePackage,
  exportEvidencePackage,
  loadEvidence,
  loadEvidenceRecord,
  type EvidenceRecord
} from '../services/evidence-client';

interface EvidencePanelProps {
  onSelectEvidence?(record: EvidenceRecord): void;
}

export function EvidencePanel({ onSelectEvidence }: EvidencePanelProps) {
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [selected, setSelected] = useState<EvidenceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    void loadEvidence()
      .then((items) => setRecords(items.slice(0, 8)))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const inspect = (record: EvidenceRecord) => {
    const lookup = record.receipt || record.id;
    setError(null);
    void loadEvidenceRecord(lookup)
      .then((record) => {
        setSelected(record);
        onSelectEvidence?.(record);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      );
  };

  const exportPackage = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const payload = await exportEvidencePackage();
      downloadEvidencePackage(payload);
      refresh();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="evidence-panel">
      <div className="evidence-head">
        <span>
          <small>EVIDENCE</small>
          <strong>PROVENANCE LEDGER</strong>
        </span>
        <button type="button" onClick={refresh} aria-label="Refresh evidence">
          ↻
        </button>
      </div>

      <div className="evidence-list">
        {loading ? <p>Loading evidence…</p> : null}
        {!loading && !records.length ? <p>No evidence records yet.</p> : null}
        {records.map((record) => (
          <button type="button" key={record.id} onClick={() => inspect(record)}>
            <span>
              <small>{record.type}</small>
              <strong>{record.title}</strong>
            </span>
            <em>{record.status || 'RECORDED'}</em>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="evidence-detail">
          <div>
            <small>RECEIPT</small>
            <code>{selected.receipt || selected.id}</code>
          </div>
          <pre>{JSON.stringify(selected.details || {}, null, 2)}</pre>
        </div>
      ) : null}

      <button
        className="evidence-export"
        type="button"
        onClick={() => void exportPackage()}
        disabled={exporting}
      >
        {exporting ? 'PREPARING…' : 'EXPORT EVIDENCE JSON'}
      </button>

      {error ? <div className="agent-error">{error}</div> : null}
    </section>
  );
}
