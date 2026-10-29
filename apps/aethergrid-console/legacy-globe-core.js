/* Source-compatible native WebGL globe core; runtime dependencies are injected by the legacy application. */
(() => {
  'use strict';
  function createLegacyGlobeCore({
    clamp, mat4Multiply, perspective, lookAt, isLightTheme, getSettings
  }) {
  class GlobalGlobe3DBase {
    shader(type, source) {
      const shader = this.gl.createShader(type);
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        throw new Error(this.gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    initProgram() {
      const gl = this.gl;
      const vertex = this.shader(
        gl.VERTEX_SHADER,
        `attribute vec3 a_position;
         uniform mat4 u_mvp;
         uniform float u_pointSize;
         void main(){
           gl_Position=u_mvp*vec4(a_position,1.0);
           gl_PointSize=u_pointSize;
         }`,
      );
      const fragment = this.shader(
        gl.FRAGMENT_SHADER,
        `precision mediump float;
         uniform vec4 u_color;
         uniform float u_pointMode;
         void main(){
           if(u_pointMode>0.5){
             vec2 c=gl_PointCoord-vec2(0.5);
             if(dot(c,c)>0.25) discard;
           }
           gl_FragColor=u_color;
         }`,
      );
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex);
      gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);
      this.loc = {
        pos: gl.getAttribLocation(this.program, 'a_position'),
        mvp: gl.getUniformLocation(this.program, 'u_mvp'),
        color: gl.getUniformLocation(this.program, 'u_color'),
        pointSize: gl.getUniformLocation(this.program, 'u_pointSize'),
        pointMode: gl.getUniformLocation(this.program, 'u_pointMode'),
      };
    }

    makeBuffer(data) {
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
      return { buffer, count: data.length / 3 };
    }

    spherePoint(latDeg, lonDeg, radius = 4) {
      const lat = (latDeg * Math.PI) / 180;
      const lon = (lonDeg * Math.PI) / 180;
      return [
        radius * Math.cos(lat) * Math.cos(lon),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon),
      ];
    }

    pushLine(out, a, b) {
      out.push(...a, ...b);
    }

    buildGlobe() {
      const lines = [];
      const halo = [];
      for (let lat = -75; lat <= 75; lat += 15) {
        let previous = this.spherePoint(lat, -180);
        let haloPrevious = this.spherePoint(lat, -180, 4.12);
        for (let lon = -175; lon <= 180; lon += 5) {
          const current = this.spherePoint(lat, lon);
          const haloCurrent = this.spherePoint(lat, lon, 4.12);
          this.pushLine(lines, previous, current);
          if (lat % 30 === 0) this.pushLine(halo, haloPrevious, haloCurrent);
          previous = current;
          haloPrevious = haloCurrent;
        }
      }
      for (let lon = -180; lon < 180; lon += 15) {
        let previous = this.spherePoint(-90, lon);
        let haloPrevious = this.spherePoint(-90, lon, 4.12);
        for (let lat = -85; lat <= 90; lat += 5) {
          const current = this.spherePoint(lat, lon);
          const haloCurrent = this.spherePoint(lat, lon, 4.12);
          this.pushLine(lines, previous, current);
          if (lon % 30 === 0) this.pushLine(halo, haloPrevious, haloCurrent);
          previous = current;
          haloPrevious = haloCurrent;
        }
      }
      this.gridBuffer = this.makeBuffer(lines);
      this.haloBuffer = this.makeBuffer(halo);
      this.cityBuffer = this.makeBuffer([]);
      this.liveBuffers = {
        airGood: this.makeBuffer([]),
        airModerate: this.makeBuffer([]),
        airElevated: this.makeBuffer([]),
        quakeLow: this.makeBuffer([]),
        quakeMedium: this.makeBuffer([]),
        quakeHigh: this.makeBuffer([]),
      };
      this.updateUtcSweep(true);
      this.updateSolarGeometry(true);
    }

    setCities(cities = []) {
      this.cities = cities.map((city) => ({
        ...city,
        position: this.spherePoint(Number(city.lat), Number(city.lon), 4.08),
      }));
      if (this.cityBuffer?.buffer) this.gl.deleteBuffer(this.cityBuffer.buffer);
      this.cityBuffer = this.makeBuffer(this.cities.flatMap((city) => city.position));
      this.updateSolarGeometry(true);
    }

    solarPosition(date = new Date()) {
      const year = date.getUTCFullYear();
      const start = Date.UTC(year, 0, 0);
      const today = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
      const dayOfYear = Math.max(1, Math.round((today - start) / 86400000));
      const utcHour =
        date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
      const gamma =
        (2 * Math.PI / 365) * (dayOfYear - 1 + (utcHour - 12) / 24);
      const declination =
        0.006918 -
        0.399912 * Math.cos(gamma) +
        0.070257 * Math.sin(gamma) -
        0.006758 * Math.cos(2 * gamma) +
        0.000907 * Math.sin(2 * gamma) -
        0.002697 * Math.cos(3 * gamma) +
        0.00148 * Math.sin(3 * gamma);
      const equationOfTime =
        229.18 *
        (0.000075 +
          0.001868 * Math.cos(gamma) -
          0.032077 * Math.sin(gamma) -
          0.014615 * Math.cos(2 * gamma) -
          0.040849 * Math.sin(2 * gamma));
      let subsolarLon = (720 - utcHour * 60 - equationOfTime) / 4;
      subsolarLon = ((subsolarLon + 540) % 360) - 180;
      return {
        subsolarLat: (declination * 180) / Math.PI,
        subsolarLon,
        equationOfTimeMinutes: equationOfTime,
        generatedAt: date.toISOString(),
      };
    }

    updateSolarGeometry(force = false) {
      const minute = Math.floor(Date.now() / 60000);
      if (!force && minute === this.solarMinute) return;
      this.solarMinute = minute;
      const solar = this.solarPosition(new Date());
      const sun = this.spherePoint(solar.subsolarLat, solar.subsolarLon, 1);
      const normalizeVector = (vector) => {
        const length = Math.hypot(...vector) || 1;
        return vector.map((value) => value / length);
      };
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const reference = Math.abs(sun[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
      const axisA = normalizeVector(cross(sun, reference));
      const axisB = normalizeVector(cross(sun, axisA));
      const terminator = [];
      let previous = null;
      for (let step = 0; step <= 144; step += 1) {
        const angle = (step / 144) * Math.PI * 2;
        const point = [
          (axisA[0] * Math.cos(angle) + axisB[0] * Math.sin(angle)) * 4.17,
          (axisA[1] * Math.cos(angle) + axisB[1] * Math.sin(angle)) * 4.17,
          (axisA[2] * Math.cos(angle) + axisB[2] * Math.sin(angle)) * 4.17,
        ];
        if (previous) this.pushLine(terminator, previous, point);
        previous = point;
      }
      const nightCities = [];
      for (const city of this.cities) {
        const unit = this.spherePoint(Number(city.lat), Number(city.lon), 1);
        const dot = unit[0] * sun[0] + unit[1] * sun[1] + unit[2] * sun[2];
        city.solarDaylight = dot > 0;
        if (dot <= 0) {
          nightCities.push(...this.spherePoint(Number(city.lat), Number(city.lon), 4.115));
        }
      }
      for (const item of [this.terminatorBuffer, this.sunBuffer, this.nightCityBuffer]) {
        if (item?.buffer) this.gl.deleteBuffer(item.buffer);
      }
      this.terminatorBuffer = this.makeBuffer(terminator);
      this.sunBuffer = this.makeBuffer(this.spherePoint(solar.subsolarLat, solar.subsolarLon, 4.34));
      this.nightCityBuffer = this.makeBuffer(nightCities);
      this.solarState = solar;
      this.options.onSolarUpdate?.(solar);
    }

    updateUtcSweep(force = false) {
      const minute = Math.floor(Date.now() / 60000);
      if (!force && minute === this.utcSweepMinute) return;
      this.utcSweepMinute = minute;
      const utc = new Date();
      const dayFraction =
        (utc.getUTCHours() * 3600 + utc.getUTCMinutes() * 60 + utc.getUTCSeconds()) / 86400;
      const lon = dayFraction * 360 - 180;
      const sweep = [];
      let previous = this.spherePoint(-90, lon, 4.14);
      for (let lat = -87; lat <= 90; lat += 3) {
        const current = this.spherePoint(lat, lon, 4.14);
        this.pushLine(sweep, previous, current);
        previous = current;
      }
      if (this.utcSweepBuffer?.buffer) this.gl.deleteBuffer(this.utcSweepBuffer.buffer);
      this.utcSweepBuffer = this.makeBuffer(sweep);
    }

    setLiveActivity(snapshot = null) {
      this.liveSnapshot = snapshot;
      const liveById = new Map((snapshot?.cities || []).map((city) => [city.id, city]));
      this.cities = this.cities.map((city) => ({ ...city, live: liveById.get(city.id) || null }));

      const airGood = [];
      const airModerate = [];
      const airElevated = [];
      this.cities.forEach((city) => {
        const target =
          city.live?.airQuality?.usAqi == null
            ? null
            : Number(city.live.airQuality.usAqi) <= 50
              ? airGood
              : Number(city.live.airQuality.usAqi) <= 100
                ? airModerate
                : airElevated;
        if (target) target.push(...city.position);
      });

      const quakeLow = [];
      const quakeMedium = [];
      const quakeHigh = [];
      (snapshot?.seismic?.events || []).forEach((event) => {
        const position = this.spherePoint(Number(event.lat), Number(event.lon), 4.13);
        const magnitude = Number(event.magnitude || 0);
        const target = magnitude >= 5 ? quakeHigh : magnitude >= 3.5 ? quakeMedium : quakeLow;
        target.push(...position);
      });

      for (const item of Object.values(this.liveBuffers || {})) {
        if (item?.buffer) this.gl.deleteBuffer(item.buffer);
      }
      this.liveBuffers = {
        airGood: this.makeBuffer(airGood),
        airModerate: this.makeBuffer(airModerate),
        airElevated: this.makeBuffer(airElevated),
        quakeLow: this.makeBuffer(quakeLow),
        quakeMedium: this.makeBuffer(quakeMedium),
        quakeHigh: this.makeBuffer(quakeHigh),
      };
    }


  }
    return GlobalGlobe3DBase;
  }

  Object.defineProperty(globalThis, 'AETHERGRID_LEGACY_GLOBE_CORE', {
    value: createLegacyGlobeCore,
    configurable: false,
    writable: false
  });
})();
