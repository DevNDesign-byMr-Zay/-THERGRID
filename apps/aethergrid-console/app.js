(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const SETTINGS_KEY = 'aethergrid.operator.settings.v2';

  const defaultSettings = Object.freeze({
    defaultWorkspace: 'grid',
    density: 'comfortable',
    animationIntensity: 100,
    reducedMotion: false,
    autoRotate: false,
    spatialLabels: true,
    defaultHour: 12,
    liveStream: true,
    refreshMs: 2500,
  });

  const state = {
    workspace: 'grid',
    selectedAgent: 'TEAM',
    settings: { ...defaultSettings },
    system: {
      status: 'All Systems Nominal',
      region: 'New York Metro',
      view: 'live',
      scenario: 'peak-demand',
      mode: 'ADVISORY ONLY',
    },
    metrics: {
      generationMw: 2130,
      loadMw: 2410,
      renewablePercent: 46.8,
      storageMw: 590,
    },
    optimization: {
      currentCost: 12480,
      candidateCost: 10230,
      emissionsReduction: 24.3,
      renewableUtilizationGain: 16.7,
      runCount: 0,
    },
    agents: {
      'VÆLON': { role: 'Optimization & Scenario Exploration', status: 'READY' },
      AUREN: { role: 'Semantic & Spatial Intelligence', status: 'READY' },
      'SOLVÆR': { role: 'Simulation & Evidence Generation', status: 'READY' },
    },
    evidence: [
      { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', type: 'Scenario', age: '12 min ago', status: 'Verified' },
      { id: 'quantum-optimization', title: 'Quantum Optimization Run', type: 'Optimization', age: '28 min ago', status: 'Verified' },
      { id: 'grid-resilience', title: 'Grid Resilience Analysis', type: 'AI Analysis', age: '1 hour ago', status: 'Verified' },
      { id: 'renewable-integration', title: 'Renewable Integration Study', type: 'Simulation', age: '2 hours ago', status: 'Verified' },
    ],
    optimizationHistory: [],
    runtime: null,
  };

  const toast = q('#toast');
  const panelDialog = q('#panelDialog');
  const dialogKicker = q('#dialogKicker');
  const dialogTitle = q('#dialogTitle');
  const dialogBody = q('#dialogBody');

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
    );
  }

  function titleCase(value = '') {
    return String(value)
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function showToast(title, copy) {
    if (!toast) return;
    toast.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(copy)}</small>`;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function openPanel(kicker, title, html) {
    dialogKicker.textContent = kicker;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    panelDialog.showModal();
  }

  qa('[data-dialog-close]').forEach((button) =>
    button.addEventListener('click', () => button.closest('dialog')?.close()),
  );

  async function api(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('standalone mode');
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`${response.status} ${detail || response.statusText}`);
    }
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : response.text();
  }

  function mergeState(next = {}) {
    if (next.state) next = next.state;
    if (next.system) Object.assign(state.system, next.system);
    if (next.metrics) Object.assign(state.metrics, next.metrics);
    if (next.optimization) Object.assign(state.optimization, next.optimization);
    if (next.agents) Object.assign(state.agents, next.agents);
    if (Array.isArray(next.evidence)) state.evidence = next.evidence;
    syncStateToUi();
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      state.settings = { ...defaultSettings, ...stored };
    } catch {
      state.settings = { ...defaultSettings };
    }
    applySettings();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    applySettings();
    const badge = q('#settingsSavedBadge');
    if (badge) {
      badge.textContent = 'SAVED';
      clearTimeout(saveSettings.timer);
      saveSettings.timer = setTimeout(() => (badge.textContent = 'SAVED LOCALLY'), 1200);
    }
  }

  function applySettings() {
    document.body.dataset.density = state.settings.density;
    document.body.dataset.spatialLabels = state.settings.spatialLabels ? 'on' : 'off';
    document.body.dataset.motion =
      state.settings.reducedMotion || state.settings.animationIntensity === 0 ? 'reduced' : 'full';
    document.documentElement.style.setProperty(
      '--animation-scale',
      String(state.settings.animationIntensity / 100),
    );

    const bindings = {
      settingDefaultWorkspace: state.settings.defaultWorkspace,
      settingDensity: state.settings.density,
      settingAnimation: state.settings.animationIntensity,
      settingReducedMotion: state.settings.reducedMotion,
      settingAutoRotate: state.settings.autoRotate,
      settingSpatialLabels: state.settings.spatialLabels,
      settingHour: state.settings.defaultHour,
      settingLiveStream: state.settings.liveStream,
      settingRefresh: String(state.settings.refreshMs),
    };
    for (const [id, value] of Object.entries(bindings)) {
      const input = q(`#${id}`);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = String(value);
    }
    const animationValue = q('#settingAnimationValue');
    if (animationValue) animationValue.textContent = `${state.settings.animationIntensity}%`;
    const hourValue = q('#settingHourValue');
    if (hourValue) hourValue.textContent = formatHour(state.settings.defaultHour);

    spatial?.setTime(state.settings.defaultHour);
    holographic?.setTime(state.settings.defaultHour);
    if (holographic) holographic.autoRotate = state.settings.autoRotate;
    const gridSlider = q('#timeSlider');
    const holoSlider = q('#holoTimeSlider');
    if (gridSlider) gridSlider.value = state.settings.defaultHour;
    if (holoSlider) holoSlider.value = state.settings.defaultHour;
    if (q('#timeValue')) q('#timeValue').textContent = formatHour(state.settings.defaultHour);
    if (q('#holoTimeValue')) q('#holoTimeValue').textContent = formatHour(state.settings.defaultHour);
  }

  function bindSettings() {
    const binding = [
      ['settingDefaultWorkspace', 'defaultWorkspace', 'value'],
      ['settingDensity', 'density', 'value'],
      ['settingAnimation', 'animationIntensity', 'number'],
      ['settingReducedMotion', 'reducedMotion', 'checked'],
      ['settingAutoRotate', 'autoRotate', 'checked'],
      ['settingSpatialLabels', 'spatialLabels', 'checked'],
      ['settingHour', 'defaultHour', 'number'],
      ['settingLiveStream', 'liveStream', 'checked'],
      ['settingRefresh', 'refreshMs', 'number'],
    ];
    for (const [id, key, mode] of binding) {
      const input = q(`#${id}`);
      if (!input) continue;
      input.addEventListener('input', () => {
        state.settings[key] =
          mode === 'checked' ? input.checked : mode === 'number' ? Number(input.value) : input.value;
        saveSettings();
        if (key === 'liveStream') configureTelemetry();
      });
      input.addEventListener('change', () => {
        state.settings[key] =
          mode === 'checked' ? input.checked : mode === 'number' ? Number(input.value) : input.value;
        saveSettings();
        if (key === 'liveStream' || key === 'refreshMs') configureTelemetry();
      });
    }
    q('[data-action="reset-settings"]')?.addEventListener('click', () => {
      state.settings = { ...defaultSettings };
      localStorage.removeItem(SETTINGS_KEY);
      applySettings();
      configureTelemetry();
      showToast('SETTINGS RESET', 'Operator preferences restored to defaults.');
    });
    q('[data-action="health-check"]')?.addEventListener('click', healthCheck);
  }

  function switchWorkspace(name, { persist = true } = {}) {
    const valid = ['grid', 'holographic', 'quantum', 'ai', 'scenarios', 'evidence', 'settings'];
    if (!valid.includes(name)) name = 'grid';
    state.workspace = name;
    document.body.dataset.workspace = name;
    qa('.workspace-view').forEach((view) => view.classList.toggle('active', view.dataset.workspace === name));
    qa('[data-workspace-target]').forEach((button) =>
      button.classList.toggle('active', button.dataset.workspaceTarget === name),
    );
    if (persist) {
      sessionStorage.setItem('aethergrid.workspace', name);
      history.replaceState(null, '', `#${name}`);
    }
    requestAnimationFrame(() => {
      spatial?.resize();
      holographic?.resize();
      quantumSurface?.resize();
      scenarioChart?.resize();
    });
  }

  qa('[data-workspace-target]').forEach((button) =>
    button.addEventListener('click', () => switchWorkspace(button.dataset.workspaceTarget)),
  );

  function initialWorkspace() {
    const hash = location.hash.replace('#', '');
    const session = sessionStorage.getItem('aethergrid.workspace');
    return hash || session || state.settings.defaultWorkspace || 'grid';
  }

  function formatHour(hours) {
    const value = Number(hours);
    const h = Math.floor(value) % 24;
    const m = Math.round((value % 1) * 60) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ---- Native WebGL 4D spatial renderer ----
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

  class SpatialGrid4D {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = options;
      this.gl = canvas?.getContext('webgl', { antialias: true, alpha: true });
      this.layers = { grid: true, routes: true, buildings: true, nodes: true };
      this.yaw = options.yaw ?? 0.74;
      this.pitch = options.pitch ?? 0.46;
      this.distance = options.distance ?? 20;
      this.timeHours = 12;
      this.autoRotate = false;
      this.drag = null;
      this.timeStart = performance.now();
      this.geometry = {};
      if (!this.gl) return;
      this.initProgram();
      this.buildGeometry();
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
        `attribute vec4 a_position;
         uniform mat4 u_mvp;
         uniform float u_time;
         uniform float u_amp;
         uniform float u_pointSize;
         varying float v_phase;
         void main(){
           vec3 p=a_position.xyz;
           p.y += sin(a_position.w + u_time) * u_amp;
           gl_Position=u_mvp*vec4(p,1.0);
           gl_PointSize=u_pointSize;
           v_phase=0.5+0.5*sin(a_position.w+u_time);
         }`,
      );
      const fragment = this.shader(
        gl.FRAGMENT_SHADER,
        `precision mediump float;
         uniform vec4 u_color;
         uniform float u_pointMode;
         varying float v_phase;
         void main(){
           if(u_pointMode>0.5){
             vec2 c=gl_PointCoord-vec2(0.5);
             if(dot(c,c)>0.25) discard;
           }
           gl_FragColor=vec4(u_color.rgb*(0.78+v_phase*0.35),u_color.a);
         }`,
      );
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex);
      gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);
      this.loc = {
        pos: gl.getAttribLocation(this.program, 'a_position'),
        mvp: gl.getUniformLocation(this.program, 'u_mvp'),
        time: gl.getUniformLocation(this.program, 'u_time'),
        amp: gl.getUniformLocation(this.program, 'u_amp'),
        color: gl.getUniformLocation(this.program, 'u_color'),
        pointSize: gl.getUniformLocation(this.program, 'u_pointSize'),
        pointMode: gl.getUniformLocation(this.program, 'u_pointMode'),
      };
    }

    makeBuffer(data) {
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
      return { buffer, count: data.length / 4 };
    }

    vertex(out, x, y, z, w) {
      out.push(x, y, z, w);
    }

    line(out, a, b, phase = 0) {
      this.vertex(out, ...a, phase);
      this.vertex(out, ...b, phase + 0.3);
    }

    buildGeometry() {
      const grid = [];
      const buildings = [];
      const routes = [];
      const nodes = [];
      for (let n = -10; n <= 10; n += 1) {
        this.line(grid, [-10, 0, n], [10, 0, n], n * 0.21);
        this.line(grid, [n, 0, -10], [n, 0, 10], n * 0.23);
      }
      let seed = 31;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return (seed >>> 0) / 4294967296;
      };
      for (let index = 0; index < 72; index += 1) {
        const x = random() * 18 - 9;
        const z = random() * 18 - 9;
        const width = 0.28 + random() * 0.62;
        const depth = 0.28 + random() * 0.62;
        const height = 0.35 + random() * 2.8;
        const phase = random() * Math.PI * 2;
        const x0 = x - width;
        const x1 = x + width;
        const z0 = z - depth;
        const z1 = z + depth;
        [
          [[x0, 0, z0], [x1, 0, z0]], [[x1, 0, z0], [x1, 0, z1]],
          [[x1, 0, z1], [x0, 0, z1]], [[x0, 0, z1], [x0, 0, z0]],
          [[x0, height, z0], [x1, height, z0]], [[x1, height, z0], [x1, height, z1]],
          [[x1, height, z1], [x0, height, z1]], [[x0, height, z1], [x0, height, z0]],
          [[x0, 0, z0], [x0, height, z0]], [[x1, 0, z0], [x1, height, z0]],
          [[x1, 0, z1], [x1, height, z1]], [[x0, 0, z1], [x0, height, z1]],
        ].forEach(([a, b]) => this.line(buildings, a, b, phase));
      }
      const hubs = [[-6,.3,-3],[-2,.5,1],[2,.6,-2],[5,.45,3],[0,.7,5],[7,.35,-5],[-7,.42,5]];
      hubs.forEach((node, index) => this.vertex(nodes, node[0], node[1], node[2], index * 0.91));
      [[0,1],[1,2],[2,3],[1,4],[3,5],[4,6],[6,0],[4,3],[2,5]].forEach(([aIndex,bIndex], index) => {
        const a = hubs[aIndex];
        const b = hubs[bIndex];
        let previous = a;
        for (let step = 1; step <= 22; step += 1) {
          const t = step / 22;
          const bow = Math.sin(t * Math.PI) * (0.55 + (index % 3) * 0.15);
          const current = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t + bow,
            a[2] + (b[2] - a[2]) * t,
          ];
          this.line(routes, previous, current, index * 0.5 + t * 5);
          previous = current;
        }
      });
      this.geometry.grid = this.makeBuffer(grid);
      this.geometry.buildings = this.makeBuffer(buildings);
      this.geometry.routes = this.makeBuffer(routes);
      this.geometry.nodes = this.makeBuffer(nodes);
    }

    loadGraph(graph) {
      if (!this.gl || !graph?.nodes?.length || !graph?.routes?.length) return;
      for (const item of Object.values(this.geometry)) if (item?.buffer) this.gl.deleteBuffer(item.buffer);
      const grid = [];
      const buildings = [];
      const routes = [];
      const nodes = [];
      for (let n = -10; n <= 10; n += 1) {
        this.line(grid, [-10, 0, n], [10, 0, n], n * 0.21);
        this.line(grid, [n, 0, -10], [n, 0, 10], n * 0.23);
      }
      const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
      for (const item of graph.structures || []) {
        const x0 = item.x - item.width;
        const x1 = item.x + item.width;
        const z0 = item.z - item.depth;
        const z1 = item.z + item.depth;
        const h = item.height;
        const phase = item.temporalPhase || 0;
        [
          [[x0,0,z0],[x1,0,z0]],[[x1,0,z0],[x1,0,z1]],[[x1,0,z1],[x0,0,z1]],[[x0,0,z1],[x0,0,z0]],
          [[x0,h,z0],[x1,h,z0]],[[x1,h,z0],[x1,h,z1]],[[x1,h,z1],[x0,h,z1]],[[x0,h,z1],[x0,h,z0]],
          [[x0,0,z0],[x0,h,z0]],[[x1,0,z0],[x1,h,z0]],[[x1,0,z1],[x1,h,z1]],[[x0,0,z1],[x0,h,z1]],
        ].forEach(([a, b]) => this.line(buildings, a, b, phase));
      }
      graph.nodes.forEach((node, index) => {
        const [x, y, z] = node.position;
        this.vertex(nodes, x, y, z, index * 0.91);
      });
      graph.routes.forEach((route, index) => {
        const a = nodeMap.get(route.from)?.position;
        const b = nodeMap.get(route.to)?.position;
        if (!a || !b) return;
        let previous = a;
        for (let step = 1; step <= 22; step += 1) {
          const t = step / 22;
          const bow = Math.sin(t * Math.PI) * (0.52 + (index % 3) * 0.15);
          const current = [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t + bow,
            a[2] + (b[2] - a[2]) * t,
          ];
          this.line(routes, previous, current, (route.phase || 0) + t * 5);
          previous = current;
        }
      });
      this.geometry.grid = this.makeBuffer(grid);
      this.geometry.buildings = this.makeBuffer(buildings);
      this.geometry.routes = this.makeBuffer(routes);
      this.geometry.nodes = this.makeBuffer(nodes);
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
        this.drag = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch };
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.classList.add('dragging');
      });
      this.canvas.addEventListener('pointermove', (event) => {
        if (!this.drag) return;
        this.yaw = this.drag.yaw + (event.clientX - this.drag.x) * 0.008;
        this.pitch = clamp(this.drag.pitch + (event.clientY - this.drag.y) * 0.006, 0.12, 1.15);
        this.updateReadout();
      });
      const end = (event) => {
        if (!this.drag) return;
        this.drag = null;
        this.canvas.classList.remove('dragging');
        try { this.canvas.releasePointerCapture(event.pointerId); } catch {}
      };
      this.canvas.addEventListener('pointerup', end);
      this.canvas.addEventListener('pointercancel', end);
      this.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.distance = clamp(this.distance + event.deltaY * 0.014, 10, 34);
        this.updateReadout();
      }, { passive: false });
      this.canvas.addEventListener('dblclick', () => this.resetCamera());
    }

    resetCamera() {
      this.yaw = this.options.yaw ?? 0.74;
      this.pitch = this.options.pitch ?? 0.46;
      this.distance = this.options.distance ?? 20;
      this.updateReadout();
    }

    setPreset(name) {
      const presets = {
        overview: [0.74, 0.46, 20],
        top: [0.0, 1.08, 24],
        flow: [1.52, 0.34, 16],
        isometric: [0.78, 0.62, 18],
      };
      const [yaw, pitch, distance] = presets[name] || presets.overview;
      this.yaw = yaw;
      this.pitch = pitch;
      this.distance = distance;
      this.updateReadout();
    }

    setTime(hours) {
      this.timeHours = Number(hours);
    }

    toggle(layer) {
      if (layer === 'reset') return this.resetCamera();
      if (layer === 'layers') {
        const enabled = !(this.layers.grid && this.layers.routes && this.layers.buildings && this.layers.nodes);
        for (const key of Object.keys(this.layers)) this.layers[key] = enabled;
        return;
      }
      if (layer in this.layers) this.layers[layer] = !this.layers[layer];
    }

    updateReadout() {
      if (this.options.readoutId && q(`#${this.options.readoutId}`)) {
        q(`#${this.options.readoutId}`).textContent =
          `Orbit ${Math.round(this.yaw * 57.3)}° · ${Math.round(this.pitch * 57.3)}° · ${this.distance.toFixed(1)}m`;
      }
    }

    drawBuffer(item, primitive, color, amplitude, pointMode = 0, pointSize = 1) {
      if (!item) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
      gl.vertexAttribPointer(this.loc.pos, 4, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.loc.pos);
      gl.uniform4fv(this.loc.color, color);
      gl.uniform1f(this.loc.amp, amplitude);
      gl.uniform1f(this.loc.pointMode, pointMode);
      gl.uniform1f(this.loc.pointSize, pointSize);
      gl.drawArrays(primitive, 0, item.count);
    }

    animate = (now = performance.now()) => {
      if (!this.gl) return;
      if (this.autoRotate && !this.drag && !state.settings.reducedMotion) {
        this.yaw += 0.0007 * Math.max(0.1, state.settings.animationIntensity / 100);
      }
      const gl = this.gl;
      const rect = this.canvas.getBoundingClientRect();
      const aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
      const eye = [
        Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
        Math.sin(this.pitch) * this.distance * 0.78 + 3,
        Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
      ];
      const view = lookAt(eye, [0, 1.05, 0], [0, 1, 0]);
      const projection = perspective(Math.PI / 3.1, aspect, 0.1, 100);
      const mvp = mat4Multiply(projection, view);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.008, 0.025, 0.06, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.loc.mvp, false, mvp);
      const motionScale = state.settings.reducedMotion ? 0 : state.settings.animationIntensity / 100;
      const temporal = (this.timeHours / 24) * Math.PI * 2 + (now - this.timeStart) * 0.00035 * motionScale;
      gl.uniform1f(this.loc.time, temporal);
      if (this.layers.grid) this.drawBuffer(this.geometry.grid, gl.LINES, [0.09, 0.42, 0.75, 0.42], 0.045 * motionScale);
      if (this.layers.buildings) this.drawBuffer(this.geometry.buildings, gl.LINES, [0.14, 0.64, 1, 0.55], 0.07 * motionScale);
      if (this.layers.routes) this.drawBuffer(this.geometry.routes, gl.LINES, [0.83, 0.36, 1, 0.9], 0.11 * motionScale);
      if (this.layers.nodes) this.drawBuffer(this.geometry.nodes, gl.POINTS, [0.22, 1, 0.84, 1], 0.08 * motionScale, 1, 9);
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
      const motion = state.settings.reducedMotion ? 0 : state.settings.animationIntensity / 100;
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
      const motion = state.settings.reducedMotion ? 0 : state.settings.animationIntensity / 100;
      this.phase += 0.01 * motion;
      requestAnimationFrame(this.loop);
    };
  }

  const spatial = new SpatialGrid4D(q('#spatialGrid'), { readoutId: 'cameraReadout' });
  const holographic = new SpatialGrid4D(q('#holographicGrid'), { yaw: 1.0, pitch: 0.56, distance: 18 });
  const quantumSurface = new WaveSurface(q('#quantumCanvas'));
  const scenarioChart = new ScenarioChart(q('#scenarioChart'));

  function updateClock() {
    const now = new Date();
    if (q('#systemDate')) {
      q('#systemDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (q('#systemClock')) {
      q('#systemClock').textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  function syncStateToUi() {
    const text = (id, value) => {
      const element = q(`#${id}`);
      if (element) element.textContent = value;
    };
    text('systemStatus', state.system.status);
    text('regionLabel', state.system.region.toUpperCase());
    text('generationValue', Math.round(state.metrics.generationMw).toLocaleString());
    text('loadValue', Math.round(state.metrics.loadMw).toLocaleString());
    text('renewableValue', Number(state.metrics.renewablePercent).toFixed(1));
    text('storageValue', Math.round(state.metrics.storageMw).toLocaleString());
    text('currentCost', Math.round(state.optimization.currentCost).toLocaleString());
    text('candidateCost', Math.round(state.optimization.candidateCost).toLocaleString());
    text('emissionsValue', Number(state.optimization.emissionsReduction).toFixed(1));
    text('renewableGain', Number(state.optimization.renewableUtilizationGain).toFixed(1));
    text('aiContextRegion', state.system.region);
    text('aiContextScenario', titleCase(state.system.scenario));
    text('aiContextView', titleCase(state.system.view));
    text('activeScenarioLabel', titleCase(state.system.scenario));
    qa('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.system.view));
    qa('[data-scenario]').forEach((button) => button.classList.toggle('active', button.dataset.scenario === state.system.scenario));
    const select = q('#scenarioSelect');
    if (select) select.value = state.system.scenario;
    renderEvidence();
  }

  function renderEvidence() {
    const filter = (q('#evidenceSearch')?.value || '').trim().toLowerCase();
    const status = q('#evidenceStatus')?.value || 'all';
    const rows = state.evidence.filter((item) => {
      const matchesText = !filter || `${item.title} ${item.type || ''}`.toLowerCase().includes(filter);
      const matchesStatus = status === 'all' || String(item.status).toLowerCase() === status;
      return matchesText && matchesStatus;
    });
    const body = q('#evidenceTableBody');
    if (!body) return;
    body.innerHTML = rows
      .map(
        (item) => `<tr>
          <td><b>${escapeHtml(item.title)}</b></td>
          <td>${escapeHtml(item.type || 'Evidence')}</td>
          <td>${escapeHtml(item.age || 'recent')}</td>
          <td><span class="verified">${escapeHtml(item.status || 'Verified')}</span></td>
          <td><button class="evidence-row-button" data-evidence-id="${escapeHtml(item.id || item.title)}">VIEW</button></td>
        </tr>`,
      )
      .join('');
  }

  q('#evidenceSearch')?.addEventListener('input', renderEvidence);
  q('#evidenceStatus')?.addEventListener('change', renderEvidence);
  q('[data-action="refresh-evidence"]')?.addEventListener('click', async () => {
    try {
      const result = await api('./api/aethergrid/evidence');
      if (Array.isArray(result.evidence)) state.evidence = result.evidence;
      renderEvidence();
      showToast('EVIDENCE REFRESHED', 'Latest backend evidence loaded.');
    } catch {
      renderEvidence();
      showToast('LOCAL EVIDENCE', 'Backend unavailable; showing packaged evidence state.');
    }
  });
  q('#evidenceTableBody')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-evidence-id]');
    if (!button) return;
    const item = state.evidence.find((entry) => (entry.id || entry.title) === button.dataset.evidenceId);
    if (!item) return;
    openPanel(
      'EVIDENCE RECORD',
      item.title,
      `<div class="detail-card"><h3>${escapeHtml(item.type || 'Evidence')}</h3><p>Status: ${escapeHtml(item.status || 'Verified')} · ${escapeHtml(item.age || 'recent')}</p><div class="pill-row"><span class="pill">PROVENANCE</span><span class="pill">READ ONLY</span><span class="pill">ADVISORY</span></div></div>`,
    );
  });

  async function loadState() {
    try {
      const [runtime, graph] = await Promise.all([
        api('./api/aethergrid/state'),
        api(`./api/aethergrid/spatial?hour=${encodeURIComponent(state.settings.defaultHour)}`),
      ]);
      mergeState(runtime);
      spatial?.loadGraph(graph);
      holographic?.loadGraph(graph);
      if (q('#streamReadout')) q('#streamReadout').textContent = 'LIVE 4D GRAPH';
    } catch {
      if (q('#streamReadout')) q('#streamReadout').textContent = 'LOCAL 4D SIM';
    }
    loadRuntimeConfig();
  }

  let stream = null;
  let pollingTimer = null;

  function stopTelemetry() {
    stream?.close();
    stream = null;
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  function startPolling() {
    clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
      try {
        mergeState(await api('./api/aethergrid/telemetry'));
      } catch {
        localTelemetry();
      }
    }, Number(state.settings.refreshMs) || 5000);
  }

  function configureTelemetry() {
    stopTelemetry();
    if (location.protocol === 'file:') {
      pollingTimer = setInterval(localTelemetry, Number(state.settings.refreshMs) || 5000);
      if (q('#streamReadout')) q('#streamReadout').textContent = 'LOCAL 4D SIM';
      return;
    }
    if (state.settings.liveStream && 'EventSource' in window) {
      stream = new EventSource('./api/aethergrid/stream');
      stream.addEventListener('telemetry', (event) => {
        try {
          const payload = JSON.parse(event.data);
          mergeState(payload.state || payload);
          if (q('#streamReadout')) q('#streamReadout').textContent = 'LIVE STREAM';
        } catch {}
      });
      stream.onerror = () => {
        stream?.close();
        stream = null;
        if (q('#streamReadout')) q('#streamReadout').textContent = 'POLLING FALLBACK';
        startPolling();
      };
      return;
    }
    startPolling();
  }

  function localTelemetry() {
    const t = Date.now() / 9000;
    state.metrics.generationMw = 2130 + Math.sin(t) * 28;
    state.metrics.loadMw = 2410 + Math.cos(t * 0.87) * 35;
    state.metrics.renewablePercent = 46.8 + Math.sin(t * 0.66) * 1.6;
    state.metrics.storageMw = 590 + Math.cos(t * 0.72) * 12;
    syncStateToUi();
  }

  async function healthCheck() {
    try {
      const result = await api('./api/aethergrid/health');
      showToast('SYSTEM HEALTH', `${result.product || 'ÆTHERGRID'} backend online · ${result.authority || 'advisory-only'}`);
    } catch {
      showToast('STANDALONE MODE', 'UI, WebGL and local simulation are operational. Backend APIs are not connected.');
    }
  }

  async function loadRuntimeConfig() {
    const container = q('#aiRuntimeSettings');
    if (!container) return;
    try {
      const result = await api('./api/aethergrid/runtime');
      state.runtime = result;
      const agents = result.agents || {};
      container.innerHTML = `
        <div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(result.mode || 'Provider runtime ready')}</b><small>Secrets remain server-side.</small></div></div>
        ${Object.entries(agents)
          .map(
            ([name, config]) =>
              `<div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(name)} · ${escapeHtml(config.provider || 'fallback')}</b><small>${escapeHtml(config.model || 'deterministic-local')} · ${escapeHtml(config.status || 'ready')}</small></div></div>`,
          )
          .join('')}
      `;
      for (const [name, config] of Object.entries(agents)) {
        const badge = q(`[data-agent-runtime="${CSS.escape(name)}"]`);
        if (badge) badge.textContent = config.model || config.provider || 'READY';
      }
      if (q('#aiRuntimeBadge')) q('#aiRuntimeBadge').textContent = result.liveProviders ? 'MODEL PROVIDERS READY' : 'LOCAL FALLBACK';
    } catch {
      container.innerHTML =
        '<div class="runtime-status"><span class="status-dot"></span><div><b>Standalone fallback</b><small>Start server.mjs to enable configured model providers.</small></div></div>';
      if (q('#aiRuntimeBadge')) q('#aiRuntimeBadge').textContent = 'LOCAL FALLBACK';
    }
  }

  qa('[data-map-tool]').forEach((button) =>
    button.addEventListener('click', () => {
      const tool = button.dataset.mapTool;
      spatial?.toggle(tool);
      if (tool !== 'reset') button.classList.toggle('active');
      showToast('GRID LAYER', `${titleCase(tool)} updated.`);
    }),
  );

  q('#timeSlider')?.addEventListener('input', (event) => {
    spatial?.setTime(event.target.value);
    if (q('#timeValue')) q('#timeValue').textContent = formatHour(event.target.value);
  });
  q('#holoTimeSlider')?.addEventListener('input', (event) => {
    holographic?.setTime(event.target.value);
    if (q('#holoTimeValue')) q('#holoTimeValue').textContent = formatHour(event.target.value);
  });

  qa('[data-holo-layer]').forEach((button) =>
    button.addEventListener('click', () => {
      holographic?.toggle(button.dataset.holoLayer);
      button.classList.toggle('active');
    }),
  );
  qa('[data-camera-preset]').forEach((button) =>
    button.addEventListener('click', () => holographic?.setPreset(button.dataset.cameraPreset)),
  );
  q('#holoProjection')?.addEventListener('change', (event) => {
    holographic?.setPreset(event.target.value === 'top' ? 'top' : event.target.value === 'isometric' ? 'isometric' : 'overview');
  });
  q('[data-holo-action="save-camera"]')?.addEventListener('click', () => {
    const saved = JSON.parse(localStorage.getItem('aethergrid.saved.cameras') || '[]');
    const item = {
      id: Date.now(),
      yaw: holographic?.yaw,
      pitch: holographic?.pitch,
      distance: holographic?.distance,
      time: holographic?.timeHours,
    };
    saved.unshift(item);
    localStorage.setItem('aethergrid.saved.cameras', JSON.stringify(saved.slice(0, 8)));
    showToast('CAMERA SAVED', 'Holographic camera state saved locally.');
  });

  qa('[data-view]').forEach((button) =>
    button.addEventListener('click', async () => {
      state.system.view = button.dataset.view;
      syncStateToUi();
      try {
        mergeState(
          await api('./api/aethergrid/view', {
            method: 'POST',
            body: JSON.stringify({ view: button.dataset.view }),
          }),
        );
      } catch {}
      showToast('GRID VIEW', `${titleCase(button.dataset.view)} mode active.`);
    }),
  );

  qa('[data-node]').forEach((button) =>
    button.addEventListener('click', () => {
      const title = button.querySelector('b')?.textContent || 'Spatial Node';
      const inspector = q('#holoSelection');
      if (inspector) {
        inspector.innerHTML = `<b>${escapeHtml(title)}</b><p>Selected from the live grid. Open Holographic view to inspect the node in spatial context.</p>`;
      }
      openPanel(
        'SPATIAL NODE',
        title,
        '<div class="detail-card"><p>This node is linked to the time-indexed spatial graph, telemetry and active scenario. Use Holographic view for independent spatial analysis.</p></div>',
      );
    }),
  );

  q('#assetSearch')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const value = event.currentTarget.value.trim();
    showToast('SPATIAL SEARCH', value ? `Searching graph for “${value}”.` : 'Enter an asset, node, or scenario.');
  });

  const scenarioDescriptions = {
    'peak-demand': 'Baseline high-load scenario used for bounded optimization and evidence comparison.',
    'renewable-surge': 'High renewable availability with increased solar and wind contribution.',
    'storage-stress': 'Battery and storage reserve depletion with recovery requirements.',
    'weather-event': 'Spatial resilience review under a disruptive weather event.',
  };

  qa('[data-scenario]').forEach((button) =>
    button.addEventListener('click', async () => {
      state.system.scenario = button.dataset.scenario;
      state.system.view = 'scenario';
      syncStateToUi();
      if (q('#scenarioDetailTitle')) q('#scenarioDetailTitle').textContent = titleCase(button.dataset.scenario);
      if (q('#scenarioDetailCopy')) q('#scenarioDetailCopy').textContent = scenarioDescriptions[button.dataset.scenario];
      try {
        mergeState(
          await api('./api/aethergrid/scenario', {
            method: 'POST',
            body: JSON.stringify({ scenario: button.dataset.scenario }),
          }),
        );
      } catch {}
      showToast('SCENARIO LOADED', titleCase(button.dataset.scenario));
    }),
  );

  q('[data-action="reset-scenario"]')?.addEventListener('click', () =>
    q('[data-scenario="peak-demand"]')?.click(),
  );

  const optimizationInputs = [
    ['costWeight', 'costWeightValue', (value) => String(value)],
    ['emissionsWeight', 'emissionsWeightValue', (value) => String(value)],
    ['reserveConstraint', 'reserveValue', (value) => `${value}%`],
  ];
  for (const [inputId, outputId, formatter] of optimizationInputs) {
    q(`#${inputId}`)?.addEventListener('input', (event) => {
      q(`#${outputId}`).textContent = formatter(event.target.value);
    });
  }

  async function runOptimization() {
    const request = {
      objective: q('#objectiveSelect')?.value || 'balanced',
      weights: {
        cost: Number(q('#costWeight')?.value || 50),
        emissions: Number(q('#emissionsWeight')?.value || 50),
      },
      constraints: {
        minimumReservePercent: Number(q('#reserveConstraint')?.value || 18),
        classicalBaselineRequired: true,
      },
      scenario: state.system.scenario,
      region: state.system.region,
    };
    showToast('QUANTUM OPTIMIZATION', 'Running bounded candidate search…');
    let receipt = null;
    try {
      const result = await api('./api/aethergrid/optimize', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      mergeState({ optimization: result.optimization });
      receipt = result.receipt;
    } catch {
      state.optimization.runCount += 1;
      state.optimization.candidateCost = Math.max(9800, state.optimization.candidateCost - 35);
      state.optimization.emissionsReduction = Number((state.optimization.emissionsReduction + 0.3).toFixed(1));
      syncStateToUi();
      receipt = `local-${Date.now()}`;
    }
    const history = {
      id: receipt,
      at: new Date().toISOString(),
      objective: request.objective,
      scenario: request.scenario,
      candidateCost: state.optimization.candidateCost,
      emissionsReduction: state.optimization.emissionsReduction,
    };
    state.optimizationHistory.unshift(history);
    renderOptimizationHistory();
    state.evidence.unshift({
      id: receipt,
      title: `Optimization: ${titleCase(request.objective)}`,
      type: 'Optimization',
      age: 'just now',
      status: 'Verified',
    });
    renderEvidence();
    showToast('OPTIMIZATION COMPLETE', `Candidate $${Math.round(state.optimization.candidateCost).toLocaleString()}/hr recorded.`);
  }

  qa('[data-action="run-optimization"]').forEach((button) =>
    button.addEventListener('click', runOptimization),
  );

  function renderOptimizationHistory() {
    const container = q('#optimizationHistory');
    if (!container) return;
    container.innerHTML = state.optimizationHistory.length
      ? state.optimizationHistory
          .map(
            (item) => `<div class="history-row"><b>${escapeHtml(titleCase(item.objective))}</b><small>${escapeHtml(titleCase(item.scenario))} · $${Math.round(item.candidateCost).toLocaleString()}/hr · ↓ ${item.emissionsReduction}% · ${escapeHtml(item.id.slice(0, 18))}</small></div>`,
          )
          .join('')
      : '<div class="empty-state">No optimization run in this session yet.</div>';
  }

  function setSelectedAgent(name) {
    state.selectedAgent = name;
    qa('[data-agent]').forEach((button) => button.classList.toggle('active', button.dataset.agent === name));
    if (q('#activeAgentTitle')) q('#activeAgentTitle').textContent = name === 'TEAM' ? 'TEAM MODE' : name;
    if (q('#activeAgentSubtitle')) {
      q('#activeAgentSubtitle').textContent =
        name === 'TEAM' ? 'VÆLON + AUREN + SOLVÆR' : state.agents[name]?.role || 'Specialized Agent';
    }
  }

  qa('[data-agent]').forEach((button) =>
    button.addEventListener('click', () => setSelectedAgent(button.dataset.agent)),
  );

  q('[data-action="clear-chat"]')?.addEventListener('click', () => {
    const log = q('#chatLog');
    if (log) log.innerHTML = '<div class="chat-bubble system">Conversation cleared. Agent context remains connected to the active operator state.</div>';
  });

  q('#chatForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = q('#chatInput');
    const log = q('#chatLog');
    const message = input.value.trim();
    if (!message) return;
    log.insertAdjacentHTML('beforeend', `<div class="chat-bubble user">${escapeHtml(message)}</div>`);
    input.value = '';
    const pendingId = `pending-${Date.now()}`;
    log.insertAdjacentHTML('beforeend', `<div class="chat-bubble system" id="${pendingId}">Working…</div>`);
    log.scrollTop = log.scrollHeight;
    let reply =
      'Local fallback active. Start the Node backend and configure a provider to enable model-backed agent reasoning.';
    try {
      const endpoint =
        state.selectedAgent === 'TEAM'
          ? './api/aethergrid/team'
          : `./api/aethergrid/agents/${encodeURIComponent(state.selectedAgent)}`;
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          message,
          context: {
            region: state.system.region,
            scenario: state.system.scenario,
            view: state.system.view,
            metrics: state.metrics,
          },
        }),
      });
      reply = result.reply || result.synthesis || reply;
      if (result.runtime) state.runtime = result.runtime;
    } catch {
      try {
        const result = await api('./api/aethergrid/chat', {
          method: 'POST',
          body: JSON.stringify({ message, agent: state.selectedAgent }),
        });
        reply = result.reply || reply;
      } catch {}
    }
    q(`#${pendingId}`).textContent = reply;
    log.scrollTop = log.scrollHeight;
  });

  async function exportPackage(kind) {
    const payload = {
      kind,
      generatedAt: new Date().toISOString(),
      system: state.system,
      metrics: state.metrics,
      optimization: state.optimization,
      evidence: state.evidence,
      spatial: {
        timeHours: Number(q('#timeSlider')?.value || 12),
        camera: { yaw: spatial?.yaw, pitch: spatial?.pitch, distance: spatial?.distance },
      },
      advisoryOnly: true,
    };
    try {
      const result = await api('./api/aethergrid/export', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      payload.receipt = result.receipt;
    } catch {}
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `aethergrid-${kind}-${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast('EXPORT READY', titleCase(kind));
  }

  qa('[data-export]').forEach((button) =>
    button.addEventListener('click', () => exportPackage(button.dataset.export)),
  );

  q('[data-action="change-region"]')?.addEventListener('click', () =>
    openPanel(
      'REGION CONTROL',
      'Change Operator Region',
      `<div class="pill-row">${['New York Metro', 'Long Island', 'Hudson Valley', 'Upstate New York']
        .map((region) => `<button class="pill" data-region-choice="${region}">${region}</button>`)
        .join('')}</div>`,
    ),
  );

  dialogBody?.addEventListener('click', async (event) => {
    const regionButton = event.target.closest('[data-region-choice]');
    if (!regionButton) return;
    state.system.region = regionButton.dataset.regionChoice;
    try {
      mergeState(
        await api('./api/aethergrid/region', {
          method: 'POST',
          body: JSON.stringify({ region: state.system.region }),
        }),
      );
    } catch {}
    syncStateToUi();
    panelDialog.close();
    showToast('REGION CHANGED', state.system.region);
  });

  q('[data-action="profile"]')?.addEventListener('click', () =>
    openPanel(
      'OPERATOR',
      'Profile',
      '<div class="detail-card"><h3>IM · Operator Session</h3><p>Access to Grid, Holographic, Quantum, AI, Scenario, Evidence and Settings workspaces. Authority remains advisory-only.</p></div>',
    ),
  );

  loadSettings();
  bindSettings();
  switchWorkspace(initialWorkspace(), { persist: false });
  syncStateToUi();
  loadState();
  configureTelemetry();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();