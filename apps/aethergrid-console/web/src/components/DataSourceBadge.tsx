import { formatDataAge, formatSourceTime } from '../utils/data-freshness';

export type DataSourceState = 'live' | 'fallback' | 'unavailable' | 'loading';

interface DataSourceBadgeProps {
  label: string;
  state: DataSourceState;
  attribution?: string | null;
  sourceTime?: string | null;
  fetchedAt?: string | null;
  timezone?: string | null;
  error?: string | null;
}

export function DataSourceBadge({
  label,
  state,
  attribution,
  sourceTime,
  fetchedAt,
  timezone,
  error
}: DataSourceBadgeProps) {
  return (
    <div className="source-badge" data-source-state={state}>
      <div className="source-badge-title">
        <span>{label}</span>
        <em>{state.toUpperCase()}</em>
      </div>
      <small>{error || attribution || 'Source state pending'}</small>
      <div className="source-time-row">
        <span>{formatSourceTime(sourceTime, timezone)}</span>
        <span>FETCHED {formatDataAge(fetchedAt)}</span>
      </div>
    </div>
  );
}
