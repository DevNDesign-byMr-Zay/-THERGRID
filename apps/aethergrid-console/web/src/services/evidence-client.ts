export interface EvidenceRecord {
  id: string;
  title: string;
  type: string;
  age?: string;
  status?: string;
  receipt?: string;
  details?: Readonly<Record<string, unknown>>;
}

interface EvidenceListResponse {
  evidence: EvidenceRecord[];
  activity?: unknown[];
}

interface ExportResponse {
  receipt: string;
  format: string;
  advisoryOnly: boolean;
  generatedAt: string;
  state: unknown;
}

async function jsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `evidence request failed with HTTP ${response.status}`);
  }
  return payload;
}

export async function loadEvidence(): Promise<EvidenceRecord[]> {
  const payload = await jsonRequest<EvidenceListResponse>('/api/aethergrid/evidence');
  return payload.evidence || [];
}

export async function loadEvidenceRecord(id: string): Promise<EvidenceRecord> {
  const payload = await jsonRequest<{ evidence: EvidenceRecord }>(
    `/api/aethergrid/evidence/${encodeURIComponent(id)}`
  );
  return payload.evidence;
}

export async function exportEvidencePackage(): Promise<ExportResponse> {
  return jsonRequest('/api/aethergrid/export', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'evidence-package',
      requestedBy: 'aethergrid-v4-spatial-operator'
    })
  });
}

export function downloadEvidencePackage(payload: ExportResponse): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `aethergrid-evidence-${payload.generatedAt.replaceAll(':', '-').replaceAll('.', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
