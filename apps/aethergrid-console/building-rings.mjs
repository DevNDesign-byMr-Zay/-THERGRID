const same = (a, b) => a?.lat === b?.lat && a?.lon === b?.lon;
const valid = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Join source way fragments without inventing a closing edge across missing data. */
function stitch(parts) {
  if (parts.some(p => !Array.isArray(p) || p.length < 2 || !p.every(valid))) return null;
  const pending = parts.map(p => [...p]);
  const rings = [], signatures = new Set();
  while (pending.length) {
    const ring = pending.shift();
    while (!same(ring[0], ring.at(-1))) {
      const matches = pending.flatMap((part, index) => same(ring.at(-1), part[0]) ? [{index, reverse:false}] : same(ring.at(-1), part.at(-1)) ? [{index, reverse:true}] : []);
      if (matches.length !== 1) return null;
      const {index, reverse} = matches[0];
      const [part] = pending.splice(index, 1);
      ring.push(...(reverse ? part.reverse() : part).slice(1));
    }
    const signature = ring.slice(0,-1).map(p=>`${p.lon},${p.lat}`).sort().join('|');
    if (ring.length < 4 || signatures.has(signature)) return null;
    signatures.add(signature);
    rings.push(ring);
  }
  return rings;
}

function inside(point, ring) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat) && point.lon < (b.lon-a.lon)*(point.lat-a.lat)/(b.lat-a.lat)+a.lon) result = !result;
  }
  return result;
}

export function buildingPolygons(element) {
  if (element.type === 'way') {
    const rings = stitch([element.geometry]);
    return rings?.map(outer => ({outer, holes:[]})) ?? [];
  }
  if (element.type !== 'relation' || !Array.isArray(element.members)) return [];
  const members = element.members.filter(m => m.type === 'way');
  const outers = stitch(members.filter(m => m.role === 'outer' || !m.role).map(m => m.geometry));
  const inners = stitch(members.filter(m => m.role === 'inner').map(m => m.geometry));
  if (!outers?.length || !inners) return [];
  const polygons = outers.map(outer => ({outer, holes:[]}));
  for (const hole of inners) {
    const owners = polygons.filter(p => hole.every(point => inside(point, p.outer)));
    if (owners.length !== 1) return [];
    owners[0].holes.push(hole);
  }
  return polygons;
}
