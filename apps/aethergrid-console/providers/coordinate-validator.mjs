/**
 * Shared Coordinate Validator for ÆTHERGRID Provider Layer.
 * Enforces valid latitude [-90, 90] and longitude [-180, 180].
 */

export function validateCoordinates(latInput, lonParam) {
  let lat = latInput;
  let lon = lonParam;

  if (latInput === undefined || latInput === null || latInput === '' ||
      lonParam === undefined || lonParam === null || lonParam === '') {
    return {
      valid: false,
      code: 'invalid_coordinates',
      message: 'Explicit non-empty lat and lon parameters are required.',
    };
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lonNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lonNum < -180 ||
    lonNum > 180
  ) {
    return {
      valid: false,
      code: 'invalid_coordinates',
      message: 'Latitude must be between -90 and 90 and Longitude between -180 and 180.',
    };
  }

  return {
    valid: true,
    lat: latNum,
    lon: lonNum,
  };
}
