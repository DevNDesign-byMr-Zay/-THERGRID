interface LiveSceneBadgesProps {
  scope: 'world' | 'city';
  cityName: string;
  live: boolean;
  streamingState: { count: number; error: string | null };
  cityLoad: { spatial: boolean; environment: boolean; liveContext: boolean };
  hazardContext: {
    live: boolean;
    stale: boolean;
    alerts: readonly { event: string; severity: string | null }[];
  } | null;
  hazardError: string | null;
  transitContext: {
    unconfigured: boolean;
    stale: boolean;
    live: boolean;
    vehicles: readonly unknown[];
    agencyName: string | null;
    provider: string | null;
  } | null;
  transitError: string | null;
  hydrologyContext: {
    partial: boolean;
    stale: boolean;
    live: boolean;
    gauge: { gaugeId: string; observedStageFeet: number | null; name: string | null };
  } | null;
  hydrologyError: string | null;
}

export function LiveSceneBadges({
  scope,
  cityName,
  live,
  streamingState,
  cityLoad,
  hazardContext,
  hazardError,
  transitContext,
  transitError,
  hydrologyContext,
  hydrologyError
}: LiveSceneBadgesProps) {
  if (scope !== 'city') return null;

  return (
    <>
      {streamingState.count > 0 ? (
        <div className="city-stream-status" role="status" data-live-city-tiles={streamingState.count}>
          LIVE CITY STREAM · {streamingState.count} VISIBLE TILE{streamingState.count === 1 ? '' : 'S'} · SOURCE-BACKED
        </div>
      ) : null}
      {streamingState.error && !cityLoad.spatial ? (
        <div className="city-load-status" data-live-city-stream="degraded">
          ADJACENT CITY DATA UNAVAILABLE · CORE GEOMETRY PRESERVED
        </div>
      ) : null}
      {Object.values(cityLoad).some(Boolean) ? (
        <div className="city-load-status" aria-live="polite">
          <div>
            <span>LOADING {cityName}</span>
            <strong>{Object.values(cityLoad).filter(Boolean).length} SOURCES PENDING</strong>
          </div>
          <ul>
            <li data-ready={!cityLoad.spatial}>GEOMETRY</li>
            <li data-ready={!cityLoad.environment}>ATMOSPHERE</li>
            <li data-ready={!cityLoad.liveContext}>LIVE CONTEXT</li>
          </ul>
        </div>
      ) : null}

      {live && hazardContext && hazardContext.alerts.length > 0 ? (
        <div
          className="hazard-scene-badge"
          data-source-state={hazardContext.stale ? 'stale' : hazardContext.live ? 'live' : 'fallback'}
        >
          <span>NWS ACTIVE HAZARDS</span>
          <strong>{hazardContext.alerts.length} ALERT{hazardContext.alerts.length === 1 ? '' : 'S'}</strong>
          <small>{hazardContext.alerts[0]?.event ?? 'ACTIVE ALERT'} ·{' '}
            {hazardContext.alerts[0]?.severity ?? 'UNKNOWN'} SEVERITY</small>
        </div>
      ) : live && hazardError ? (
        <div className="hazard-scene-badge" data-source-state="unavailable">
          <span>NWS ACTIVE HAZARDS</span>
          <strong>UNAVAILABLE</strong>
          <small>{hazardError}</small>
        </div>
      ) : null}

      {live && transitContext ? (
        <div
          className="transit-scene-badge"
          data-source-state={transitContext.unconfigured ? 'unconfigured' : transitContext.stale ? 'stale' : transitContext.live ? 'live' : 'fallback'}
        >
          <span>GTFS-RT TRANSIT</span>
          <strong>{transitContext.unconfigured
            ? 'FEED NOT CONFIGURED'
            : `${transitContext.vehicles.length} VEHICLE${transitContext.vehicles.length === 1 ? '' : 'S'}`}</strong>
          <small>{transitContext.agencyName ?? transitContext.provider ?? 'GTFS-REALTIME'}{' · '}
            {transitContext.stale ? 'STALE SOURCE POSITIONS' : transitContext.live ? 'SOURCE-BACKED POSITIONS' : 'NO LIVE POSITION FEED'}</small>
        </div>
      ) : live && transitError ? (
        <div className="transit-scene-badge" data-source-state="unavailable">
          <span>GTFS-RT TRANSIT</span>
          <strong>UNAVAILABLE</strong>
          <small>{transitError}</small>
        </div>
      ) : null}

      {live && hydrologyContext ? (
        <div
          className="hydrology-scene-badge"
          data-source-state={hydrologyContext.partial ? 'partial' : hydrologyContext.stale ? 'stale' : hydrologyContext.live ? 'live' : 'fallback'}
        >
          <span>NOAA NWPS · {hydrologyContext.gauge.gaugeId}</span>
          <strong>{hydrologyContext.gauge.observedStageFeet == null
            ? 'STAGE UNAVAILABLE'
            : `${hydrologyContext.gauge.observedStageFeet.toFixed(2)} FT STAGE`}</strong>
          <small>{hydrologyContext.partial
            ? 'PARTIAL · METADATA SOURCE LIVE'
            : hydrologyContext.gauge.name ?? 'SOURCE-BACKED GAUGE'}</small>
        </div>
      ) : live && hydrologyError ? (
        <div className="hydrology-scene-badge" data-source-state="unavailable">
          <span>NOAA NWPS</span>
          <strong>UNAVAILABLE</strong>
          <small>{hydrologyError}</small>
        </div>
      ) : null}
    </>
  );
}
