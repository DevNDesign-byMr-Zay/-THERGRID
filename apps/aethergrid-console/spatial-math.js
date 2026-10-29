(() => {
  'use strict';
  // Pure legacy camera geometry, loaded before app.js in file:// and packaged HTML.
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function bilinearTerrainElevation(terrain, xM, zM) {
    const gridSize = Number(terrain?.gridSize || 0);
    const radiusM = Number(terrain?.radiusM || 0);
    const points = Array.isArray(terrain?.points) ? terrain.points : [];
    if (
      gridSize < 2 ||
      radiusM <= 0 ||
      points.length < gridSize * gridSize ||
      !Number.isFinite(Number(xM)) ||
      !Number.isFinite(Number(zM))
    ) {
      return 0;
    }
    const gridMax = gridSize - 1;
    const gx = clamp(((Number(xM) + radiusM) / (radiusM * 2)) * gridMax, 0, gridMax);
    const gz = clamp(((Number(zM) + radiusM) / (radiusM * 2)) * gridMax, 0, gridMax);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(gridMax, x0 + 1);
    const z1 = Math.min(gridMax, z0 + 1);
    const tx = gx - x0;
    const tz = gz - z0;
    const elevationAt = (row, column) => {
      const value = Number(points[row * gridSize + column]?.relativeElevationM);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    };
    const e00 = elevationAt(z0, x0);
    const e10 = elevationAt(z0, x1);
    const e01 = elevationAt(z1, x0);
    const e11 = elevationAt(z1, x1);
    const top = e00 + (e10 - e00) * tx;
    const bottom = e01 + (e11 - e01) * tx;
    return top + (bottom - top) * tz;
  }

  function mat4Multiply(a, b) {
    const output = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        output[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return output;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function orthographic(left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    return new Float32Array([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
  }

  function lookAt(eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let length = Math.hypot(zx, zy, zz) || 1;
    zx /= length;
    zy /= length;
    zz /= length;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    length = Math.hypot(xx, xy, xz) || 1;
    xx /= length;
    xy /= length;
    xz /= length;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1,
    ]);
  }

  globalThis.AETHERGRID_SPATIAL_MATH = Object.freeze({
    clamp,
    bilinearTerrainElevation,
    mat4Multiply,
    perspective,
    orthographic,
    lookAt,
  });
})();
