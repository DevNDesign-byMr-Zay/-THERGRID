export function formatDataAge(
  isoTime: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!isoTime) return 'UNKNOWN AGE';
  const timestamp = Date.parse(isoTime);
  if (!Number.isFinite(timestamp)) return 'UNKNOWN AGE';

  const deltaSeconds = Math.max(0, Math.round((nowMs - timestamp) / 1000));
  if (deltaSeconds < 10) return 'JUST NOW';
  if (deltaSeconds < 60) return `${deltaSeconds}s AGO`;

  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m AGO`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h AGO`;

  const days = Math.round(hours / 24);
  return `${days}d AGO`;
}

export function formatSourceTime(
  isoTime: string | null | undefined,
  timezone?: string | null
): string {
  if (!isoTime) return 'SOURCE TIME —';
  const timestamp = Date.parse(isoTime);
  if (!Number.isFinite(timestamp)) return 'SOURCE TIME —';

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone || 'UTC',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
      .format(new Date(timestamp))
      .toUpperCase();
  } catch {
    return new Date(timestamp).toISOString();
  }
}
