import { createProviderAdapter } from './provider-adapter.mjs';

class ProtobufReader {
  constructor(buffer) {
    this.buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
    this.pos = 0;
  }

  hasMore() {
    return this.pos < this.buf.length;
  }

  readVarint() {
    let res = 0;
    let shift = 0;
    while (this.pos < this.buf.length) {
      const b = this.buf[this.pos++];
      res |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return res;
      shift += 7;
      if (shift >= 35) {
        while (this.pos < this.buf.length && (this.buf[this.pos++] & 0x80)) {}
        return res;
      }
    }
    return res;
  }

  readTag() {
    if (!this.hasMore()) return null;
    const tag = this.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;
    return { fieldNumber, wireType };
  }

  readString() {
    const len = this.readVarint();
    const start = this.pos;
    this.pos += len;
    if (this.pos > this.buf.length) this.pos = this.buf.length;
    const slice = this.buf.subarray(start, this.pos);
    return new TextDecoder().decode(slice);
  }

  readBytes() {
    const len = this.readVarint();
    const start = this.pos;
    this.pos += len;
    if (this.pos > this.buf.length) this.pos = this.buf.length;
    return this.buf.subarray(start, this.pos);
  }

  readFloat() {
    if (this.pos + 4 > this.buf.length) {
      this.pos = this.buf.length;
      return 0;
    }
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4);
    this.pos += 4;
    return view.getFloat32(0, true);
  }

  readDouble() {
    if (this.pos + 8 > this.buf.length) {
      this.pos = this.buf.length;
      return 0;
    }
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 8);
    this.pos += 8;
    return view.getFloat64(0, true);
  }

  skip(wireType) {
    if (wireType === 0) this.readVarint();
    else if (wireType === 1) this.pos = Math.min(this.buf.length, this.pos + 8);
    else if (wireType === 2) {
      const len = this.readVarint();
      this.pos = Math.min(this.buf.length, this.pos + len);
    } else if (wireType === 5) this.pos = Math.min(this.buf.length, this.pos + 4);
  }
}

export function decodeGtfsRealtime(buffer) {
  if (!buffer) return null;
  try {
    const reader = new ProtobufReader(buffer);
    const header = {};
    const entities = [];

    while (reader.hasMore()) {
      const tag = reader.readTag();
      if (!tag) break;

      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        const sub = new ProtobufReader(reader.readBytes());
        while (sub.hasMore()) {
          const htag = sub.readTag();
          if (!htag) break;
          if (htag.fieldNumber === 1 && htag.wireType === 2) header.gtfsRealtimeVersion = sub.readString();
          else if (htag.fieldNumber === 2 && htag.wireType === 0) header.incrementality = sub.readVarint();
          else if (htag.fieldNumber === 3 && htag.wireType === 0) header.timestamp = sub.readVarint();
          else sub.skip(htag.wireType);
        }
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        const sub = new ProtobufReader(reader.readBytes());
        const entity = {};
        while (sub.hasMore()) {
          const etag = sub.readTag();
          if (!etag) break;
          if (etag.fieldNumber === 1 && etag.wireType === 2) entity.id = sub.readString();
          else if (etag.fieldNumber === 2 && etag.wireType === 0) entity.isDeleted = Boolean(sub.readVarint());
          else if (etag.fieldNumber === 3 && etag.wireType === 2) entity.tripUpdate = decodeTripUpdate(sub.readBytes());
          else if (etag.fieldNumber === 4 && etag.wireType === 2) entity.vehicle = decodeVehiclePosition(sub.readBytes());
          else if (etag.fieldNumber === 5 && etag.wireType === 2) entity.alert = decodeAlert(sub.readBytes());
          else sub.skip(etag.wireType);
        }
        entities.push(entity);
      } else {
        reader.skip(tag.wireType);
      }
    }

    return { header, entities };
  } catch {
    return null;
  }
}

function decodeVehiclePosition(bytes) {
  const sub = new ProtobufReader(bytes);
  const vehicle = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) vehicle.trip = decodeTripDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) vehicle.position = decodePosition(sub.readBytes());
    else if (tag.fieldNumber === 3 && tag.wireType === 0) vehicle.currentStopSequence = sub.readVarint();
    else if (tag.fieldNumber === 4 && tag.wireType === 2) vehicle.stopId = sub.readString();
    else if (tag.fieldNumber === 5 && tag.wireType === 0) vehicle.currentStatus = sub.readVarint();
    else if (tag.fieldNumber === 6 && tag.wireType === 0) vehicle.timestamp = sub.readVarint();
    else if (tag.fieldNumber === 8 && tag.wireType === 2) vehicle.vehicle = decodeVehicleDescriptor(sub.readBytes());
    else sub.skip(tag.wireType);
  }
  return vehicle;
}

function decodeTripDescriptor(bytes) {
  const sub = new ProtobufReader(bytes);
  const trip = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) trip.tripId = sub.readString();
    else if (tag.fieldNumber === 5 && tag.wireType === 2) trip.routeId = sub.readString();
    else if (tag.fieldNumber === 4 && tag.wireType === 0) trip.scheduleRelationship = sub.readVarint();
    else sub.skip(tag.wireType);
  }
  return trip;
}

function decodePosition(bytes) {
  const sub = new ProtobufReader(bytes);
  const pos = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 5) pos.latitude = sub.readFloat();
    else if (tag.fieldNumber === 2 && tag.wireType === 5) pos.longitude = sub.readFloat();
    else if (tag.fieldNumber === 3 && tag.wireType === 5) pos.bearing = sub.readFloat();
    else if (tag.fieldNumber === 5 && tag.wireType === 5) pos.speed = sub.readFloat();
    else sub.skip(tag.wireType);
  }
  return pos;
}

function decodeVehicleDescriptor(bytes) {
  const sub = new ProtobufReader(bytes);
  const v = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) v.id = sub.readString();
    else if (tag.fieldNumber === 2 && tag.wireType === 2) v.label = sub.readString();
    else sub.skip(tag.wireType);
  }
  return v;
}

function decodeTripUpdate(bytes) {
  const sub = new ProtobufReader(bytes);
  const tu = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) tu.trip = decodeTripDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) tu.vehicle = decodeVehicleDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 3 && tag.wireType === 2) {
      tu.stopTimeUpdate = tu.stopTimeUpdate || [];
      tu.stopTimeUpdate.push(decodeStopTimeUpdate(sub.readBytes()));
    } else if (tag.fieldNumber === 4 && tag.wireType === 0) tu.timestamp = sub.readVarint();
    else if (tag.fieldNumber === 5 && tag.wireType === 0) tu.delay = sub.readVarint();
    else sub.skip(tag.wireType);
  }
  return tu;
}

function decodeStopTimeUpdate(bytes) {
  const sub = new ProtobufReader(bytes);
  const stu = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 0) stu.stopSequence = sub.readVarint();
    else if (tag.fieldNumber === 4 && tag.wireType === 2) stu.stopId = sub.readString();
    else if (tag.fieldNumber === 2 && tag.wireType === 2) stu.arrival = decodeStopTimeEvent(sub.readBytes());
    else if (tag.fieldNumber === 3 && tag.wireType === 2) stu.departure = decodeStopTimeEvent(sub.readBytes());
    else sub.skip(tag.wireType);
  }
  return stu;
}

function decodeStopTimeEvent(bytes) {
  const sub = new ProtobufReader(bytes);
  const ste = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 0) ste.delay = sub.readVarint();
    else if (tag.fieldNumber === 2 && tag.wireType === 0) ste.time = sub.readVarint();
    else sub.skip(tag.wireType);
  }
  return ste;
}

function decodeAlert(bytes) {
  const sub = new ProtobufReader(bytes);
  const alert = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      alert.activePeriod = alert.activePeriod || [];
      alert.activePeriod.push(decodeTimeRange(sub.readBytes()));
    } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
      alert.informedEntity = alert.informedEntity || [];
      alert.informedEntity.push(decodeEntitySelector(sub.readBytes()));
    } else if (tag.fieldNumber === 3 && tag.wireType === 0) alert.cause = sub.readVarint();
    else if (tag.fieldNumber === 4 && tag.wireType === 0) alert.effect = sub.readVarint();
    else if (tag.fieldNumber === 6 && tag.wireType === 2) alert.headerText = decodeTranslatedString(sub.readBytes());
    else if (tag.fieldNumber === 7 && tag.wireType === 2) alert.descriptionText = decodeTranslatedString(sub.readBytes());
    else if (tag.fieldNumber === 8 && tag.wireType === 0) alert.severityLevel = sub.readVarint();
    else sub.skip(tag.wireType);
  }
  return alert;
}

function decodeTimeRange(bytes) {
  const sub = new ProtobufReader(bytes);
  const tr = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 0) tr.start = sub.readVarint();
    else if (tag.fieldNumber === 2 && tag.wireType === 0) tr.end = sub.readVarint();
    else sub.skip(tag.wireType);
  }
  return tr;
}

function decodeEntitySelector(bytes) {
  const sub = new ProtobufReader(bytes);
  const es = {};
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) es.agencyId = sub.readString();
    else if (tag.fieldNumber === 2 && tag.wireType === 2) es.routeId = sub.readString();
    else if (tag.fieldNumber === 3 && tag.wireType === 0) es.routeType = sub.readVarint();
    else if (tag.fieldNumber === 4 && tag.wireType === 2) es.trip = decodeTripDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 5 && tag.wireType === 2) es.stopId = sub.readString();
    else sub.skip(tag.wireType);
  }
  return es;
}

function decodeTranslatedString(bytes) {
  const sub = new ProtobufReader(bytes);
  let text = '';
  while (sub.hasMore()) {
    const tag = sub.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      const trans = new ProtobufReader(sub.readBytes());
      while (trans.hasMore()) {
        const ttag = trans.readTag();
        if (!ttag) break;
        if (ttag.fieldNumber === 1 && ttag.wireType === 2) text = trans.readString();
        else trans.skip(ttag.wireType);
      }
    } else sub.skip(tag.wireType);
  }
  return text;
}

export function createTransitRegistry(options = {}) {
  const feeds = { ...(options.feeds || options.customFeeds || {}) };

  function configured(cityId) {
    if (!cityId) return Object.keys(feeds).length > 0;
    return Boolean(feeds[String(cityId).toLowerCase()]);
  }

  async function request(params = {}, context = {}) {
    const cityId = params.cityId ? String(params.cityId).toLowerCase() : null;

    if (!cityId || !feeds[cityId]) {
      return {
        data: {
          cityId,
          status: 'unconfigured',
          message: cityId
            ? `No GTFS-Realtime feed registered for city '${cityId}'. Registered feeds: ${Object.keys(feeds).join(', ') || 'none'}`
            : 'Explicit cityId parameter is required for transit vehicles lookup.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset,
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'GTFS-RT Feed Registry (Unconfigured)',
        },
      };
    }

    const feed = feeds[cityId];
    const url = feed.feedUrl || feed.gtfsRealtimeUrl;
    const messageType = feed.messageType || 'vehicle-positions';
    const dataset =
      messageType === 'trip-updates'
        ? 'transit-trip-updates'
        : messageType === 'alerts'
          ? 'transit-alerts'
          : 'transit-vehicles';

    const fetcher = async ({ signal } = {}) => {
      if (typeof options.fetchFn === 'function') {
        const rawRes = await options.fetchFn(url);
        return rawRes;
      }

      const headers = { ...feed.headers };
      if (feed.authHeader) {
        headers['Authorization'] = feed.authHeader;
      }

      const resp = await fetch(url, { headers, signal });
      if (!resp.ok) {
        throw new Error(`GTFS-RT Feed HTTP ${resp.status}`);
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        return await resp.json();
      }

      const arrayBuffer = await resp.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    };

    const runRequest = async () => {
      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'gtfs-rt-registry',
          {
            url,
            capability: 'transit',
            dataset,
            requestId: params.requestId || context.requestId,
            ttlMs: 15000,
            attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
          },
          fetcher,
        );
        return exec.data;
      }
      return await fetcher();
    };

    let rawData;
    try {
      rawData = await runRequest();
    } catch {
      return {
        data: {
          cityId,
          agencyName: feed.agencyName || feed.agency || cityId,
          gtfsRealtimeUrl: url,
          messageType,
          status: 'feed_fetch_failed',
          message: 'Failed to retrieve GTFS-Realtime feed.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset,
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
        },
      };
    }

    let decodedMessage = null;
    let vehicles = [];
    let tripUpdates = [];
    let alerts = [];
    let feedHeaderTimestamp = null;

    if (rawData && typeof rawData === 'object' && !ArrayBuffer.isView(rawData) && !Array.isArray(rawData) && (rawData.header || rawData.entities || rawData.vehicles)) {
      decodedMessage = rawData;
      feedHeaderTimestamp = rawData.header?.timestamp || null;
      if (Array.isArray(rawData.vehicles)) {
        vehicles = rawData.vehicles;
      }
    } else if (rawData && (ArrayBuffer.isView(rawData) || rawData instanceof ArrayBuffer)) {
      decodedMessage = decodeGtfsRealtime(rawData);
    }

    if (!decodedMessage) {
      return {
        data: {
          cityId,
          agencyName: feed.agencyName || feed.agency || cityId,
          gtfsRealtimeUrl: url,
          messageType,
          status: 'feed_retrieved_undecoded',
          message: 'GTFS-Realtime binary feed retrieved but failed to decode protobuf payload.',
          vehicles: [],
          tripUpdates: [],
          alerts: [],
          live: false,
        },
        receipt: {
          provider: 'gtfs-rt-registry',
          capability: 'transit',
          dataset: 'transit-vehicles',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: `GTFS-RT Feed (${feed.agencyName || feed.agency || cityId})`,
        },
      };
    }

    feedHeaderTimestamp = decodedMessage.header?.timestamp || feedHeaderTimestamp;
    const entities = Array.isArray(decodedMessage.entities) ? decodedMessage.entities : [];

    for (const ent of entities) {
      if (ent.vehicle) {
        const v = ent.vehicle;
        vehicles.push({
          entityId: ent.id,
          agencyId: feed.agency || feed.agencyName || cityId,
          vehicleId: v.vehicle?.id || ent.id,
          tripId: v.trip?.tripId || null,
          routeId: v.trip?.routeId || null,
          latitude: Number.isFinite(v.position?.latitude) ? v.position.latitude : null,
          longitude: Number.isFinite(v.position?.longitude) ? v.position.longitude : null,
          bearing: Number.isFinite(v.position?.bearing) ? v.position.bearing : null,
          speed: Number.isFinite(v.position?.speed) ? v.position.speed : null,
          stopId: v.stopId || null,
          stopSequence: v.currentStopSequence ?? null,
          timestamp: v.timestamp || feedHeaderTimestamp || null,
          feedHeaderTimestamp,
        });
      }
      if (ent.tripUpdate) {
        const tu = ent.tripUpdate;
        tripUpdates.push({
          entityId: ent.id,
          tripId: tu.trip?.tripId || null,
          routeId: tu.trip?.routeId || null,
          scheduleRelationship: tu.trip?.scheduleRelationship ?? null,
          delay: tu.delay ?? null,
          stopTimeUpdate: tu.stopTimeUpdate || [],
          timestamp: tu.timestamp || feedHeaderTimestamp || null,
        });
      }
      if (ent.alert) {
        const a = ent.alert;
        alerts.push({
          entityId: ent.id,
          activePeriod: a.activePeriod || [],
          informedEntity: a.informedEntity || [],
          cause: a.cause ?? null,
          effect: a.effect ?? null,
          severityLevel: a.severityLevel ?? null,
          headerText: a.headerText || '',
          descriptionText: a.descriptionText || '',
        });
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const isStale = feedHeaderTimestamp ? nowSec - Number(feedHeaderTimestamp) > 300 : false;

    const data = {
      cityId,
      agencyName: feed.agencyName || feed.agency || cityId,
      gtfsRealtimeUrl: url,
      messageType,
      status: 'GTFS-Realtime Live',
      vehicles,
      tripUpdates,
      alerts,
      count: vehicles.length,
      recordCount: vehicles.length + tripUpdates.length + alerts.length,
      feedHeaderTimestamp,
      retrievedAt: new Date().toISOString(),
      live: true,
      stale: isStale,
    };

    return {
      data,
      receipt: {
        provider: 'gtfs-rt-registry',
        capability: 'transit',
        dataset,
        requestId: params.requestId || context.requestId,
        retrievedAt: data.retrievedAt,
        live: true,
        stale: isStale,
        attribution: `GTFS-RT Feed (${data.agencyName})`,
      },
    };
  }

  const adapter = createProviderAdapter({
    id: 'gtfs-rt-registry',
    name: 'GTFS-Realtime Transit Feed Registry',
    capability: 'transit',
    capabilities: ['transit', 'gtfs-realtime', 'vehicle-positions'],
    configured,
    request,
  });

  return {
    adapter,
    registerFeed: (id, feedInfo) => {
      if (id && feedInfo) {
        feeds[String(id).toLowerCase()] = feedInfo;
      }
    },
    getRegisteredFeeds: () => ({ ...feeds }),
  };
}
