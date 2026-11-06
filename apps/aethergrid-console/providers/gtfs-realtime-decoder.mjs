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
        while (this.pos < this.buf.length && this.buf[this.pos++] & 0x80) {}
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

  readLength() {
    const length = this.readVarint();
    if (length < 0) throw new RangeError('Invalid GTFS length-delimited field');
    return length;
  }

  readString() {
    const len = this.readLength();
    const start = this.pos;
    this.pos += len;
    if (this.pos > this.buf.length) this.pos = this.buf.length;
    const slice = this.buf.subarray(start, this.pos);
    return new TextDecoder().decode(slice);
  }

  readBytes() {
    const len = this.readLength();
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
      const len = this.readLength();
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
          if (htag.fieldNumber === 1 && htag.wireType === 2)
            header.gtfsRealtimeVersion = sub.readString();
          else if (htag.fieldNumber === 2 && htag.wireType === 0)
            header.incrementality = sub.readVarint();
          else if (htag.fieldNumber === 3 && htag.wireType === 0)
            header.timestamp = sub.readVarint();
          else sub.skip(htag.wireType);
        }
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        const sub = new ProtobufReader(reader.readBytes());
        const entity = {};
        while (sub.hasMore()) {
          const etag = sub.readTag();
          if (!etag) break;
          if (etag.fieldNumber === 1 && etag.wireType === 2) entity.id = sub.readString();
          else if (etag.fieldNumber === 2 && etag.wireType === 0)
            entity.isDeleted = Boolean(sub.readVarint());
          else if (etag.fieldNumber === 3 && etag.wireType === 2)
            entity.tripUpdate = decodeTripUpdate(sub.readBytes());
          else if (etag.fieldNumber === 4 && etag.wireType === 2)
            entity.vehicle = decodeVehiclePosition(sub.readBytes());
          else if (etag.fieldNumber === 5 && etag.wireType === 2)
            entity.alert = decodeAlert(sub.readBytes());
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
    if (tag.fieldNumber === 1 && tag.wireType === 2)
      vehicle.trip = decodeTripDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 2 && tag.wireType === 2)
      vehicle.position = decodePosition(sub.readBytes());
    else if (tag.fieldNumber === 3 && tag.wireType === 0)
      vehicle.currentStopSequence = sub.readVarint();
    else if (tag.fieldNumber === 4 && tag.wireType === 0) vehicle.currentStatus = sub.readVarint();
    else if (tag.fieldNumber === 5 && tag.wireType === 0) vehicle.timestamp = sub.readVarint();
    else if (tag.fieldNumber === 7 && tag.wireType === 2) vehicle.stopId = sub.readString();
    else if (tag.fieldNumber === 8 && tag.wireType === 2)
      vehicle.vehicle = decodeVehicleDescriptor(sub.readBytes());
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
    else if (tag.fieldNumber === 4 && tag.wireType === 0)
      trip.scheduleRelationship = sub.readVarint();
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
    if (tag.fieldNumber === 1 && tag.wireType === 2)
      tu.trip = decodeTripDescriptor(sub.readBytes());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) {
      tu.stopTimeUpdate = tu.stopTimeUpdate || [];
      tu.stopTimeUpdate.push(decodeStopTimeUpdate(sub.readBytes()));
    } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
      tu.vehicle = decodeVehicleDescriptor(sub.readBytes());
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
    else if (tag.fieldNumber === 2 && tag.wireType === 2)
      stu.arrival = decodeStopTimeEvent(sub.readBytes());
    else if (tag.fieldNumber === 3 && tag.wireType === 2)
      stu.departure = decodeStopTimeEvent(sub.readBytes());
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
    else if (tag.fieldNumber === 6 && tag.wireType === 2)
      alert.headerText = decodeTranslatedString(sub.readBytes());
    else if (tag.fieldNumber === 7 && tag.wireType === 2)
      alert.descriptionText = decodeTranslatedString(sub.readBytes());
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
    else if (tag.fieldNumber === 4 && tag.wireType === 2)
      es.trip = decodeTripDescriptor(sub.readBytes());
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
