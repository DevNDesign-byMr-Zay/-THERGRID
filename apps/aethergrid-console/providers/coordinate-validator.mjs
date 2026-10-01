export function validateCoordinates(rawLat, rawLon) {
  if (
    rawLat === undefined ||
    rawLat === null ||
    rawLat === '' ||
    rawLon === undefined ||
    rawLon === null ||
    rawLon === ''
  ) {
    return {
      valid: false,
      reason: 'Latitude and longitude parameters are required.',
      code: 'missing_coordinates',
    };
  }

  const lat = Number(rawLat);
  const lon = Number(rawLon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      valid: false,
      reason: 'Latitude and longitude must be valid finite numbers.',
      code: 'invalid_coordinates',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      reason: `Latitude ${lat} is out of range. Must be between -90 and 90 degrees.`,
      code: 'invalid_coordinates',
    };
  }

  if (lon < -180 || lon > 180) {
    return {
      valid: false,
      reason: `Longitude ${lon} is out of range. Must be between -180 and 180 degrees.`,
      code: 'invalid_coordinates',
    };
  }

  return {
    valid: true,
    lat,
    lon,
  };
}
