/* Legacy direct-open globe and canvas renderers. Dependency injection preserves the canonical renderer and offline contract. */
(() => {
  'use strict';
  function createLegacyVisualizers({
    clamp, mat4Multiply, perspective, lookAt, isLightTheme, getSettings
  }) {
  class GlobalGlobe3D {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = options;
      this.gl = canvas?.getContext('webgl', { antialias: true, alpha: true });
      this.yaw = 0.35;
      this.pitch = 0.28;
      this.distance = 11.5;
      this.drag = null;
      this.cities = [];
      this.selectedCity = null;
      this.currentMvp = null;
      this.selectedBuffer = null;
      this.liveSnapshot = null;
      this.liveBuffers = {};
      this.utcSweepBuffer = null;
      this.utcSweepMinute = -1;
      this.solarMinute = -1;
      this.solarState = null;
      this.terminatorBuffer = null;
      this.sunBuffer = null;
      this.nightCityBuffer = null;
      if (!this.gl) return;
      this.initProgram();
      this.buildGlobe();
      this.bindControls();
      this.resize();
      this.animate();
      addEventListener('resize', () => this.resize());
    }

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


    resize() {
      if (!this.gl || !this.canvas) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.gl.viewport(0, 0, width, height);
    }

    bindControls() {
      this.canvas.addEventListener('pointerdown', (event) => {
        this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.classList.add('dragging');
      });
      this.canvas.addEventListener('pointermove', (event) => {
        if (!this.drag) return;
        const dx = event.clientX - this.drag.x;
        const dy = event.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
        this.yaw = this.drag.yaw + dx * 0.008;
        this.pitch = clamp(this.drag.pitch + dy * 0.006, -1.15, 1.15);
      });
      const end = (event) => {
        if (!this.drag) return;
        const wasClick = !this.drag.moved;
        this.drag = null;
        this.canvas.classList.remove('dragging');
        try { this.canvas.releasePointerCapture(event.pointerId); } catch {}
        if (wasClick) this.pickCity(event.clientX, event.clientY);
      };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
      this.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.distance = clamp(this.distance + event.deltaY * 0.01, 6.6, 18);
      }, { passive: false });
      this.canvas.addEventListener('dblclick', () => {
        if (this.selectedCity) this.options.onEnterCity?.(this.selectedCity);
      });
    }

    reset() {
      this.yaw = 0.35;
      this.pitch = 0.28;
      this.distance = 11.5;
    }

    cityCameraTarget(city) {
      return {
        yaw: -((Number(city.lon) * Math.PI) / 180) - Math.PI / 2,
        pitch: clamp((Number(city.lat) * Math.PI) / 180, -1.05, 1.05),
      };
    }

    markCitySelected(city) {
      this.selectedCity = city;
      if (this.selectedBuffer?.buffer) this.gl.deleteBuffer(this.selectedBuffer.buffer);
      const position = city.position || this.spherePoint(Number(city.lat), Number(city.lon), 4.12);
      this.selectedBuffer = this.makeBuffer(position);
      this.options.onSelectCity?.(city);
    }

    focusCity(city) {
      if (!city) return;
      const target = this.cityCameraTarget(city);
      this.yaw = target.yaw;
      this.pitch = target.pitch;
      this.distance = 8.2;
      this.markCitySelected(city);
    }

    descendToCity(city, durationMs = 700) {
      if (!city) return Promise.resolve();
      const start = {
        yaw: this.yaw,
        pitch: this.pitch,
        distance: this.distance,
      };
      const target = this.cityCameraTarget(city);
      this.markCitySelected(city);
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const tick = (now) => {
          const raw = clamp((now - startedAt) / durationMs, 0, 1);
          const t = 1 - Math.pow(1 - raw, 3);
          this.yaw = start.yaw + (target.yaw - start.yaw) * t;
          this.pitch = start.pitch + (target.pitch - start.pitch) * t;
          this.distance = start.distance + (5.65 - start.distance) * t;
          if (raw < 1 && !getSettings().reducedMotion) requestAnimationFrame(tick);
          else {
            this.yaw = target.yaw;
            this.pitch = target.pitch;
            this.distance = 5.65;
            resolve();
          }
        };
        if (getSettings().reducedMotion) tick(startedAt + durationMs);
        else requestAnimationFrame(tick);
      });
    }

    projectCity(city) {
      if (!this.currentMvp || !city?.position) return null;
      const [x, y, z] = city.position;
      const matrix = this.currentMvp;
      const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
      const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
      const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
      if (clipW <= 0.001) return null;
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: rect.left + (clipX / clipW * 0.5 + 0.5) * rect.width,
        y: rect.top + (-clipY / clipW * 0.5 + 0.5) * rect.height,
      };
    }

    pickCity(clientX, clientY) {
      let best = null;
      for (const city of this.cities) {
        const point = this.projectCity(city);
        if (!point) continue;
        const distance = Math.hypot(point.x - clientX, point.y - clientY);
        if (distance < 30 && (!best || distance < best.distance)) best = { city, distance };
      }
      if (best) this.focusCity(best.city);
      return best?.city || null;
    }

    draw(item, primitive, color, pointMode = 0, pointSize = 1) {
      if (!item?.count) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
      gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.loc.pos);
      gl.uniform4fv(this.loc.color, color);
      gl.uniform1f(this.loc.pointMode, pointMode);
      gl.uniform1f(this.loc.pointSize, pointSize);
      gl.drawArrays(primitive, 0, item.count);
    }

    animate = (now = performance.now()) => {
      if (!this.gl) return;
      const gl = this.gl;
      const rect = this.canvas.getBoundingClientRect();
      const aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
      const motion = getSettings().reducedMotion ? 0 : Math.max(0.1, getSettings().animationIntensity / 100);
      if (!this.drag && motion > 0) this.yaw += 0.00018 * motion;
      this.updateUtcSweep();
      this.updateSolarGeometry();
      const eye = [
        Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
        Math.sin(this.pitch) * this.distance,
        Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
      ];
      const mvp = mat4Multiply(
        perspective(Math.PI / 3.2, aspect, 0.1, 60),
        lookAt(eye, [0, 0, 0], [0, 1, 0]),
      );
      this.currentMvp = mvp;
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (isLightTheme()) gl.clearColor(0.9, 0.94, 0.98, 1);
      else gl.clearColor(0.004, 0.015, 0.04, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.loc.mvp, false, mvp);

      const pulse = getSettings().reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0022);
      this.draw(
        this.haloBuffer,
        gl.LINES,
        isLightTheme()
          ? [0.08, 0.42, 0.62, 0.12 + pulse * 0.08]
          : [0.15, 0.72, 1, 0.13 + pulse * 0.11],
        0,
        1,
      );
      this.draw(
        this.gridBuffer,
        gl.LINES,
        isLightTheme() ? [0.06, 0.36, 0.58, 0.48] : [0.08, 0.55, 0.95, 0.52],
        0,
        1,
      );
      this.draw(
        this.utcSweepBuffer,
        gl.LINES,
        isLightTheme() ? [0.46, 0.31, 0.68, 0.38] : [0.65, 0.48, 1, 0.5],
        0,
        1,
      );
      this.draw(
        this.terminatorBuffer,
        gl.LINES,
        isLightTheme() ? [0.86, 0.47, 0.16, 0.54] : [1, 0.62, 0.2, 0.64],
        0,
        1,
      );
      this.draw(
        this.sunBuffer,
        gl.POINTS,
        [1, 0.76, 0.24, 0.96],
        1,
        12 + pulse * 5,
      );
      this.draw(
        this.nightCityBuffer,
        gl.POINTS,
        [1, 0.66, 0.26, 0.58 + pulse * 0.22],
        1,
        8 + pulse * 3,
      );

      this.draw(this.cityBuffer, gl.POINTS, [0.18, 1, 0.82, 0.62], 1, 7);
      this.draw(this.liveBuffers?.airGood, gl.POINTS, [0.22, 0.94, 0.66, 0.95], 1, 9 + pulse * 2);
      this.draw(this.liveBuffers?.airModerate, gl.POINTS, [1, 0.78, 0.22, 0.95], 1, 10 + pulse * 2);
      this.draw(this.liveBuffers?.airElevated, gl.POINTS, [1, 0.38, 0.34, 0.95], 1, 11 + pulse * 3);

      const quakePulse = getSettings().reducedMotion ? 0 : 0.5 + 0.5 * Math.sin(now * 0.0065);
      this.draw(this.liveBuffers?.quakeLow, gl.POINTS, [0.8, 0.45, 1, 0.48], 1, 4 + quakePulse * 2);
      this.draw(this.liveBuffers?.quakeMedium, gl.POINTS, [1, 0.52, 0.2, 0.72], 1, 6 + quakePulse * 4);
      this.draw(this.liveBuffers?.quakeHigh, gl.POINTS, [1, 0.24, 0.32, 0.94], 1, 9 + quakePulse * 7);

      if (this.selectedBuffer) {
        this.draw(this.selectedBuffer, gl.POINTS, [1, 0.7, 0.18, 1], 1, 16 + pulse * 4);
      }
      requestAnimationFrame(this.animate);
    };
  }

  class WaveSurface {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas?.getContext('2d');
      this.time = 0;
      if (!this.context) return;
      this.resize();
      addEventListener('resize', () => this.resize());
      this.loop();
    }

    resize() {
      if (!this.context) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, rect.width * dpr);
      this.canvas.height = Math.max(1, rect.height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    loop = () => {
      const context = this.context;
      if (!context) return;
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(width * 0.5, height * 0.58);
      for (let z = 14; z >= 0; z -= 1) {
        context.beginPath();
        for (let index = 0; index <= 72; index += 1) {
          const x = (index / 72 - 0.5) * width * 0.92;
          const depth = (z / 14 - 0.5) * 118;
          const wave =
            Math.sin(index * 0.25 + this.time + z * 0.34) * 8 +
            Math.cos(index * 0.11 - this.time * 0.7) * 5;
          const y = depth * 0.45 - wave - z * 1.1 + (x * x) / (width * width) * 30;
          if (index) context.lineTo(x, y);
          else context.moveTo(x, y);
        }
        context.strokeStyle = `hsla(${195 + z * 6},95%,62%,${0.18 + z * 0.038})`;
        context.lineWidth = 1;
        context.stroke();
      }
      context.restore();
      const motion = getSettings().reducedMotion ? 0 : getSettings().animationIntensity / 100;
      this.time += 0.018 * motion;
      requestAnimationFrame(this.loop);
    };
  }

  class ScenarioChart {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas?.getContext('2d');
      this.phase = 0;
      if (!this.context) return;
      this.resize();
      addEventListener('resize', () => this.resize());
      this.loop();
    }

    resize() {
      if (!this.context) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, rect.width * dpr);
      this.canvas.height = Math.max(1, rect.height * dpr);
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    loop = () => {
      const context = this.context;
      if (!context) return;
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(83,130,190,.22)';
      context.lineWidth = 1;
      for (let index = 0; index < 7; index += 1) {
        const y = 18 + index * (height - 36) / 6;
        context.beginPath();
        context.moveTo(36, y);
        context.lineTo(width - 12, y);
        context.stroke();
      }
      for (let index = 0; index < 9; index += 1) {
        const x = 36 + index * (width - 48) / 8;
        context.beginPath();
        context.moveTo(x, 12);
        context.lineTo(x, height - 24);
        context.stroke();
      }
      const series = [
        ['#22d8ff', 0, 0],
        ['#43ef91', -0.12, 0.6],
        ['#bd67ff', -0.18, 1.2],
        ['#ffb84d', 0.12, 2.1],
      ];
      series.forEach(([color, bias, offset]) => {
        context.beginPath();
        for (let index = 0; index <= 64; index += 1) {
          const t = index / 64;
          const base =
            0.52 +
            0.14 * Math.sin(t * Math.PI * 2 + offset) +
            0.18 * Math.exp(-Math.pow((t - 0.62) * 5, 2));
          const value = clamp(base + bias + 0.018 * Math.sin(this.phase + index * 0.45 + offset), 0.12, 0.92);
          const x = 36 + t * (width - 48);
          const y = 12 + (1 - value) * (height - 36);
          if (index) context.lineTo(x, y);
          else context.moveTo(x, y);
        }
        context.strokeStyle = color;
        context.lineWidth = 1.7;
        context.stroke();
      });
      const motion = getSettings().reducedMotion ? 0 : getSettings().animationIntensity / 100;
      this.phase += 0.01 * motion;
      requestAnimationFrame(this.loop);
    };
  }

    return Object.freeze({ GlobalGlobe3D, WaveSurface, ScenarioChart });
  }

  Object.defineProperty(globalThis, 'AETHERGRID_LEGACY_VISUALIZERS', {
    value: createLegacyVisualizers,
    configurable: false,
    writable: false
  });
})();
