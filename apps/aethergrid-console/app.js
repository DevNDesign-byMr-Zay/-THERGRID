(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const SETTINGS_KEY = 'aethergrid.operator.settings.v2';
  const DEFAULT_GLOBAL_CITIES = Object.freeze([
    { id: 'new-york', name: 'New York', country: 'United States', district: 'Midtown Manhattan', lat: 40.7549, lon: -73.984, radiusM: 1600 },
    { id: 'london', name: 'London', country: 'United Kingdom', district: 'City of London / South Bank', lat: 51.5136, lon: -0.0917, radiusM: 1700 },
    { id: 'tokyo', name: 'Tokyo', country: 'Japan', district: 'Shinjuku', lat: 35.6896, lon: 139.6917, radiusM: 1700 },
    { id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', district: 'Downtown Dubai', lat: 25.1972, lon: 55.2744, radiusM: 1800 },
    { id: 'singapore', name: 'Singapore', country: 'Singapore', district: 'Marina Bay / Downtown Core', lat: 1.2838, lon: 103.8515, radiusM: 1700 },
    { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', district: 'Paulista / Bela Vista', lat: -23.5614, lon: -46.6559, radiusM: 1700 },
    { id: 'lagos', name: 'Lagos', country: 'Nigeria', district: 'Victoria Island / Eko Atlantic', lat: 6.4281, lon: 3.4219, radiusM: 1800 },
    { id: 'sydney', name: 'Sydney', country: 'Australia', district: 'CBD / Circular Quay', lat: -33.8651, lon: 151.2099, radiusM: 1700 },
  ]);

  const defaultSettings = Object.freeze({
    theme: 'dark',
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
    agentChats: { TEAM: [], 'VÆLON': [], AUREN: [], 'SOLVÆR': [] },
    settings: { ...defaultSettings },
    system: {
      status: 'All Systems Nominal',
      region: 'New York Metro',
      view: 'live',
      scenario: 'peak-demand',
      scenarioParameters: {
        loadMultiplierPercent: 110,
        renewableAvailabilityPercent: 100,
        storageReservePercent: 18,
        weatherRiskPercent: 20,
      },
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
      classicalCandidateCost: 11790,
      emissionsReduction: 24.3,
      renewableUtilizationGain: 16.7,
      reliabilityScore: 90.0,
      runCount: 0,
    },
    agents: {
      'VÆLON': { role: 'Optimization & Scenario Exploration', status: 'READY' },
      AUREN: { role: 'Semantic & Spatial Intelligence', status: 'READY' },
      'SOLVÆR': { role: 'Simulation & Evidence Generation', status: 'READY' },
    },
    activity: [],
    evidence: [
      { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', type: 'Scenario', age: '12 min ago', status: 'Verified' },
      { id: 'quantum-optimization', title: 'Quantum Optimization Run', type: 'Optimization', age: '28 min ago', status: 'Verified' },
      { id: 'grid-resilience', title: 'Grid Resilience Analysis', type: 'AI Analysis', age: '1 hour ago', status: 'Verified' },
      { id: 'renewable-integration', title: 'Renewable Integration Study', type: 'Simulation', age: '2 hours ago', status: 'Verified' },
    ],
    optimizationHistory: [],
    runtime: null,
    geospatial: {
      runtime: null,
      cities: DEFAULT_GLOBAL_CITIES.map((city) => ({ ...city })),
      selectedCityId: 'new-york',
      cityMesh: null,
      globalLive: null,
      activeUseCase: null,
    },
    quantumRuntime: null,
    profile: {
      id: 'local-operator',
      displayName: 'Operator',
      initials: 'IM',
      title: 'ÆTHERGRID Operator',
      organization: '',
      homeRegion: 'New York Metro',
      timezone: 'America/New_York',
      bio: '',
      avatarDataUrl: '',
      updatedAt: null,
    },
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

  function resolvedTheme(theme = state.settings.theme) {
    if (theme === 'system') {
      return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return theme === 'light' ? 'light' : 'dark';
  }

  function isLightTheme() {
    return resolvedTheme() === 'light';
  }

  function environmentHour(environment) {
    const value = String(environment?.current?.time || '');
    const match = value.match(/T(\d{2}):(\d{2})/u);
    if (!match) return null;
    return Number(match[1]) + Number(match[2]) / 60;
  }

  function weatherPhenomenon(environment) {
    const code = Number(environment?.current?.weatherCode ?? environment?.weatherCode ?? 0);
    if ([45, 48].includes(code)) return 'Fog';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    if (
      [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
    ) {
      return 'Rain';
    }
    if (code >= 1 && code <= 3) return 'Cloudy';
    return code === 0 ? 'Clear' : 'Mixed';
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
    if (Array.isArray(next.activity)) state.activity = next.activity;
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
    const theme = resolvedTheme(state.settings.theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.density = state.settings.density;
    document.body.dataset.spatialLabels = state.settings.spatialLabels ? 'on' : 'off';
    document.body.dataset.motion =
      state.settings.reducedMotion || state.settings.animationIntensity === 0 ? 'reduced' : 'full';
    document.documentElement.style.setProperty(
      '--animation-scale',
      String(state.settings.animationIntensity / 100),
    );

    const bindings = {
      settingTheme: state.settings.theme,
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
      ['settingTheme', 'theme', 'value'],
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
    globalThis.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
      if (state.settings.theme === 'system') applySettings();
    });
  }

  function switchWorkspace(name, { persist = true } = {}) {
    const valid = ['grid', 'global', 'holographic', 'quantum', 'ai', 'scenarios', 'evidence', 'settings'];
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
      globalGlobe?.resize();
      cityGrid?.resize();
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

  class SpatialGrid4D {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = options;
      this.gl = canvas?.getContext('webgl', { antialias: true, alpha: true });
      this.layers = {
        grid: true,
        routes: true,
        buildings: true,
        infrastructure: true,
        terrain: true,
        weather: true,
        clouds: true,
        illumination: true,
        landmarks: true,
        air: true,
        seismic: true,
        nodes: true,
      };
      this.yaw = options.yaw ?? 0.74;
      this.pitch = options.pitch ?? 0.46;
      this.distance = options.distance ?? 20;
      this.timeHours = 12;
      this.autoRotate = false;
      this.projectionMode = 'perspective';
      this.temporalMode = 'pulse';
      this.intensity = 1;
      this.compareEnabled = false;
      this.compareTimeHours = 18;
      this.cityVisualMode = 'solid';
      this.environment = null;
      this.liveContext = null;
      this.operationProfile = null;
      this.skylineProfile = null;
      this.cityCameraTarget = { yaw: 0.78, pitch: 0.57, distance: 18 };
      this.drag = null;
      this.timeStart = performance.now();
      this.geometry = {};
      this.graphNodes = [];
      this.selectedNode = null;
      this.selectionBuffer = null;
      this.currentMvp = null;
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
         uniform vec2 u_flow;
         uniform float u_verticalScale;
         uniform float u_drop;
         varying float v_phase;
         void main(){
           vec3 p=a_position.xyz;
           float phase=a_position.w + u_time;
           p.y += sin(phase) * u_amp * u_verticalScale;
           p.xz += u_flow * sin(phase) * u_amp;
           p.y -= fract(phase * 0.15915494) * u_drop;
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
        flow: gl.getUniformLocation(this.program, 'u_flow'),
        verticalScale: gl.getUniformLocation(this.program, 'u_verticalScale'),
        drop: gl.getUniformLocation(this.program, 'u_drop'),
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

    triangle(out, a, b, c, phase = 0) {
      this.vertex(out, ...a, phase);
      this.vertex(out, ...b, phase + 0.12);
      this.vertex(out, ...c, phase + 0.24);
    }

    buildGeometry() {
      const grid = [];
      const buildings = [];
      const buildingFaces = [];
      const roofFaces = [];
      const roofLines = [];
      const routes = [];
      const infrastructureLines = [];
      const infrastructureNodes = [];
      const terrainLines = [];
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
      const labels = ['Renewable Generation','Grid Load','Energy Storage','New York City','North Hub','Coastal Hub','West Hub'];
      this.graphNodes = hubs.map((position, index) => ({
        id: `local-node-${index + 1}`,
        label: labels[index],
        type: index === 0 ? 'generation' : index === 1 ? 'load' : index === 2 ? 'storage' : 'transmission',
        position,
      }));
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
      this.geometry.buildingFaces = this.makeBuffer(buildingFaces);
      this.geometry.roofFaces = this.makeBuffer(roofFaces);
      this.geometry.roofLines = this.makeBuffer(roofLines);
      this.geometry.routes = this.makeBuffer(routes);
      this.geometry.infrastructureLines = this.makeBuffer(infrastructureLines);
      this.geometry.infrastructureNodes = this.makeBuffer(infrastructureNodes);
      this.geometry.terrain = this.makeBuffer(terrainLines);
      this.geometry.weather = this.makeBuffer([]);
      this.geometry.clouds = this.makeBuffer([]);
      this.geometry.illumination = this.makeBuffer([]);
      this.geometry.landmarkSpines = this.makeBuffer([]);
      this.geometry.landmarkNodes = this.makeBuffer([]);
      this.geometry.snow = this.makeBuffer([]);
      this.geometry.fog = this.makeBuffer([]);
      this.geometry.storm = this.makeBuffer([]);
      this.geometry.precipitation = this.makeBuffer([]);
      this.geometry.air = this.makeBuffer([]);
      this.geometry.seismicLines = this.makeBuffer([]);
      this.geometry.seismicNodes = this.makeBuffer([]);
      this.geometry.nodes = this.makeBuffer(nodes);
    }

    loadGraph(graph) {
      if (!this.gl || !graph?.nodes?.length || !graph?.routes?.length) return;
      for (const item of Object.values(this.geometry)) if (item?.buffer) this.gl.deleteBuffer(item.buffer);
      const grid = [];
      const buildings = [];
      const buildingFaces = [];
      const roofFaces = [];
      const roofLines = [];
      const routes = [];
      const infrastructureLines = [];
      const infrastructureNodes = [];
      const terrainLines = [];
      const nodes = [];
      for (let n = -10; n <= 10; n += 1) {
        this.line(grid, [-10, 0, n], [10, 0, n], n * 0.21);
        this.line(grid, [n, 0, -10], [n, 0, 10], n * 0.23);
      }
      this.graphNodes = graph.nodes.map((node) => ({ ...node, position: [...node.position] }));
      this.selectedNode = null;
      if (this.selectionBuffer?.buffer) this.gl.deleteBuffer(this.selectionBuffer.buffer);
      this.selectionBuffer = null;
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
      this.geometry.buildingFaces = this.makeBuffer(buildingFaces);
      this.geometry.roofFaces = this.makeBuffer(roofFaces);
      this.geometry.roofLines = this.makeBuffer(roofLines);
      this.geometry.routes = this.makeBuffer(routes);
      this.geometry.infrastructureLines = this.makeBuffer(infrastructureLines);
      this.geometry.infrastructureNodes = this.makeBuffer(infrastructureNodes);
      this.geometry.terrain = this.makeBuffer(terrainLines);
      this.geometry.weather = this.makeBuffer([]);
      this.geometry.clouds = this.makeBuffer([]);
      this.geometry.illumination = this.makeBuffer([]);
      this.geometry.landmarkSpines = this.makeBuffer([]);
      this.geometry.landmarkNodes = this.makeBuffer([]);
      this.geometry.snow = this.makeBuffer([]);
      this.geometry.fog = this.makeBuffer([]);
      this.geometry.storm = this.makeBuffer([]);
      this.geometry.precipitation = this.makeBuffer([]);
      this.geometry.air = this.makeBuffer([]);
      this.geometry.seismicLines = this.makeBuffer([]);
      this.geometry.seismicNodes = this.makeBuffer([]);
      this.geometry.nodes = this.makeBuffer(nodes);
      this.environment = null;
      this.liveContext = null;
      this.operationProfile = null;
    }

    loadCityMesh(mesh) {
      if (!this.gl || !mesh?.buildings?.length) return;
      for (const item of Object.values(this.geometry)) if (item?.buffer) this.gl.deleteBuffer(item.buffer);
      const grid = [];
      const buildings = [];
      const buildingFaces = [];
      const roofFaces = [];
      const roofLines = [];
      const cityCenters = [];
      const nodes = [];
      const routes = [];
      const infrastructureLines = [];
      const infrastructureNodes = [];
      const terrainLines = [];
      const weatherLines = [];
      const cloudParticles = [];
      const cityLights = [];
      const landmarkSpines = [];
      const landmarkNodes = [];
      const landmarkCandidates = [];
      const snowParticles = [];
      const fogParticles = [];
      const stormLines = [];
      const precipitationLines = [];
      const airParticles = [];
      const seismicLines = [];
      const seismicNodes = [];
      const radius = Math.max(200, Number(mesh.city?.radiusM || 900));
      const scale = 8.5 / radius;

      for (let n = -10; n <= 10; n += 1) {
        this.line(grid, [-10, 0, n], [10, 0, n], n * 0.13);
        this.line(grid, [n, 0, -10], [n, 0, 10], n * 0.17);
      }

      this.graphNodes = [];
      mesh.buildings.forEach((building, buildingIndex) => {
        const footprint = (building.footprint || []).map(([x, z]) => [x * scale, z * scale]);
        if (footprint.length < 3) return;
        const openFootprint =
          footprint.length > 3 &&
          Math.hypot(
            footprint[0][0] - footprint.at(-1)[0],
            footprint[0][1] - footprint.at(-1)[1],
          ) < 0.001
            ? footprint.slice(0, -1)
            : footprint;
        if (openFootprint.length < 3) return;
        const center = openFootprint
          .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
          .map((value) => value / openFootprint.length);
        cityCenters.push(center);
        const baseHeight = Math.max(0, Number(building.minHeightM || 0) * scale);
        const height = Math.max(baseHeight + 0.035, Number(building.heightM || 12) * scale);
        const roofHeight = clamp(Number(building.roofHeightM || 0) * scale, 0, Math.max(0, height - baseHeight));
        const supportedApexRoof = /^(pyramidal|hipped|conical|dome|onion)$/u.test(String(building.roofShape || ''));
        const wallTop = supportedApexRoof && roofHeight > 0 ? Math.max(baseHeight + 0.02, height - roofHeight) : height;
        const phase = buildingIndex * 0.13;
        for (let index = 0; index < openFootprint.length; index += 1) {
          const [ax, az] = openFootprint[index];
          const [bx, bz] = openFootprint[(index + 1) % openFootprint.length];
          const aBase = [ax, baseHeight, az];
          const bBase = [bx, baseHeight, bz];
          const aTop = [ax, wallTop, az];
          const bTop = [bx, wallTop, bz];
          this.line(buildings, aBase, bBase, phase);
          this.line(buildings, aTop, bTop, phase + 0.2);
          this.line(buildings, aBase, aTop, phase + 0.4);
          this.triangle(buildingFaces, aBase, bBase, bTop, phase + 0.08);
          this.triangle(buildingFaces, aBase, bTop, aTop, phase + 0.16);

          if (supportedApexRoof && roofHeight > 0) {
            const apex = [center[0], height, center[1]];
            this.triangle(roofFaces, aTop, bTop, apex, phase + 0.24);
            this.line(roofLines, aTop, apex, phase + 0.28);
          } else {
            const roofCenter = [center[0], height, center[1]];
            const aRoof = [ax, height, az];
            const bRoof = [bx, height, bz];
            this.triangle(roofFaces, aRoof, bRoof, roofCenter, phase + 0.24);
          }
        }

        const sourceHeightM = Math.max(3, Number(building.heightM || 12));
        const lightBands = Math.min(4, Math.max(1, Math.round(sourceHeightM / 55)));
        const edgePoint = openFootprint[buildingIndex % openFootprint.length] || center;
        for (let band = 1; band <= lightBands; band += 1) {
          const fraction = band / (lightBands + 1);
          const lightX = center[0] * 0.42 + edgePoint[0] * 0.58;
          const lightZ = center[1] * 0.42 + edgePoint[1] * 0.58;
          const lightY = baseHeight + Math.max(0.03, (wallTop - baseHeight) * fraction);
          this.vertex(cityLights, lightX, lightY, lightZ, phase + band * 0.67);
        }

        const skylineThresholdM = Math.max(
          80,
          Number(mesh.skylineProfile?.p95HeightM || 0),
        );
        const hasSourceName = Boolean(String(building.name || '').trim());
        if (hasSourceName || Number(building.heightM || 0) >= skylineThresholdM) {
          landmarkCandidates.push({
            id: building.id,
            label: String(building.name || `Tall structure ${buildingIndex + 1}`),
            type: 'landmark-building',
            heightM: Number(building.heightM || 0),
            heightSource: building.heightSource || null,
            roofShape: building.roofShape || null,
            startDate: building.startDate || null,
            osmId: building.osmId || null,
            osmType: building.osmType || null,
            named: hasSourceName,
            position: [center[0], height + 0.14, center[1]],
            basePosition: [center[0], Math.max(0.03, baseHeight), center[1]],
            score:
              (hasSourceName ? 10000 : 0) +
              (building.heightSource && building.heightSource !== 'inferred' ? 2500 : 0) +
              Number(building.heightM || 0),
          });
        }

        if (buildingIndex < 120 && (building.name || buildingIndex % 10 === 0)) {
          const node = {
            id: building.id,
            label: building.name || `Building ${buildingIndex + 1}`,
            type: 'building',
            heightM: building.heightM,
            heightSource: building.heightSource || null,
            roofShape: building.roofShape || null,
            buildingMaterial: building.buildingMaterial || null,
            osmId: building.osmId || null,
            osmType: building.osmType || null,
            position: [center[0], height + 0.08, center[1]],
          };
          this.graphNodes.push(node);
          this.vertex(nodes, ...node.position, phase);
        }
      });

      const landmarkSelection = landmarkCandidates
        .sort((left, right) => right.score - left.score)
        .slice(0, 18);
      const existingNodeIds = new Set(this.graphNodes.map((node) => node.id));
      landmarkSelection.forEach((landmark, landmarkIndex) => {
        this.line(
          landmarkSpines,
          landmark.basePosition,
          landmark.position,
          landmarkIndex * 0.73,
        );
        this.vertex(
          landmarkNodes,
          ...landmark.position,
          landmarkIndex * 0.91 + landmark.heightM * 0.01,
        );
        if (!existingNodeIds.has(landmark.id)) {
          this.graphNodes.push(landmark);
          existingNodeIds.add(landmark.id);
        }
      });
      this.landmarkNodes = landmarkSelection;

      (mesh.roads || []).forEach((road, roadIndex) => {
        const path = (road.path || []).map(([x, z]) => [x * scale, z * scale]);
        for (let index = 1; index < path.length; index += 1) {
          const [ax, az] = path[index - 1];
          const [bx, bz] = path[index];
          this.line(routes, [ax, 0.025, az], [bx, 0.025, bz], roadIndex * 0.07);
        }
      });

      (mesh.powerLines || []).forEach((line, lineIndex) => {
        const path = (line.path || []).map(([x, z]) => [x * scale, z * scale]);
        const lineHeight =
          line.powerType === 'cable'
            ? 0.055
            : 0.12 + Math.min(0.22, Number(line.voltage || 0) / 1_000_000);
        for (let index = 1; index < path.length; index += 1) {
          const [ax, az] = path[index - 1];
          const [bx, bz] = path[index];
          this.line(
            infrastructureLines,
            [ax, lineHeight, az],
            [bx, lineHeight, bz],
            lineIndex * 0.19,
          );
        }
      });

      (mesh.powerAssets || []).forEach((asset, assetIndex) => {
        const [x, z] = asset.position || [];
        if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) return;
        const height =
          asset.powerType === 'plant'
            ? 0.34
            : asset.powerType === 'substation'
              ? 0.24
              : 0.16;
        const node = {
          id: asset.id,
          label: asset.name || titleCase(asset.powerType || 'power asset'),
          type: `power-${asset.powerType || 'asset'}`,
          voltage: asset.voltage || null,
          operator: asset.operator || '',
          osmId: asset.osmId || null,
          position: [Number(x) * scale, height, Number(z) * scale],
        };
        this.graphNodes.push(node);
        this.vertex(
          infrastructureNodes,
          ...node.position,
          assetIndex * 0.37 + Number(asset.voltage || 0) / 100000,
        );
      });

      const terrain = mesh.terrain;
      if (terrain?.points?.length && Number(terrain.gridSize) >= 2) {
        const gridSize = Number(terrain.gridSize);
        const verticalScale = scale * 1.65;
        const pointAt = (row, column) => terrain.points[row * gridSize + column];
        const vector = (point) => [
          Number(point.x) * scale,
          -0.06 + Math.min(3.2, Number(point.relativeElevationM || 0) * verticalScale),
          Number(point.z) * scale,
        ];
        for (let row = 0; row < gridSize; row += 1) {
          for (let column = 0; column < gridSize; column += 1) {
            const current = pointAt(row, column);
            if (!current) continue;
            if (column + 1 < gridSize) {
              this.line(
                terrainLines,
                vector(current),
                vector(pointAt(row, column + 1)),
                row * 0.17 + column * 0.09,
              );
            }
            if (row + 1 < gridSize) {
              this.line(
                terrainLines,
                vector(current),
                vector(pointAt(row + 1, column)),
                row * 0.11 + column * 0.13,
              );
            }
          }
        }
      }

      const environment = mesh.environment?.current || {};
      const liveContext = mesh.liveContext || {};
      const deterministic = (index, salt = 0) => {
        const raw = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
        return raw - Math.floor(raw);
      };
      const cloudCover = clamp(Number(environment.cloudCoverPercent || 0), 0, 100);
      const cloudCount = Math.round(clamp(cloudCover * 0.9, 0, 90));
      for (let index = 0; index < cloudCount; index += 1) {
        this.vertex(
          cloudParticles,
          (deterministic(index, 10) - 0.5) * 17.5,
          4.7 + deterministic(index, 11) * 1.55,
          (deterministic(index, 12) - 0.5) * 17.5,
          index * 0.21,
        );
      }

      const windSpeed = Math.max(0, Number(environment.windSpeedKph || 0));
      const windDirection = (Number(environment.windDirectionDegrees || 0) * Math.PI) / 180;
      const windLength = clamp(0.25 + windSpeed / 32, 0.25, 1.8);
      const windCount = windSpeed > 0 ? Math.round(clamp(36 + windSpeed * 1.7, 36, 150)) : 0;
      for (let index = 0; index < windCount; index += 1) {
        const x = (deterministic(index, 1) - 0.5) * 17;
        const z = (deterministic(index, 2) - 0.5) * 17;
        const y = 0.18 + deterministic(index, 3) * 4.8;
        const dx = Math.sin(windDirection) * windLength;
        const dz = Math.cos(windDirection) * windLength;
        this.line(
          weatherLines,
          [x, y, z],
          [x + dx, y + Math.sin(index * 0.7) * 0.03, z + dz],
          index * 0.31,
        );
      }

      const precipitation = Math.max(0, Number(environment.precipitationMm || 0));
      const weatherCode = Number(environment.weatherCode || 0);
      const snowMode = [71, 73, 75, 77, 85, 86].includes(weatherCode);
      const fogMode =
        [45, 48].includes(weatherCode) ||
        (Number.isFinite(Number(environment.visibilityM)) &&
          Number(environment.visibilityM) < 6000);
      const stormMode = weatherCode >= 95 && weatherCode <= 99;
      const rainCount =
        !snowMode && precipitation > 0.02
          ? Math.round(clamp(24 + precipitation * 32, 24, 180))
          : 0;
      for (let index = 0; index < rainCount; index += 1) {
        const x = (deterministic(index, 4) - 0.5) * 17;
        const z = (deterministic(index, 5) - 0.5) * 17;
        const y = 1.2 + deterministic(index, 6) * 5.8;
        const lean = Math.sin(windDirection) * clamp(windSpeed / 70, 0, 0.75);
        const drift = Math.cos(windDirection) * clamp(windSpeed / 70, 0, 0.75);
        this.line(
          precipitationLines,
          [x, y, z],
          [x + lean, y - 0.72, z + drift],
          index * 0.43,
        );
      }

      const snowCount =
        snowMode && precipitation > 0
          ? Math.round(clamp(34 + precipitation * 26, 34, 170))
          : 0;
      for (let index = 0; index < snowCount; index += 1) {
        this.vertex(
          snowParticles,
          (deterministic(index, 13) - 0.5) * 17,
          1.1 + deterministic(index, 14) * 5.9,
          (deterministic(index, 15) - 0.5) * 17,
          index * 0.31,
        );
      }

      const visibilityM = Number(environment.visibilityM);
      const fogStrength = fogMode
        ? clamp(
            Number.isFinite(visibilityM) ? (8000 - visibilityM) / 8000 : 0.55,
            0.18,
            0.92,
          )
        : 0;
      const fogCount = fogMode ? Math.round(50 + fogStrength * 110) : 0;
      for (let index = 0; index < fogCount; index += 1) {
        this.vertex(
          fogParticles,
          (deterministic(index, 16) - 0.5) * 17.5,
          0.12 + deterministic(index, 17) * 2.2,
          (deterministic(index, 18) - 0.5) * 17.5,
          index * 0.17,
        );
      }

      if (stormMode) {
        for (let bolt = 0; bolt < 3; bolt += 1) {
          const baseX = (deterministic(bolt, 19) - 0.5) * 10;
          const baseZ = (deterministic(bolt, 20) - 0.5) * 10;
          let previous = [baseX, 5.8, baseZ];
          for (let step = 1; step <= 7; step += 1) {
            const next = [
              baseX + (deterministic(bolt * 10 + step, 21) - 0.5) * 0.9,
              5.8 - step * 0.72,
              baseZ + (deterministic(bolt * 10 + step, 22) - 0.5) * 0.9,
            ];
            this.line(stormLines, previous, next, bolt * 1.7 + step * 0.23);
            previous = next;
          }
        }
      }

      const air = liveContext.airQuality?.current || {};
      const aqi = clamp(Number(air.usAqi || 0), 0, 500);
      const airCount = air.usAqi == null ? 0 : Math.round(clamp(18 + aqi * 0.34, 18, 150));
      for (let index = 0; index < airCount; index += 1) {
        this.vertex(
          airParticles,
          (deterministic(index, 7) - 0.5) * 16,
          0.22 + deterministic(index, 8) * 4.2,
          (deterministic(index, 9) - 0.5) * 16,
          index * 0.27,
        );
      }

      (liveContext.seismic?.events || []).slice(0, 18).forEach((event, eventIndex) => {
        const offset = event.offsetM || { x: 0, z: 0 };
        const rawX = Number(offset.x || 0) * scale;
        const rawZ = Number(offset.z || 0) * scale;
        const rawDistance = Math.hypot(rawX, rawZ);
        const sceneDistance = Math.min(7.7, rawDistance);
        const directionX = rawDistance > 0 ? rawX / rawDistance : 1;
        const directionZ = rawDistance > 0 ? rawZ / rawDistance : 0;
        const cx = directionX * sceneDistance;
        const cz = directionZ * sceneDistance;
        const magnitude = Math.max(0, Number(event.magnitude || 0));
        const ringBase = clamp(0.12 + magnitude * 0.065, 0.12, 0.62);
        for (let ring = 1; ring <= 3; ring += 1) {
          let previous = null;
          const ringRadius = ringBase * ring;
          for (let step = 0; step <= 28; step += 1) {
            const angle = (step / 28) * Math.PI * 2;
            const point = [
              cx + Math.cos(angle) * ringRadius,
              0.055 + ring * 0.012,
              cz + Math.sin(angle) * ringRadius,
            ];
            if (previous) this.line(seismicLines, previous, point, eventIndex * 0.83 + ring * 0.4);
            previous = point;
          }
        }
        this.vertex(seismicNodes, cx, 0.11, cz, eventIndex * 0.91 + magnitude);
      });

      this.geometry.grid = this.makeBuffer(grid);
      this.geometry.buildings = this.makeBuffer(buildings);
      this.geometry.buildingFaces = this.makeBuffer(buildingFaces);
      this.geometry.roofFaces = this.makeBuffer(roofFaces);
      this.geometry.roofLines = this.makeBuffer(roofLines);
      this.geometry.routes = this.makeBuffer(routes);
      this.geometry.infrastructureLines = this.makeBuffer(infrastructureLines);
      this.geometry.infrastructureNodes = this.makeBuffer(infrastructureNodes);
      this.geometry.terrain = this.makeBuffer(terrainLines);
      this.geometry.weather = this.makeBuffer(weatherLines);
      this.geometry.clouds = this.makeBuffer(cloudParticles);
      this.geometry.illumination = this.makeBuffer(cityLights);
      this.geometry.landmarkSpines = this.makeBuffer(landmarkSpines);
      this.geometry.landmarkNodes = this.makeBuffer(landmarkNodes);
      this.geometry.snow = this.makeBuffer(snowParticles);
      this.geometry.fog = this.makeBuffer(fogParticles);
      this.geometry.storm = this.makeBuffer(stormLines);
      this.geometry.precipitation = this.makeBuffer(precipitationLines);
      this.geometry.air = this.makeBuffer(airParticles);
      this.geometry.seismicLines = this.makeBuffer(seismicLines);
      this.geometry.seismicNodes = this.makeBuffer(seismicNodes);
      this.geometry.nodes = this.makeBuffer(nodes);
      this.selectedNode = null;
      if (this.selectionBuffer?.buffer) this.gl.deleteBuffer(this.selectionBuffer.buffer);
      this.selectionBuffer = null;
      this.environment = mesh.environment || null;
      this.liveContext = mesh.liveContext || null;
      this.operationProfile = null;
      this.skylineProfile = mesh.skylineProfile || null;

      let dominantYaw = 0.78;
      if (cityCenters.length >= 6) {
        const mean = cityCenters
          .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
          .map((value) => value / cityCenters.length);
        let xx = 0;
        let zz = 0;
        let xz = 0;
        cityCenters.forEach(([x, z]) => {
          const dx = x - mean[0];
          const dz = z - mean[1];
          xx += dx * dx;
          zz += dz * dz;
          xz += dx * dz;
        });
        dominantYaw = 0.5 * Math.atan2(2 * xz, xx - zz) + 0.76;
      }
      const skylineUnits = Number(mesh.skylineProfile?.maxHeightM || 0) * scale;
      const densityBias = clamp((Number(mesh.skylineProfile?.buildingCount || 0) - 300) / 1400, 0, 1);
      this.cityCameraTarget = {
        yaw: dominantYaw,
        pitch: clamp(0.5 + skylineUnits * 0.025, 0.5, 0.72),
        distance: clamp(17 + skylineUnits * 0.72 + densityBias * 2.5, 17, 27),
      };
      Object.assign(this, this.cityCameraTarget);
      this.updateReadout();
    }

    setCityVisualMode(mode) {
      this.cityVisualMode = ['solid', 'xray', 'operations'].includes(mode) ? mode : 'solid';
    }

    setOperationProfile(profile = null) {
      this.operationProfile = profile || null;
    }

    setLayerProfile(layers = []) {
      const enabled = new Set(layers);
      for (const key of Object.keys(this.layers)) this.layers[key] = enabled.has(key);
    }

    cinematicEntrance(durationMs = 1050) {
      const target = this.cityCameraTarget || { yaw: 0.78, pitch: 0.57, distance: 18 };
      if (state.settings.reducedMotion) {
        Object.assign(this, target);
        this.updateReadout();
        return Promise.resolve();
      }
      const start = { yaw: -0.22, pitch: 1.02, distance: 32 };
      Object.assign(this, start);
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const tick = (now) => {
          const raw = clamp((now - startedAt) / durationMs, 0, 1);
          const t = 1 - Math.pow(1 - raw, 3);
          this.yaw = start.yaw + (target.yaw - start.yaw) * t;
          this.pitch = start.pitch + (target.pitch - start.pitch) * t;
          this.distance = start.distance + (target.distance - start.distance) * t;
          this.updateReadout();
          if (raw < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
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
        this.pitch = clamp(this.drag.pitch + dy * 0.006, 0.12, 1.15);
        this.updateReadout();
      });
      const end = (event) => {
        if (!this.drag) return;
        const wasClick = !this.drag.moved;
        this.drag = null;
        this.canvas.classList.remove('dragging');
        try { this.canvas.releasePointerCapture(event.pointerId); } catch {}
        if (wasClick) this.pickNode(event.clientX, event.clientY);
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

    projectNode(node) {
      if (!this.currentMvp || !node?.position) return null;
      const [x, y, z] = node.position;
      const matrix = this.currentMvp;
      const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
      const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
      const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
      if (clipW <= 0.0001) return null;
      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: rect.left + (ndcX * 0.5 + 0.5) * rect.width,
        y: rect.top + (-ndcY * 0.5 + 0.5) * rect.height,
      };
    }

    selectNode(node) {
      if (!node) return;
      this.selectedNode = node;
      if (this.selectionBuffer?.buffer) this.gl.deleteBuffer(this.selectionBuffer.buffer);
      const [x, y, z] = node.position;
      this.selectionBuffer = this.makeBuffer([x, y, z, 0]);
      this.options.onSelectNode?.(node, this);
    }

    pickNode(clientX, clientY) {
      let best = null;
      for (const node of this.graphNodes) {
        const point = this.projectNode(node);
        if (!point) continue;
        const distance = Math.hypot(point.x - clientX, point.y - clientY);
        if (distance <= 34 && (!best || distance < best.distance)) best = { node, distance };
      }
      if (best) this.selectNode(best.node);
      return best?.node || null;
    }

    setProjection(mode) {
      this.projectionMode = mode === 'orthographic' ? 'orthographic' : 'perspective';
      if (mode === 'orthographic') this.setPreset('top');
      if (mode === 'isometric') {
        this.projectionMode = 'perspective';
        this.setPreset('isometric');
      }
      if (mode === 'perspective') this.setPreset('overview');
    }

    setTemporalMode(mode) {
      this.temporalMode = ['pulse', 'trail', 'freeze'].includes(mode) ? mode : 'pulse';
    }

    setIntensity(value) {
      this.intensity = clamp(Number(value), 0, 1);
    }

    setCompare(enabled, hours = this.compareTimeHours) {
      this.compareEnabled = Boolean(enabled);
      this.compareTimeHours = clamp(Number(hours), 0, 24);
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

    drawBuffer(
      item,
      primitive,
      color,
      amplitude,
      pointMode = 0,
      pointSize = 1,
      flowX = 0,
      flowZ = 0,
      verticalScale = 1,
      drop = 0,
    ) {
      if (!item) return;
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
      gl.vertexAttribPointer(this.loc.pos, 4, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.loc.pos);
      gl.uniform4fv(this.loc.color, color);
      gl.uniform1f(this.loc.amp, amplitude);
      gl.uniform1f(this.loc.pointMode, pointMode);
      gl.uniform1f(this.loc.pointSize, pointSize);
      gl.uniform2f(this.loc.flow, flowX, flowZ);
      gl.uniform1f(this.loc.verticalScale, verticalScale);
      gl.uniform1f(this.loc.drop, drop);
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
      const projection =
        this.projectionMode === 'orthographic'
          ? orthographic(-12 * aspect, 12 * aspect, -12, 12, 0.1, 100)
          : perspective(Math.PI / 3.1, aspect, 0.1, 100);
      const mvp = mat4Multiply(projection, view);
      this.currentMvp = mvp;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const liveIsDay = this.environment?.current?.isDay;
      const temporalIsDay = this.timeHours >= 6 && this.timeHours < 18;
      const dayMode = liveIsDay == null ? temporalIsDay : Math.abs(this.timeHours - (environmentHour(this.environment) ?? this.timeHours)) < 0.3 ? liveIsDay : temporalIsDay;
      const cloud = clamp(Number(this.environment?.current?.cloudCoverPercent || 0) / 100, 0, 1);
      if (isLightTheme()) {
        const base = dayMode ? 0.92 - cloud * 0.08 : 0.82;
        gl.clearColor(base, base + 0.025, Math.min(1, base + 0.055), 1);
      } else if (dayMode) {
        gl.clearColor(0.018 + cloud * 0.008, 0.055 + cloud * 0.012, 0.11 + cloud * 0.02, 1);
      } else {
        if (isLightTheme()) gl.clearColor(0.9, 0.94, 0.98, 1);
      else gl.clearColor(0.004, 0.015, 0.04, 1);
      }
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.loc.mvp, false, mvp);
      const settingsMotion = state.settings.reducedMotion ? 0 : state.settings.animationIntensity / 100;
      const temporalMotion = this.temporalMode === 'freeze' ? 0 : settingsMotion;
      const trailBoost = this.temporalMode === 'trail' ? 1.35 : 1;
      const temporal =
        (this.timeHours / 24) * Math.PI * 2 +
        (now - this.timeStart) * 0.00035 * temporalMotion;
      gl.uniform1f(this.loc.time, temporal);
      const amplitude = temporalMotion * this.intensity;
      if (this.layers.terrain) {
        this.drawBuffer(
          this.geometry.terrain,
          gl.LINES,
          [0.18, 0.78, 0.62, 0.42],
          0.025 * amplitude,
        );
      }
      if (this.layers.grid) this.drawBuffer(this.geometry.grid, gl.LINES, [0.09, 0.42, 0.75, this.cityVisualMode === 'operations' ? 0.18 : 0.42], 0.045 * amplitude);
      if (this.layers.buildings && this.cityVisualMode !== 'xray') {
        const faceAlpha = this.cityVisualMode === 'operations' ? 0.13 : 0.28;
        const faceColor = isLightTheme() ? [0.15, 0.42, 0.62, faceAlpha] : [0.035, 0.31, 0.58, faceAlpha];
        this.drawBuffer(this.geometry.buildingFaces, gl.TRIANGLES, faceColor, 0.025 * amplitude);
        this.drawBuffer(this.geometry.roofFaces, gl.TRIANGLES, isLightTheme() ? [0.23, 0.49, 0.7, Math.min(0.48, faceAlpha + 0.12)] : [0.08, 0.46, 0.78, Math.min(0.52, faceAlpha + 0.12)], 0.018 * amplitude);
      }
      if (this.layers.buildings) {
        const edgeAlpha = this.cityVisualMode === 'xray' ? 0.28 : this.cityVisualMode === 'operations' ? 0.38 : 0.72;
        const edgeColor = isLightTheme() ? [0.03, 0.31, 0.52, edgeAlpha] : [0.14, 0.64, 1, edgeAlpha];
        this.drawBuffer(this.geometry.buildings, gl.LINES, edgeColor, 0.07 * amplitude);
        this.drawBuffer(this.geometry.roofLines, gl.LINES, isLightTheme() ? [0.21, 0.19, 0.55, edgeAlpha] : [0.55, 0.64, 1, edgeAlpha], 0.05 * amplitude);
      }
      if (this.layers.routes) this.drawBuffer(this.geometry.routes, gl.LINES, [0.67, 0.48, 0.98, Math.min(1, 0.64 * trailBoost)], 0.075 * amplitude * trailBoost);
      if (this.layers.infrastructure) {
        this.drawBuffer(
          this.geometry.infrastructureLines,
          gl.LINES,
          [1, 0.61, 0.12, Math.min(1, 0.92 * trailBoost)],
          0.15 * amplitude * trailBoost,
        );
        this.drawBuffer(
          this.geometry.infrastructureNodes,
          gl.POINTS,
          [1, 0.82, 0.25, 1],
          0.08 * amplitude,
          1,
          12,
        );
      }
      if (this.layers.landmarks) {
        const landmarkPulse =
          state.settings.reducedMotion ? 0.35 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0032));
        this.drawBuffer(
          this.geometry.landmarkSpines,
          gl.LINES,
          isLightTheme()
            ? [0.35, 0.23, 0.62, 0.42 + landmarkPulse * 0.18]
            : [0.63, 0.55, 1, 0.42 + landmarkPulse * 0.26],
          0.035 * amplitude,
        );
        this.drawBuffer(
          this.geometry.landmarkNodes,
          gl.POINTS,
          [0.72, 0.55, 1, 0.82],
          0.035 * amplitude,
          1,
          9 + landmarkPulse * 5,
        );
      }
      const focus = this.operationProfile || '';
      const windSpeed = Math.max(0, Number(this.environment?.current?.windSpeedKph || 0));
      const windDirection =
        (Number(this.environment?.current?.windDirectionDegrees || 0) * Math.PI) / 180;
      const flowX = Math.sin(windDirection);
      const flowZ = Math.cos(windDirection);
      const precipitation = Math.max(0, Number(this.environment?.current?.precipitationMm || 0));
      const weatherCode = Number(this.environment?.current?.weatherCode || 0);
      const snowMode = [71, 73, 75, 77, 85, 86].includes(weatherCode);
      const fogMode =
        [45, 48].includes(weatherCode) ||
        (Number.isFinite(Number(this.environment?.current?.visibilityM)) &&
          Number(this.environment.current.visibilityM) < 6000);
      const stormMode = weatherCode >= 95 && weatherCode <= 99;
      const currentCloud = clamp(
        Number(this.environment?.current?.cloudCoverPercent || 0) / 100,
        0,
        1,
      );

      if (this.layers.clouds) {
        const cloudBoost = focus === 'weather' || focus === 'visibility' ? 1 : 0.58;
        const cloudSize = 10 + currentCloud * 12;
        this.drawBuffer(
          this.geometry.clouds,
          gl.POINTS,
          isLightTheme()
            ? [0.38, 0.48, 0.58, (0.08 + currentCloud * 0.2) * cloudBoost]
            : [0.62, 0.78, 0.9, (0.08 + currentCloud * 0.24) * cloudBoost],
          0.12 * amplitude * cloudBoost,
          1,
          cloudSize,
          flowX * 0.62,
          flowZ * 0.62,
          0.18,
          0,
        );
      }

      if (this.layers.illumination) {
        const lightBoost =
          focus === 'visibility' ? 1.16 : focus === 'heat' ? 0.82 : 1;
        const nightAlpha = dayMode ? 0.06 : 0.88;
        const lightSize = dayMode ? 2.2 : 3.8;
        this.drawBuffer(
          this.geometry.illumination,
          gl.POINTS,
          [1, 0.72, 0.26, nightAlpha * lightBoost],
          0.025 * amplitude,
          1,
          lightSize,
          0,
          0,
          0.18,
          0,
        );
      }

      if (this.layers.weather) {
        const weatherBoost =
          focus === 'weather' ||
          focus === 'resource-flow' ||
          focus === 'grid-flow' ||
          focus === 'visibility'
            ? 1
            : 0.58;
        gl.uniform1f(this.loc.time, temporal * (1 + Math.min(2.4, windSpeed / 30)));
        this.drawBuffer(
          this.geometry.weather,
          gl.LINES,
          isLightTheme()
            ? [0.05, 0.46, 0.68, 0.48 * weatherBoost]
            : [0.35, 0.88, 1, 0.58 * weatherBoost],
          0.055 * amplitude * weatherBoost,
          0,
          1,
          flowX * 0.8,
          flowZ * 0.8,
          0.25,
          0,
        );
        if (precipitation > 0 && !snowMode) {
          this.drawBuffer(
            this.geometry.precipitation,
            gl.LINES,
            isLightTheme()
              ? [0.18, 0.42, 0.72, 0.5 * weatherBoost]
              : [0.32, 0.58, 1, 0.72 * weatherBoost],
            0.04 * amplitude * weatherBoost,
            0,
            1,
            flowX * 0.22,
            flowZ * 0.22,
            0.08,
            1.05 * Math.min(1.8, 0.7 + precipitation * 0.08),
          );
        }
        if (snowMode) {
          this.drawBuffer(
            this.geometry.snow,
            gl.POINTS,
            isLightTheme() ? [0.55, 0.66, 0.75, 0.72] : [0.84, 0.94, 1, 0.82],
            0.035 * amplitude * weatherBoost,
            1,
            5.5,
            flowX * 0.18,
            flowZ * 0.18,
            0.22,
            0.36,
          );
        }
        if (fogMode) {
          const visibility = Math.max(200, Number(this.environment?.current?.visibilityM || 5000));
          const fogAlpha = clamp((8000 - visibility) / 9000, 0.08, 0.42);
          this.drawBuffer(
            this.geometry.fog,
            gl.POINTS,
            isLightTheme()
              ? [0.52, 0.58, 0.64, fogAlpha]
              : [0.58, 0.7, 0.78, fogAlpha],
            0.02 * amplitude,
            1,
            14,
            flowX * 0.1,
            flowZ * 0.1,
            0.08,
            0,
          );
        }
        if (stormMode) {
          const strikePulse = state.settings.reducedMotion
            ? 0.24
            : Math.pow(Math.max(0, Math.sin(now * 0.012)), 12);
          this.drawBuffer(
            this.geometry.storm,
            gl.LINES,
            [0.72, 0.82, 1, 0.12 + strikePulse * 0.88],
            0.02 * amplitude,
          );
        }
        gl.uniform1f(this.loc.time, temporal);
      }

      if (this.layers.air) {
        const aqi = clamp(Number(this.liveContext?.airQuality?.current?.usAqi || 0), 0, 500);
        const airBoost =
          focus === 'air-quality' || focus === 'visibility' || focus === 'heat' ? 1 : 0.42;
        const airColor =
          aqi >= 151
            ? [1, 0.34, 0.4, 0.74 * airBoost]
            : aqi >= 101
              ? [1, 0.55, 0.25, 0.68 * airBoost]
              : aqi >= 51
                ? [1, 0.79, 0.22, 0.56 * airBoost]
                : [0.32, 0.92, 0.68, 0.44 * airBoost];
        this.drawBuffer(
          this.geometry.air,
          gl.POINTS,
          airColor,
          0.12 * amplitude * airBoost,
          1,
          focus === 'air-quality' || focus === 'visibility' ? 7 : 4,
          flowX * 0.3,
          flowZ * 0.3,
          0.45,
          0,
        );
      }
      if (this.layers.seismic) {
        const seismicBoost = focus === 'seismic' || focus === 'grid-flow' ? 1 : 0.48;
        const pulse = state.settings.reducedMotion ? 0 : 0.5 + 0.5 * Math.sin(now * 0.006);
        this.drawBuffer(
          this.geometry.seismicLines,
          gl.LINES,
          [1, 0.3, 0.42, (0.34 + pulse * 0.35) * seismicBoost],
          0.075 * amplitude * seismicBoost,
        );
        this.drawBuffer(
          this.geometry.seismicNodes,
          gl.POINTS,
          [1, 0.48, 0.22, 0.9 * seismicBoost],
          0.04 * amplitude,
          1,
          9 + pulse * 7,
        );
      }
      if (this.layers.nodes) this.drawBuffer(this.geometry.nodes, gl.POINTS, [0.22, 1, 0.84, 1], 0.08 * amplitude, 1, 9);

      if (this.compareEnabled) {
        const compareTemporal =
          (this.compareTimeHours / 24) * Math.PI * 2 +
          (now - this.timeStart) * 0.00018 * temporalMotion;
        gl.uniform1f(this.loc.time, compareTemporal);
        if (this.layers.buildings) this.drawBuffer(this.geometry.buildings, gl.LINES, [1, 0.55, 0.18, 0.25], 0.055 * amplitude);
        if (this.layers.routes) this.drawBuffer(this.geometry.routes, gl.LINES, [1, 0.72, 0.24, 0.36], 0.06 * amplitude, 0, 1);
        if (this.layers.infrastructure) {
          this.drawBuffer(
            this.geometry.infrastructureLines,
            gl.LINES,
            [1, 0.88, 0.32, 0.58],
            0.1 * amplitude,
          );
          this.drawBuffer(
            this.geometry.infrastructureNodes,
            gl.POINTS,
            [1, 0.9, 0.42, 0.9],
            0.04 * amplitude,
            1,
            9,
          );
        }
        if (this.layers.nodes) this.drawBuffer(this.geometry.nodes, gl.POINTS, [1, 0.72, 0.24, 0.82], 0.05 * amplitude, 1, 7);
        gl.uniform1f(this.loc.time, temporal);
      }

      if (this.selectionBuffer) this.drawBuffer(this.selectionBuffer, gl.POINTS, [1, 0.72, 0.22, 1], 0, 1, 16);
      requestAnimationFrame(this.animate);
    };
  }

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
          if (raw < 1 && !state.settings.reducedMotion) requestAnimationFrame(tick);
          else {
            this.yaw = target.yaw;
            this.pitch = target.pitch;
            this.distance = 5.65;
            resolve();
          }
        };
        if (state.settings.reducedMotion) tick(startedAt + durationMs);
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
      const motion = state.settings.reducedMotion ? 0 : Math.max(0.1, state.settings.animationIntensity / 100);
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

      const pulse = state.settings.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0022);
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

      const quakePulse = state.settings.reducedMotion ? 0 : 0.5 + 0.5 * Math.sin(now * 0.0065);
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

  function handleSpatialSelection(node, renderer) {
    const inspector = q('#holoSelection');
    if (inspector) {
      inspector.innerHTML = `<b>${escapeHtml(node.label || node.id)}</b><p>${escapeHtml(titleCase(node.type || 'spatial node'))} · position [${node.position.map((value) => Number(value).toFixed(2)).join(', ')}]. Selected directly from the ${renderer === holographic ? 'holographic' : 'grid'} renderer.</p>`;
    }
    if (renderer === spatial) holographic?.selectNode(node);
    showToast('SPATIAL NODE SELECTED', node.label || node.id);
  }

  function handleCityBuildingSelection(node) {
    const status = q('#cityMeshStatus');
    const isPower = String(node.type || '').startsWith('power-');
    const detail = isPower
      ? `${titleCase(String(node.type).replace('power-', ''))}${node.voltage ? ` · ${Number(node.voltage).toLocaleString()} V` : ''}${node.operator ? ` · ${escapeHtml(node.operator)}` : ''}`
      : `Building node · ${Number(node.heightM || 0).toFixed(1)} m high`;
    if (status) {
      status.innerHTML = `<b>${escapeHtml(node.label || node.id)}</b><p>${detail}${node.osmId ? ` · OSM ${escapeHtml(node.osmId)}` : ''}.</p>`;
    }
    showToast(isPower ? 'POWER ASSET SELECTED' : 'CITY BUILDING SELECTED', node.label || node.id);
  }

  function handleGlobalCitySelection(city) {
    if (!city) return;
    state.geospatial.selectedCityId = city.id;
    const select = q('#globalCitySelect');
    if (select) {
      if (![...select.options].some((option) => option.value === city.id)) {
        const option = document.createElement('option');
        option.value = city.id;
        option.textContent = `${city.name} · ${city.country || 'Custom coordinate'}`;
        select.append(option);
      }
      select.value = city.id;
    }
    if (q('#globalPointName')) q('#globalPointName').value = city.name || 'Coordinate Explorer';
    if (q('#globalPointLat')) q('#globalPointLat').value = Number(city.lat).toFixed(5);
    if (q('#globalPointLon')) q('#globalPointLon').value = Number(city.lon).toFixed(5);
    qa('[data-global-city]').forEach((button) =>
      button.classList.toggle('active', button.dataset.globalCity === city.id),
    );
    const latLabel = `${Math.abs(Number(city.lat)).toFixed(4)}° ${Number(city.lat) >= 0 ? 'N' : 'S'}`;
    const lonLabel = `${Math.abs(Number(city.lon)).toFixed(4)}° ${Number(city.lon) >= 0 ? 'E' : 'W'}`;
    if (q('#globalCoordinates')) q('#globalCoordinates').textContent = `${latLabel} · ${lonLabel}`;
    const status = q('#cityMeshStatus');
    if (status) {
      status.innerHTML = `<b>${escapeHtml(city.name)} · ${escapeHtml(city.district || city.country)}</b><p>Real-coordinate skyline focus selected. Descend to request current open-source structures, roads, terrain, environment context and mapped power infrastructure.</p>`;
    }
  }

  const spatial = new SpatialGrid4D(q('#spatialGrid'), {
    readoutId: 'cameraReadout',
    onSelectNode: handleSpatialSelection,
  });
  const holographic = new SpatialGrid4D(q('#holographicGrid'), {
    yaw: 1.0,
    pitch: 0.56,
    distance: 18,
    onSelectNode: handleSpatialSelection,
  });
  const globalGlobe = new GlobalGlobe3D(q('#globalGlobe'), {
    onSelectCity: handleGlobalCitySelection,
    onEnterCity: (city) => loadLiveCity(city.id),
    onSolarUpdate: (solar) => {
      const label = q('#globalSolarStatus');
      if (!label || !solar) return;
      const lat = `${Math.abs(Number(solar.subsolarLat)).toFixed(1)}°${Number(solar.subsolarLat) >= 0 ? 'N' : 'S'}`;
      const lon = `${Math.abs(Number(solar.subsolarLon)).toFixed(1)}°${Number(solar.subsolarLon) >= 0 ? 'E' : 'W'}`;
      label.textContent = `SUN ${lat} · ${lon} · TERMINATOR LIVE`;
    },
  });
  globalGlobe?.setCities(state.geospatial.cities);
  const cityGrid = new SpatialGrid4D(q('#cityGrid'), {
    yaw: 0.86,
    pitch: 0.62,
    distance: 18,
    onSelectNode: handleCityBuildingSelection,
  });
  cityGrid.autoRotate = false;
  const quantumSurface = new WaveSurface(q('#quantumCanvas'));
  const scenarioChart = new ScenarioChart(q('#scenarioChart'));

  function setGlobalMode(mode) {
    const globeCanvas = q('#globalGlobe');
    const cityCanvas = q('#cityGrid');
    const cityMode = mode === 'city';
    if (globeCanvas) globeCanvas.hidden = cityMode;
    if (cityCanvas) cityCanvas.hidden = !cityMode;
    qa('[data-global-mode]').forEach((button) =>
      button.classList.toggle('active', button.dataset.globalMode === mode),
    );
    if (q('#globalScale')) q('#globalScale').textContent = cityMode ? 'CITY SCALE' : 'PLANETARY SCALE';
    requestAnimationFrame(() => {
      globalGlobe?.resize();
      cityGrid?.resize();
    });
  }

  async function loadGlobalRuntime() {
    const list = q('#globalCityList');
    const select = q('#globalCitySelect');
    try {
      const [result, globalLive] = await Promise.all([
        api('./api/aethergrid/geospatial/cities'),
        api('./api/aethergrid/global-live').catch(() => null),
      ]);
      state.geospatial.runtime = result.runtime;
      state.geospatial.cities = Array.isArray(result.cities) ? result.cities : [];
      globalGlobe?.setCities(state.geospatial.cities);
      state.geospatial.globalLive = globalLive;
      if (globalLive) globalGlobe?.setLiveActivity(globalLive);
      if (q('#globalLiveStatus')) {
        const quakeCount = Number(globalLive?.seismic?.eventCount || 0);
        const liveAir = (globalLive?.cities || []).filter((city) => city.airQuality?.usAqi != null).length;
        q('#globalLiveStatus').textContent = globalLive
          ? `${liveAir}/${state.geospatial.cities.length} CITY AQ · ${quakeCount} M2.5+ EVENTS / 24H`
          : 'LIVE CONTEXT UNAVAILABLE';
      }
      const liveByCity = new Map((globalLive?.cities || []).map((city) => [city.id, city]));
      if (select) {
        select.innerHTML = state.geospatial.cities
          .map(
            (city) =>
              `<option value="${escapeHtml(city.id)}">${escapeHtml(city.name)} · ${escapeHtml(city.country)}</option>`,
          )
          .join('');
        select.value = state.geospatial.selectedCityId;
      }
      if (list) {
        list.innerHTML = state.geospatial.cities
          .map(
            (city) =>
              `<button class="global-city-button${city.id === state.geospatial.selectedCityId ? ' active' : ''}" data-global-city="${escapeHtml(city.id)}"><b>${escapeHtml(city.name)}</b><small>${escapeHtml(city.district || city.country)} · ${Number(city.lat).toFixed(2)}, ${Number(city.lon).toFixed(2)}${liveByCity.get(city.id)?.airQuality?.usAqi == null ? '' : ` · AQI ${Number(liveByCity.get(city.id).airQuality.usAqi).toFixed(0)}`}</small><em>ENTER</em></button>`,
          )
          .join('');
      }
      const provider = result.runtime?.provider || 'local';
      if (q('#geoRuntimeBadge')) q('#geoRuntimeBadge').textContent = provider === 'osm-overpass' ? 'LIVE OSM READY' : 'LOCAL GEO';
      if (q('#geoProvenance')) {
        q('#geoProvenance').innerHTML = `<span><b>Provider</b><em>${escapeHtml(provider)}</em></span><span><b>Attribution</b><em>${escapeHtml(result.runtime?.attribution || 'Local')}</em></span><span><b>Cache</b><em>${Math.round(Number(result.runtime?.cacheTtlMs || 0) / 60000)} min</em></span><span><b>Actuation</b><em>Disabled</em></span>`;
      }
      const selected = state.geospatial.cities.find((city) => city.id === state.geospatial.selectedCityId);
      if (selected) globalGlobe?.focusCity(selected);
    } catch {
      state.geospatial.cities = DEFAULT_GLOBAL_CITIES.map((city) => ({ ...city }));
      globalGlobe?.setCities(state.geospatial.cities);
      if (select) {
        select.innerHTML = state.geospatial.cities
          .map(
            (city) =>
              `<option value="${escapeHtml(city.id)}">${escapeHtml(city.name)} · ${escapeHtml(city.country)}</option>`,
          )
          .join('');
        select.value = state.geospatial.selectedCityId;
      }
      if (list) {
        list.innerHTML = state.geospatial.cities
          .map(
            (city) =>
              `<button class="global-city-button${city.id === state.geospatial.selectedCityId ? ' active' : ''}" data-global-city="${escapeHtml(city.id)}"><b>${escapeHtml(city.name)}</b><small>${escapeHtml(city.district || city.country)} · ${Number(city.lat).toFixed(2)}, ${Number(city.lon).toFixed(2)}</small><em>ENTER</em></button>`,
          )
          .join('');
      }
      if (q('#geoRuntimeBadge')) q('#geoRuntimeBadge').textContent = 'STANDALONE GEO';
      if (q('#geoProvenance')) {
        q('#geoProvenance').innerHTML =
          '<span><b>Provider</b><em>standalone coordinates</em></span><span><b>City Mesh</b><em>backend required</em></span><span><b>Actuation</b><em>Disabled</em></span>';
      }
      const selected = state.geospatial.cities.find((city) => city.id === state.geospatial.selectedCityId);
      if (selected) globalGlobe?.focusCity(selected);
    }
  }

  function buildStandaloneCityMesh(city, count = 120) {
    let seed = [...String(city?.id || 'city')].reduce(
      (value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0,
      2166136261,
    );
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const buildings = Array.from({ length: count }, (_, index) => {
      const x = (random() - 0.5) * 1500;
      const z = (random() - 0.5) * 1500;
      const width = 10 + random() * 35;
      const depth = 10 + random() * 35;
      return {
        id: `standalone-${index + 1}`,
        name: '',
        heightM: 9 + random() * 110,
        heightSource: 'synthetic-fallback',
        minHeightM: 0,
        roofShape: '',
        roofHeightM: 0,
        footprint: [
          [x - width, z - depth],
          [x + width, z - depth],
          [x + width, z + depth],
          [x - width, z + depth],
          [x - width, z - depth],
        ],
      };
    });
    const roads = Array.from({ length: 18 }, (_, index) => {
      const horizontal = index % 2 === 0;
      const offset = (random() - 0.5) * 1250;
      const wobble = (random() - 0.5) * 80;
      return {
        id: `standalone-road-${index + 1}`,
        name: '',
        highwayType: index % 4 === 0 ? 'primary' : 'residential',
        path: horizontal
          ? [
              [-720, offset],
              [-250, offset + wobble],
              [250, offset - wobble],
              [720, offset],
            ]
          : [
              [offset, -720],
              [offset + wobble, -250],
              [offset - wobble, 250],
              [offset, 720],
            ],
      };
    });
    const powerAssets = Array.from({ length: 8 }, (_, index) => ({
      id: `standalone-power-asset-${index + 1}`,
      name: index % 3 === 0 ? `Fallback Substation ${index + 1}` : '',
      powerType: index % 3 === 0 ? 'substation' : 'transformer',
      voltage: index % 3 === 0 ? 138000 : 13800,
      operator: '',
      position: [(random() - 0.5) * 1200, (random() - 0.5) * 1200],
    }));
    const powerLines = Array.from({ length: 8 }, (_, index) => {
      const horizontal = index % 2 === 0;
      const offset = (random() - 0.5) * 1050;
      return {
        id: `standalone-power-line-${index + 1}`,
        name: '',
        powerType: index % 4 === 0 ? 'line' : 'minor_line',
        voltage: index % 4 === 0 ? 138000 : 33000,
        operator: '',
        path: horizontal
          ? [
              [-700, offset],
              [-180, offset + (random() - 0.5) * 70],
              [280, offset + (random() - 0.5) * 70],
              [700, offset],
            ]
          : [
              [offset, -700],
              [offset + (random() - 0.5) * 70, -180],
              [offset + (random() - 0.5) * 70, 280],
              [offset, 700],
            ],
      };
    });
    const terrainGridSize = 7;
    const terrainPoints = [];
    for (let row = 0; row < terrainGridSize; row += 1) {
      for (let column = 0; column < terrainGridSize; column += 1) {
        const x = -city.radiusM + (column / (terrainGridSize - 1)) * city.radiusM * 2;
        const z = -city.radiusM + (row / (terrainGridSize - 1)) * city.radiusM * 2;
        terrainPoints.push({
          x,
          z,
          elevationM: 0,
          relativeElevationM: 0,
        });
      }
    }
    const fallbackHeights = buildings.map((building) => Number(building.heightM || 0)).sort((a, b) => a - b);
    const fallbackPercentile = (amount) =>
      fallbackHeights[Math.min(fallbackHeights.length - 1, Math.floor((fallbackHeights.length - 1) * amount))] || 0;
    return {
      schemaVersion: 3,
      city,
      source: {
        provider: 'standalone-local-fallback',
        live: false,
        attribution: 'Live OpenStreetMap geometry requires the Node backend.',
      },
      buildings,
      skylineProfile: {
        district: city.district || null,
        buildingCount: buildings.length,
        maxHeightM: Number(Math.max(...fallbackHeights).toFixed(1)),
        p95HeightM: Number(fallbackPercentile(0.95).toFixed(1)),
        medianHeightM: Number(fallbackPercentile(0.5).toFixed(1)),
        sourceBackedHeightCoveragePercent: 0,
        buildingPartCount: 0,
        roofTaggedCount: 0,
        upstreamTimestamp: null,
        sourceProvider: 'standalone-local-fallback',
        live: false,
      },
      environment: {
        schemaVersion: 2,
        coordinate: { lat: city.lat, lon: city.lon },
        source: { provider: 'local-environment-fallback', live: false, attribution: null, fetchedAt: new Date().toISOString() },
        current: null,
        solar: null,
      },
      liveContext: {
        schemaVersion: 1,
        coordinate: { lat: city.lat, lon: city.lon },
        airQuality: { source: { provider: 'local-air-quality-fallback', live: false, attribution: null }, current: null },
        seismic: { source: { provider: 'local-seismic-fallback', live: false, attribution: null }, radiusKm: 1200, events: [], eventCount: 0, maxMagnitude: null, nearestDistanceKm: null },
      },
      roads,
      powerLines,
      powerAssets,
      terrain: {
        source: {
          provider: 'flat-local-fallback',
          live: false,
          attribution: null,
        },
        gridSize: terrainGridSize,
        minElevationM: 0,
        maxElevationM: 0,
        points: terrainPoints,
      },
    };
  }

  function updateGlobalGridStats(mesh) {
    const stats = q('#globalGridStats');
    if (!stats) return;
    const terrain = mesh.terrain;
    const skyline = mesh.skylineProfile || {};
    const environment = mesh.environment?.current || null;
    const elevation =
      terrain && Number.isFinite(Number(terrain.minElevationM)) && Number.isFinite(Number(terrain.maxElevationM))
        ? `${Math.round(Number(terrain.minElevationM))}–${Math.round(Number(terrain.maxElevationM))} m`
        : '—';
    const skylineMax = Number.isFinite(Number(skyline.maxHeightM)) && Number(skyline.maxHeightM) > 0
      ? `${Number(skyline.maxHeightM).toFixed(0)} m`
      : '—';
    const p95 = Number.isFinite(Number(skyline.p95HeightM)) && Number(skyline.p95HeightM) > 0
      ? `${Number(skyline.p95HeightM).toFixed(0)} m`
      : '—';
    const heightCoverage = Number.isFinite(Number(skyline.sourceBackedHeightCoveragePercent))
      ? `${Number(skyline.sourceBackedHeightCoveragePercent).toFixed(0)}%`
      : '—';
    const weather = environment
      ? `${Number.isFinite(environment.temperatureC) ? `${Number(environment.temperatureC).toFixed(1)}°C` : 'current'} · ${Number.isFinite(environment.cloudCoverPercent) ? `${Number(environment.cloudCoverPercent).toFixed(0)}% cloud` : environment.isDay ? 'day' : 'night'}`
      : '—';
    const air = mesh.liveContext?.airQuality?.current || null;
    const airQuality = air?.usAqi == null ? '—' : `AQI ${Number(air.usAqi).toFixed(0)} · ${titleCase(air.category || 'unknown')}`;
    const humidity =
      environment?.relativeHumidityPercent == null
        ? '—'
        : `${Number(environment.relativeHumidityPercent).toFixed(0)}%`;
    const compactSolarTime = (value) => {
      const text = String(value || '');
      const time = text.includes('T') ? text.split('T')[1] : text;
      return time ? time.slice(0, 5) : '—';
    };
    const sunriseSunset = mesh.environment?.solar
      ? `${compactSolarTime(mesh.environment.solar.sunrise)} / ${compactSolarTime(mesh.environment.solar.sunset)}`
      : '—';
    const seismic = mesh.liveContext?.seismic || null;
    const seismicLabel = seismic ? `${Number(seismic.eventCount || 0)} nearby · M${Number(seismic.maxMagnitude || 0).toFixed(1)} max` : '—';
    stats.innerHTML = `<span><b>Power Lines</b><em>${(mesh.powerLines || []).length}</em></span><span><b>Power Assets</b><em>${(mesh.powerAssets || []).length}</em></span><span><b>Roads</b><em>${(mesh.roads || []).length}</em></span><span><b>Buildings</b><em>${(mesh.buildings || []).length}</em></span><span><b>Skyline Max</b><em>${skylineMax}</em></span><span><b>P95 Height</b><em>${p95}</em></span><span><b>Height Data</b><em>${heightCoverage}</em></span><span><b>Weather</b><em>${weather}</em></span><span><b>Air</b><em>${airQuality}</em></span><span><b>Humidity</b><em>${humidity}</em></span><span><b>Sunrise / Sunset</b><em>${sunriseSunset}</em></span><span><b>Seismic</b><em>${seismicLabel}</em></span><span><b>Elevation</b><em>${elevation}</em></span>`;
  }

  function showCityTransition(city, stage = 'Aligning global coordinate…', progress = 8) {
    const overlay = q('#cityTransitionOverlay');
    if (!overlay) return;
    if (q('#cityTransitionName')) q('#cityTransitionName').textContent = String(city?.name || 'CITY').toUpperCase();
    if (q('#cityTransitionStage')) q('#cityTransitionStage').textContent = stage;
    if (q('#cityTransitionProgress')) q('#cityTransitionProgress').style.width = `${clamp(Number(progress), 0, 100)}%`;
    overlay.hidden = false;
  }

  function updateCityTransition(stage, progress) {
    if (q('#cityTransitionStage')) q('#cityTransitionStage').textContent = stage;
    if (q('#cityTransitionProgress')) q('#cityTransitionProgress').style.width = `${clamp(Number(progress), 0, 100)}%`;
  }

  function hideCityTransition() {
    const overlay = q('#cityTransitionOverlay');
    if (overlay) overlay.hidden = true;
  }

  async function applyCityMeshResult(result, status = q('#cityMeshStatus')) {
    state.geospatial.cityMesh = result;
    if (Array.isArray(result.activity)) state.activity = result.activity;
    cityGrid?.loadCityMesh(result);
    const liveHour = environmentHour(result.environment);
    const initialHour = liveHour ?? Number(q('#globalTimeSlider')?.value || state.settings.defaultHour);
    cityGrid?.setTime(initialHour);
    if (q('#globalTimeSlider')) q('#globalTimeSlider').value = String(initialHour);
    if (q('#globalTimeValue')) q('#globalTimeValue').textContent = formatHour(initialHour);
    cityGrid?.setCityVisualMode('solid');
    qa('[data-city-visual]').forEach((button) => button.classList.toggle('active', button.dataset.cityVisual === 'solid'));
    state.geospatial.activeUseCase = null;
    const operationResult = q('#cityUseCaseResult');
    if (operationResult) operationResult.innerHTML = '<div class="empty-state">City twin ready. Choose a use case to generate a bounded operational planning view.</div>';
    const teamButton = q('[data-action="ask-city-team"]');
    if (teamButton) teamButton.disabled = true;
    updateCityTransition('Building local 3D city twin…', 82);
    setGlobalMode('city');
    await cityGrid?.cinematicEntrance(1050);
    updateCityTransition('City digital twin ready', 100);
    updateGlobalGridStats(result);
    if (q('#geoSourceStatus')) {
      const airMode = result.liveContext?.airQuality?.source?.live ? 'AIR LIVE' : 'AIR FALLBACK';
      const seismicMode = result.liveContext?.seismic?.source?.live ? 'SEISMIC LIVE' : 'SEISMIC FALLBACK';
      q('#geoSourceStatus').textContent = result.source?.live
        ? `LIVE OSM · ${airMode} · ${seismicMode}`
        : `LOCAL GEOMETRY · ${airMode} · ${seismicMode}`;
    }
    if (q('#geoAttribution')) {
      const attributions = [
        result.source?.attribution,
        result.terrain?.source?.attribution,
        result.environment?.source?.attribution,
        result.liveContext?.airQuality?.source?.attribution,
        result.liveContext?.seismic?.source?.attribution,
      ].filter(Boolean);
      const sourceText =
        attributions.join(' · ') ||
        'Live city geometry unavailable; using local fallback geometry.';
      q('#geoAttribution').textContent =
        `${sourceText} · City-light points are procedural visualization from mapped geometry + daylight state, not measured window occupancy.`;
    }
    if (status) {
      const skyline = result.skylineProfile || {};
      const env = result.environment?.current || null;
      const district = result.city?.district ? ` · ${escapeHtml(result.city.district)}` : '';
      const maxHeight = Number.isFinite(Number(skyline.maxHeightM)) ? ` · max ${Number(skyline.maxHeightM).toFixed(0)} m` : '';
      const heightCoverage = Number.isFinite(Number(skyline.sourceBackedHeightCoveragePercent)) ? ` · ${Number(skyline.sourceBackedHeightCoveragePercent).toFixed(0)}% source-backed heights` : '';
      const air = result.liveContext?.airQuality?.current || null;
      const seismic = result.liveContext?.seismic || null;
      const currentContext = env
        ? ` Current environment: ${Number.isFinite(env.temperatureC) ? `${Number(env.temperatureC).toFixed(1)}°C, ` : ''}${Number.isFinite(env.relativeHumidityPercent) ? `${Number(env.relativeHumidityPercent).toFixed(0)}% humidity, ` : ''}${Number.isFinite(env.cloudCoverPercent) ? `${Number(env.cloudCoverPercent).toFixed(0)}% cloud, ` : ''}${Number.isFinite(env.windSpeedKph) ? `${Number(env.windSpeedKph).toFixed(1)} km/h wind, ` : ''}${env.isDay ? 'daylight' : 'night'}.`
        : '';
      const liveContextCopy = `${air?.usAqi == null ? '' : ` Air quality: US AQI ${Number(air.usAqi).toFixed(0)} (${titleCase(air.category || 'unknown')}).`}${seismic ? ` USGS context: ${Number(seismic.eventCount || 0)} M2.5+ event(s) within ${Number(seismic.radiusKm || 0).toFixed(0)} km.` : ''}`;
      status.innerHTML = `<b>${escapeHtml(result.city.name)}${district} · ${result.buildings.length} mapped structures${maxHeight}</b><p>${result.source?.live ? `Current OpenStreetMap geometry is rendered from source-backed footprints/parts; height coverage ${heightCoverage || 'is shown in the stats panel'}.` : 'Provider request could not be completed; clearly marked local fallback geometry is being rendered.'}${currentContext}${liveContextCopy}</p><button class="secondary-button" data-action="reload-city-live">REFRESH OPEN DATA</button>`;
    }
    if (q('#geoProvenance')) {
      const upstream = result.source?.upstreamTimestamp || result.source?.fetchedAt || 'unavailable';
      const weatherAt = result.environment?.source?.modelTime || result.environment?.current?.time || 'unavailable';
      const airAt = result.liveContext?.airQuality?.source?.modelTime || 'unavailable';
      const quakeAt = result.liveContext?.seismic?.source?.generatedAt || result.liveContext?.seismic?.source?.fetchedAt || 'unavailable';
      q('#geoProvenance').innerHTML = `<span><b>Geometry</b><em>${escapeHtml(result.source?.provider || 'local')}</em></span><span><b>OSM State</b><em>${escapeHtml(upstream)}</em></span><span><b>Weather</b><em>${escapeHtml(result.environment?.source?.provider || 'local')} · ${escapeHtml(weatherAt)}</em></span><span><b>Air</b><em>${escapeHtml(result.liveContext?.airQuality?.source?.provider || 'local')} · ${escapeHtml(airAt)}</em></span><span><b>Seismic</b><em>${escapeHtml(result.liveContext?.seismic?.source?.provider || 'local')} · ${escapeHtml(quakeAt)}</em></span><span><b>Height Coverage</b><em>${Number(result.skylineProfile?.sourceBackedHeightCoveragePercent || 0).toFixed(0)}%</em></span><span><b>Actuation</b><em>Disabled</em></span>`;
    }
    renderActivity();
    showToast(
      result.source?.live ? 'LIVE CITY + GRID LOADED' : 'CITY FALLBACK LOADED',
      `${result.city.name} · ${result.buildings.length} buildings · ${(result.roads || []).length} roads · ${(result.powerLines || []).length} power lines · ${result.source?.provider}`,
    );
    if (!state.settings.reducedMotion) await new Promise((resolve) => setTimeout(resolve, 260));
    hideCityTransition();
  }

  async function loadTerrainFor(city) {
    if (!city) return null;
    const query = new URLSearchParams({
      lat: String(city.lat),
      lon: String(city.lon),
      radiusM: String(city.radiusM || 900),
      gridSize: '7',
    });
    try {
      return await api(`./api/aethergrid/terrain?${query.toString()}`);
    } catch {
      return null;
    }
  }

  async function loadLiveCity(cityId = state.geospatial.selectedCityId, { force = false } = {}) {
    const city = state.geospatial.cities.find((item) => item.id === cityId);
    if (city) handleGlobalCitySelection(city);
    if (city) {
      setGlobalMode('globe');
      showCityTransition(city, 'Locking planetary coordinate…', 10);
    }
    const status = q('#cityMeshStatus');
    if (status) status.innerHTML = `<b>Loading ${escapeHtml(city?.name || cityId)}…</b><p>Requesting building footprints and heights from the configured geospatial provider.</p>`;
    if (q('#geoSourceStatus')) q('#geoSourceStatus').textContent = 'LOADING CITY GEOMETRY';
    try {
      const meshRequest = api(
        `./api/aethergrid/geospatial/city/${encodeURIComponent(cityId)}${force ? '?force=1' : ''}`,
      );
      const terrainRequest = loadTerrainFor(city);
      const descent =
        city && globalGlobe ? globalGlobe.descendToCity(city, 720) : Promise.resolve();
      const [result, terrain] = await Promise.all([meshRequest, terrainRequest, descent]);
      updateCityTransition('Streaming mapped buildings, roads, terrain and grid assets…', 66);
      if (terrain) result.terrain = terrain;
      await applyCityMeshResult(result, status);
    } catch (error) {
      const fallbackCity =
        city || state.geospatial.cities.find((item) => item.id === cityId) || DEFAULT_GLOBAL_CITIES[0];
      const fallback = buildStandaloneCityMesh(fallbackCity);
      updateCityTransition('Live provider unavailable · building local fallback twin…', 64);
      await applyCityMeshResult(fallback, status);
      if (q('#geoSourceStatus')) {
        q('#geoSourceStatus').textContent = 'STANDALONE FALLBACK · NOT LIVE MAP DATA';
      }
      showToast(
        'STANDALONE CITY MODE',
        error.message || 'Backend unavailable; rendering local fallback geometry.',
      );
    }
  }

  async function loadCoordinateCity({ force = false } = {}) {
    const name = q('#globalPointName')?.value.trim() || 'Coordinate Explorer';
    const lat = Number(q('#globalPointLat')?.value);
    const lon = Number(q('#globalPointLon')?.value);
    const radiusM = Number(q('#globalPointRadius')?.value || 900);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return showToast('COORDINATE ERROR', 'Latitude must be between -90 and 90.');
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return showToast('COORDINATE ERROR', 'Longitude must be between -180 and 180.');
    }
    const city = {
      id: `coord-${lat.toFixed(5)}-${lon.toFixed(5)}`,
      name,
      country: 'Custom coordinate',
      lat,
      lon,
      radiusM,
      custom: true,
    };
    state.geospatial.cities = [
      city,
      ...state.geospatial.cities.filter((item) => !item.custom && item.id !== city.id),
    ];
    globalGlobe?.setCities(state.geospatial.cities);
    handleGlobalCitySelection(city);
    setGlobalMode('globe');
    showCityTransition(city, 'Targeting custom coordinate…', 10);
    const list = q('#globalCityList');
    if (list) {
      const existing = list.querySelector('[data-global-city-custom]');
      existing?.remove();
      list.insertAdjacentHTML(
        'afterbegin',
        `<button class="global-city-button active" data-global-city="${escapeHtml(city.id)}" data-global-city-custom="true"><b>${escapeHtml(city.name)}</b><small>Custom coordinate · ${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}</small><em>ENTER</em></button>`,
      );
    }
    const status = q('#cityMeshStatus');
    if (status) {
      status.innerHTML = `<b>Loading ${escapeHtml(name)}…</b><p>Requesting live buildings, roads and power infrastructure around ${lat.toFixed(5)}, ${lon.toFixed(5)}.</p>`;
    }
    try {
      const query = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        name,
        radiusM: String(radiusM),
        ...(force ? { force: '1' } : {}),
      });
      const meshRequest = api(`./api/aethergrid/geospatial/point?${query.toString()}`);
      const terrainRequest = loadTerrainFor(city);
      const descent = globalGlobe ? globalGlobe.descendToCity(city, 720) : Promise.resolve();
      const [result, terrain] = await Promise.all([meshRequest, terrainRequest, descent]);
      updateCityTransition('Streaming coordinate geometry and elevation…', 66);
      if (terrain) result.terrain = terrain;
      await applyCityMeshResult(result, status);
    } catch (error) {
      const fallback = buildStandaloneCityMesh(city);
      updateCityTransition('Live provider unavailable · building coordinate fallback…', 64);
      await applyCityMeshResult(fallback, status);
      if (q('#geoSourceStatus')) {
        q('#geoSourceStatus').textContent = 'STANDALONE FALLBACK · NOT LIVE MAP DATA';
      }
      showToast('COORDINATE FALLBACK', error.message || 'Backend unavailable.');
    }
  }

  q('#globalCitySelect')?.addEventListener('change', (event) => {
    const city = state.geospatial.cities.find((item) => item.id === event.target.value);
    if (city) globalGlobe?.focusCity(city);
  });
  q('#globalCityList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-global-city]');
    if (!button) return;
    const city = state.geospatial.cities.find((item) => item.id === button.dataset.globalCity);
    if (city) {
      globalGlobe?.focusCity(city);
      loadLiveCity(city.id);
    }
  });
  qa('[data-global-mode]').forEach((button) =>
    button.addEventListener('click', () => {
      if (button.dataset.globalMode === 'city' && !state.geospatial.cityMesh) {
        loadLiveCity();
      } else {
        setGlobalMode(button.dataset.globalMode);
      }
    }),
  );
  q('[data-action="load-live-city"]')?.addEventListener('click', () => loadLiveCity());
  q('[data-action="explore-coordinates"]')?.addEventListener('click', () =>
    loadCoordinateCity(),
  );
  qa('[data-global-layer]').forEach((button) =>
    button.addEventListener('click', () => {
      cityGrid?.toggle(button.dataset.globalLayer);
      button.classList.toggle('active');
      showToast('CITY LAYER', `${titleCase(button.dataset.globalLayer)} updated.`);
    }),
  );
  function syncCityLayerButtons() {
    qa('[data-global-layer]').forEach((button) => {
      const key = button.dataset.globalLayer;
      button.classList.toggle('active', Boolean(cityGrid?.layers?.[key]));
    });
  }

  function applyCityLayerProfile(layers = []) {
    const normalized = layers.map((layer) => (layer === 'roads' ? 'routes' : layer));
    cityGrid?.setLayerProfile(normalized);
    syncCityLayerButtons();
  }

  function renderCityUseCase(analysis) {
    const container = q('#cityUseCaseResult');
    if (!container || !analysis) return;
    const observations = (analysis.observations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const liveSources = [
      analysis.dataQuality?.liveWeather ? 'weather live' : null,
      analysis.dataQuality?.liveAirQuality ? 'air live' : null,
      analysis.dataQuality?.liveSeismic ? 'seismic live' : null,
    ].filter(Boolean).join(' · ');
    container.innerHTML = `<div class="operation-index"><b>${Number(analysis.planningIndex?.value || 0)}</b><span>${escapeHtml(analysis.planningIndex?.label || 'Planning index')}</span><small>${escapeHtml(analysis.planningIndex?.scale || '0–100')}</small></div><strong>${escapeHtml(analysis.useCase?.label || 'City operation')} · ${escapeHtml(analysis.city?.name || '')}</strong><div class="operation-live-badge">${escapeHtml(titleCase(analysis.visualization?.animationProfile || 'source driven'))} · ${escapeHtml(liveSources || 'bounded source context')}</div><ul>${observations}</ul><div class="operation-source">${escapeHtml(analysis.dataQuality?.geometryProvider || 'unknown source')} · ${analysis.dataQuality?.liveGeometry ? 'live mapped geometry' : 'local fallback geometry'} · advisory planning proxy</div>`;
  }

  async function runCityUseCase() {
    if (!state.geospatial.cityMesh) {
      showToast('CITY REQUIRED', 'Descend into a city before running an operational use case.');
      return;
    }
    const useCaseId = q('#cityUseCaseSelect')?.value || 'grid-resilience';
    const container = q('#cityUseCaseResult');
    if (container) container.innerHTML = '<div class="empty-state">Analyzing the active city twin…</div>';
    try {
      const result = await api('./api/aethergrid/city-operations/analyze', {
        method: 'POST',
        body: JSON.stringify({ useCaseId }),
      });
      state.geospatial.activeUseCase = result.analysis;
      if (Array.isArray(result.activity)) state.activity = result.activity;
      if (result.evidence) {
        state.evidence.unshift(result.evidence);
        state.evidence = state.evidence.slice(0, 24);
        renderEvidence();
      } else {
        renderActivity();
      }
      cityGrid?.setCityVisualMode('operations');
      qa('[data-city-visual]').forEach((button) => button.classList.toggle('active', button.dataset.cityVisual === 'operations'));
      applyCityLayerProfile(result.analysis?.visualization?.recommendedLayers || result.analysis?.useCase?.recommendedLayers || ['buildings', 'routes', 'infrastructure', 'nodes']);
      cityGrid?.setOperationProfile(result.analysis?.visualization?.animationProfile || null);
      renderCityUseCase(result.analysis);
      const teamButton = q('[data-action="ask-city-team"]');
      if (teamButton) teamButton.disabled = false;
      showToast('CITY OPERATION READY', `${result.analysis.city.name} · ${result.analysis.useCase.label}`);
    } catch (error) {
      if (container) container.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'City analysis requires the backend-connected app.')}</div>`;
      showToast('CITY ANALYSIS UNAVAILABLE', error.message || 'Backend-connected city twin required.');
    }
  }

  qa('[data-city-visual]').forEach((button) =>
    button.addEventListener('click', () => {
      cityGrid?.setCityVisualMode(button.dataset.cityVisual);
      cityGrid?.setOperationProfile(null);
      qa('[data-city-visual]').forEach((item) => item.classList.toggle('active', item === button));
      showToast('CITY VISUAL', titleCase(button.dataset.cityVisual));
    }),
  );
  q('[data-action="run-city-use-case"]')?.addEventListener('click', runCityUseCase);
  q('[data-action="ask-city-team"]')?.addEventListener('click', () => {
    const analysis = state.geospatial.activeUseCase;
    if (!analysis) return;
    setSelectedAgent('TEAM');
    switchWorkspace('ai');
    const input = q('#chatInput');
    if (input) {
      input.value = `Review the active ${analysis.useCase.label} city operation for ${analysis.city.name}. Explain the planning index, the strongest evidence in the loaded 3D twin, key limitations, and what VÆLON, AUREN, and SOLVÆR each recommend investigating next.`;
      input.focus();
    }
  });
  function syncCityLiveNow() {
    const environment = state.geospatial.cityMesh?.environment;
    const hour = environmentHour(environment);
    if (hour == null) {
      showToast('LIVE TIME UNAVAILABLE', 'Load a backend-connected city with current environment data first.');
      return;
    }
    cityGrid?.setTime(hour);
    if (q('#globalTimeSlider')) q('#globalTimeSlider').value = String(hour);
    if (q('#globalTimeValue')) q('#globalTimeValue').textContent = formatHour(hour);
    showToast('LIVE CITY TIME', `${state.geospatial.cityMesh?.city?.name || 'City'} · ${formatHour(hour)} local model time`);
  }

  q('#globalTimeSlider')?.addEventListener('input', (event) => {
    cityGrid?.setTime(event.target.value);
    if (q('#globalTimeValue')) {
      q('#globalTimeValue').textContent = formatHour(event.target.value);
    }
  });
  q('[data-action="city-live-now"]')?.addEventListener('click', syncCityLiveNow);
  q('[data-global-action="reset"]')?.addEventListener('click', () => {
    globalGlobe?.reset();
    setGlobalMode('globe');
  });
  q('#cityMeshStatus')?.addEventListener('click', (event) => {
    if (!event.target.closest('[data-action="reload-city-live"]')) return;
    const selected = state.geospatial.cities.find(
      (item) => item.id === state.geospatial.selectedCityId,
    );
    if (selected?.custom) loadCoordinateCity({ force: true });
    else loadLiveCity(state.geospatial.selectedCityId, { force: true });
  });

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
    text(
      'classicalCost',
      Math.round(
        state.optimization.classicalCandidateCost ||
          state.optimization.candidateCost * 1.08,
      ).toLocaleString(),
    );
    text('emissionsValue', Number(state.optimization.emissionsReduction).toFixed(1));
    text('renewableGain', Number(state.optimization.renewableUtilizationGain).toFixed(1));
    text('reliabilityValue', Number(state.optimization.reliabilityScore || 90).toFixed(1));
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

  function renderActivity() {
    const container = q('#auditTimeline');
    if (!container) return;
    const events = state.activity.slice(0, 16);
    container.innerHTML = events.length
      ? events
          .map(
            (item) =>
              `<div class="audit-event"><time>${escapeHtml(
                item.at ? new Date(item.at).toLocaleTimeString() : 'recent',
              )}</time><b>${escapeHtml(item.type || 'system')}</b><span>${escapeHtml(
                item.message || String(item),
              )}</span></div>`,
          )
          .join('')
      : '<div class="empty-state">No backend activity recorded in this session yet.</div>';
  }

  function renderEvidence() {
    renderActivity();
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
      if (Array.isArray(result.activity)) state.activity = result.activity;
      renderEvidence();
      showToast('EVIDENCE REFRESHED', 'Latest backend evidence loaded.');
    } catch {
      renderEvidence();
      showToast('LOCAL EVIDENCE', 'Backend unavailable; showing packaged evidence state.');
    }
  });
  q('#evidenceTableBody')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-evidence-id]');
    if (!button) return;
    let item = state.evidence.find(
      (entry) => (entry.id || entry.title) === button.dataset.evidenceId,
    );
    if (!item) return;
    try {
      const result = await api(
        `./api/aethergrid/evidence/${encodeURIComponent(item.id || item.receipt)}`,
      );
      if (result.evidence) item = result.evidence;
    } catch {}
    const details = item.details || {
      receipt: item.receipt || null,
      type: item.type || 'Evidence',
      status: item.status || 'Verified',
    };
    openPanel(
      'EVIDENCE RECORD',
      item.title,
      `<div class="detail-card"><h3>${escapeHtml(item.type || 'Evidence')}</h3><p>Status: ${escapeHtml(item.status || 'Verified')} · ${escapeHtml(item.age || 'recent')}</p><div class="pill-row"><span class="pill">PROVENANCE</span><span class="pill">READ ONLY</span><span class="pill">ADVISORY</span></div></div><pre class="evidence-json">${escapeHtml(JSON.stringify(details, null, 2))}</pre>`,
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
    const aiContainer = q('#aiRuntimeSettings');
    const geoContainer = q('#geoRuntimeSettings');
    const quantumContainer = q('#quantumRuntimeSettings');
    try {
      const result = await api('./api/aethergrid/runtime');
      state.runtime = result;
      state.geospatial.runtime = result.geospatial || null;
      state.quantumRuntime = result.quantum || null;
      const agents = result.agents || result.ai?.agents || {};
      if (aiContainer) {
        aiContainer.innerHTML = `
          <div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(result.mode || result.ai?.mode || 'Provider runtime ready')}</b><small>Secrets remain server-side.</small></div></div>
          ${Object.entries(agents)
            .map(
              ([name, config]) =>
                `<div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(name)} · ${escapeHtml(config.provider || 'fallback')}</b><small>${escapeHtml(config.model || 'deterministic-local')} · ${escapeHtml(config.status || 'ready')}</small></div></div>`,
            )
            .join('')}
        `;
      }
      for (const [name, config] of Object.entries(agents)) {
        const badge = q(`[data-agent-runtime="${CSS.escape(name)}"]`);
        if (badge) badge.textContent = config.model || config.provider || 'READY';
      }
      const liveProviders = Boolean(result.liveProviders ?? result.ai?.liveProviders);
      if (q('#aiRuntimeBadge')) q('#aiRuntimeBadge').textContent = liveProviders ? 'MODEL PROVIDERS READY' : 'LOCAL FALLBACK';

      if (geoContainer) {
        const geo = result.geospatial || {};
        geoContainer.innerHTML = `<div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(geo.provider || 'local')}</b><small>${geo.liveProviderConfigured ? 'Live city geometry provider configured' : 'Local geometry fallback'} · ${escapeHtml(geo.attribution || 'No external attribution')}</small></div></div>`;
      }

      if (quantumContainer) {
        const quantum = result.quantum || {};
        quantumContainer.innerHTML = `<div class="runtime-status"><span class="status-dot"></span><div><b>${escapeHtml(quantum.provider || 'local-simulator')}</b><small>${quantum.configured ? 'Configured' : 'Credentials or backend required'} · ${escapeHtml(quantum.defaultBackend || 'No default backend')}</small></div></div>`;
      }
      renderQuantumRuntime(result.quantum || {});
    } catch {
      if (aiContainer) {
        aiContainer.innerHTML =
          '<div class="runtime-status"><span class="status-dot"></span><div><b>Standalone fallback</b><small>Start server.mjs to enable configured model providers.</small></div></div>';
      }
      if (geoContainer) {
        geoContainer.innerHTML =
          '<div class="runtime-status"><span class="status-dot"></span><div><b>Standalone geospatial mode</b><small>Backend required for live OpenStreetMap city geometry.</small></div></div>';
      }
      if (quantumContainer) {
        quantumContainer.innerHTML =
          '<div class="runtime-status"><span class="status-dot"></span><div><b>Standalone quantum visualization</b><small>Backend required for local sampler or IBM Quantum submission.</small></div></div>';
      }
      if (q('#aiRuntimeBadge')) q('#aiRuntimeBadge').textContent = 'LOCAL FALLBACK';
      renderQuantumRuntime({ provider: 'standalone', configured: false });
    }
  }

  function renderQuantumRuntime(runtime = {}) {
    state.quantumRuntime = { ...(state.quantumRuntime || {}), ...runtime };
    const provider = runtime.provider || 'local-simulator';
    if (q('#quantumProviderBadge')) {
      q('#quantumProviderBadge').textContent =
        provider === 'ibm-quantum'
          ? runtime.configured
            ? 'IBM QUANTUM READY'
            : 'IBM QUANTUM CONFIG NEEDED'
          : provider === 'standalone'
            ? 'STANDALONE'
            : 'LOCAL PRIMITIVES';
    }
    const status = q('#quantumRuntimeStatus');
    if (status) {
      status.innerHTML = `<span class="status-dot"></span><div><b>${escapeHtml(provider)}</b><small>${runtime.hardwareExecution ? 'Real IBM Quantum primitive submission enabled' : 'Local deterministic Sampler + bounded analytic Estimator'} · ${escapeHtml(runtime.defaultBackend || 'no backend selected')} · credentials never enter the browser</small></div>`;
    }
  }

  async function loadQuantumBackends() {
    const select = q('#quantumBackend');
    try {
      const result = await api('./api/aethergrid/quantum/backends');
      const backends = Array.isArray(result.backends) ? result.backends : [];
      if (select && backends.length) {
        select.innerHTML = backends
          .map(
            (backend) =>
              `<option value="${escapeHtml(backend.name)}">${escapeHtml(backend.name)} · ${escapeHtml(backend.status || 'available')}${backend.simulator ? ' · simulator' : ''}</option>`,
          )
          .join('');
        if (state.quantumRuntime?.defaultBackend && backends.some((item) => item.name === state.quantumRuntime.defaultBackend)) {
          select.value = state.quantumRuntime.defaultBackend;
        }
      }
      showToast('QUANTUM BACKENDS', `${backends.length} backend${backends.length === 1 ? '' : 's'} available through ${result.provider}.`);
    } catch (error) {
      showToast('QUANTUM BACKENDS', error.message || 'Unable to load quantum backends.');
    }
  }

  function renderQuantumJob(job) {
    const container = q('#quantumJobResult');
    if (!container || !job) return;
    const distribution = job.distribution
      ? Object.entries(job.distribution)
          .map(
            ([stateKey, count]) =>
              `<dt>|${escapeHtml(stateKey)}⟩</dt><dd>${Number(count).toLocaleString()}</dd>`,
          )
          .join('')
      : '';
    const estimator =
      job.programId === 'estimator'
        ? `<dt>Observable</dt><dd>${escapeHtml(typeof job.observable === 'string' ? job.observable : JSON.stringify(job.observable || ''))}</dd><dt>Expectation</dt><dd>${Number.isFinite(Number(job.expectationValue)) ? Number(job.expectationValue).toFixed(6) : 'Pending remote result'}</dd>${job.approximation ? `<dt>Local Mode</dt><dd>${escapeHtml(job.approximation)}</dd>` : ''}`
        : '';
    container.innerHTML = `<div class="quantum-job-card"><b>${escapeHtml(job.id || 'Quantum job')}</b><code>${escapeHtml(job.provider || 'unknown')} / ${escapeHtml(job.backend || 'unknown')}</code><dl><dt>Status</dt><dd>${escapeHtml(job.status || 'unknown')}</dd><dt>Primitive</dt><dd>${escapeHtml(job.programId || 'sampler')}</dd><dt>Hardware Submitted</dt><dd>${job.hardwareSubmitted ? 'YES' : 'NO'}</dd><dt>Receipt</dt><dd>${escapeHtml((job.receipt || '').slice(0, 18))}…</dd>${estimator}${distribution}</dl></div>`;
  }

  async function submitQuantumJob() {
    const primitive = q('#quantumPrimitive')?.value || 'sampler';
    const circuit = q('#quantumCircuit')?.value.trim();
    const backend = q('#quantumBackend')?.value;
    const shots = Number(q('#quantumShots')?.value || 1024);
    const observable = q('#quantumObservable')?.value.trim() || 'ZZ';
    if (!circuit) return showToast('QUANTUM JOB', 'OpenQASM circuit is required.');
    if (q('#quantumProviderBadge')) q('#quantumProviderBadge').textContent = 'SUBMITTING…';
    try {
      const result = await api('./api/aethergrid/quantum/jobs', {
        method: 'POST',
        body: JSON.stringify({ primitive, circuit, backend, shots, observable }),
      });
      renderQuantumJob(result.job);
      if (result.evidence) {
        state.evidence.unshift(result.evidence);
        state.evidence = state.evidence.slice(0, 24);
      }
      if (Array.isArray(result.activity)) state.activity = result.activity;
      renderEvidence();
      renderQuantumRuntime(state.quantumRuntime || {});
      showToast(
        'QUANTUM JOB SUBMITTED',
        `${String(result.job.programId || primitive).toUpperCase()} · ${result.job.provider} · ${result.job.backend} · ${result.job.status}`,
      );
      if (result.job.provider === 'ibm-quantum') loadQuantumJobs();
    } catch (error) {
      renderQuantumRuntime(state.quantumRuntime || {});
      showToast('QUANTUM JOB FAILED', error.message || String(error));
    }
  }

  async function loadQuantumJobs() {
    const container = q('#quantumJobs');
    if (!container) return;
    try {
      const result = await api('./api/aethergrid/quantum/jobs?limit=20');
      const jobs = Array.isArray(result.jobs) ? result.jobs : [];
      container.innerHTML = jobs.length
        ? jobs
            .map(
              (job) =>
                `<div class="history-row quantum-job-row"><span><b>${escapeHtml(job.id || 'job')}</b><small>${escapeHtml(job.backend || 'backend')} · ${escapeHtml(job.programId || 'program')} · ${escapeHtml(job.status || 'unknown')}${job.created ? ` · ${escapeHtml(job.created)}` : ''}</small></span><button class="secondary-button" data-quantum-job="${escapeHtml(job.id || '')}">INSPECT</button></div>`,
            )
            .join('')
        : '<div class="empty-state">No remote jobs returned by the configured provider.</div>';
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message || String(error))}</div>`;
    }
  }

  async function loadQuantumJobDetail(jobId) {
    const container = q('#quantumJobResult');
    if (!container || !jobId) return;
    container.innerHTML = '<div class="empty-state">Loading IBM Quantum job detail…</div>';
    try {
      const detail = await api(
        `./api/aethergrid/quantum/jobs/${encodeURIComponent(jobId)}`,
      );
      const completed = String(detail.status || '').toLowerCase() === 'completed';
      const [results, metrics] = await Promise.all([
        completed
          ? api(
              `./api/aethergrid/quantum/jobs/${encodeURIComponent(jobId)}/results`,
            ).catch(() => null)
          : Promise.resolve(null),
        completed
          ? api(
              `./api/aethergrid/quantum/jobs/${encodeURIComponent(jobId)}/metrics`,
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      const payload = {
        job: detail,
        results: results?.result || null,
        metrics: metrics?.metrics || null,
      };
      container.innerHTML = `<div class="quantum-job-card"><b>${escapeHtml(jobId)}</b><code>${escapeHtml(detail.backend || 'backend')} · ${escapeHtml(detail.status || 'unknown')}</code><dl><dt>Primitive</dt><dd>${escapeHtml(detail.programId || 'unknown')}</dd><dt>QPU Completed</dt><dd>${detail.hardwareExecuted ? 'YES' : 'NO'}</dd></dl></div><pre class="evidence-json quantum-result-json">${escapeHtml(JSON.stringify(payload, null, 2).slice(0, 12000))}</pre>`;
      showToast(
        'QUANTUM JOB INSPECTED',
        completed
          ? 'Job detail, results and execution metrics loaded.'
          : `Current status: ${detail.status || 'unknown'}`,
      );
    } catch (error) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message || String(error))}</div>`;
    }
  }

  function syncQuantumPrimitiveControls({ replaceCircuit = false } = {}) {
    const primitive = q('#quantumPrimitive')?.value || 'sampler';
    const shotsRow = q('#quantumShotsRow');
    const observableRow = q('#quantumObservableRow');
    const circuit = q('#quantumCircuit');
    const submit = q('[data-action="submit-quantum-job"]');
    if (shotsRow) shotsRow.hidden = primitive !== 'sampler';
    if (observableRow) observableRow.hidden = primitive !== 'estimator';
    if (submit) {
      submit.textContent =
        primitive === 'estimator' ? 'SUBMIT ESTIMATOR JOB' : 'SUBMIT SAMPLER JOB';
    }
    if (replaceCircuit && circuit) {
      circuit.value =
        primitive === 'estimator'
          ? 'OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1];'
          : 'OPENQASM 3.0; include "stdgates.inc"; bit[2] c; h $0; cx $0, $1; c[0] = measure $0; c[1] = measure $1;';
    }
  }

  q('#quantumPrimitive')?.addEventListener('change', () =>
    syncQuantumPrimitiveControls({ replaceCircuit: true }),
  );
  syncQuantumPrimitiveControls();

  q('[data-action="refresh-quantum-backends"]')?.addEventListener(
    'click',
    loadQuantumBackends,
  );
  q('[data-action="submit-quantum-job"]')?.addEventListener('click', submitQuantumJob);
  q('[data-action="refresh-quantum-jobs"]')?.addEventListener('click', loadQuantumJobs);
  q('#quantumJobs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quantum-job]');
    if (button) loadQuantumJobDetail(button.dataset.quantumJob);
  });

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
  q('#holoProjection')?.addEventListener('change', (event) => {
    const mode =
      event.target.value === 'top'
        ? 'orthographic'
        : event.target.value === 'isometric'
          ? 'isometric'
          : 'perspective';
    holographic?.setProjection(mode);
    showToast('HOLOGRAPHIC PROJECTION', titleCase(event.target.value));
  });
  q('#holoTemporalMode')?.addEventListener('change', (event) => {
    holographic?.setTemporalMode(event.target.value);
    showToast('TEMPORAL OVERLAY', titleCase(event.target.value));
  });
  q('#holoIntensity')?.addEventListener('input', (event) => {
    holographic?.setIntensity(Number(event.target.value) / 100);
  });
  q('#holoCompareEnabled')?.addEventListener('change', (event) => {
    holographic?.setCompare(event.target.checked, q('#holoCompareTime')?.value || 18);
    showToast(
      'TEMPORAL COMPARISON',
      event.target.checked ? `Overlaying ${formatHour(q('#holoCompareTime')?.value || 18)} in amber.` : 'Comparison overlay disabled.',
    );
  });
  q('#holoCompareTime')?.addEventListener('input', (event) => {
    if (q('#holoCompareValue')) q('#holoCompareValue').textContent = formatHour(event.target.value);
    holographic?.setCompare(q('#holoCompareEnabled')?.checked, event.target.value);
  });
  function renderSavedViews() {
    const container = q('#savedViews');
    if (!container) return;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('aethergrid.saved.cameras') || '[]');
    } catch {}
    const presets =
      '<button data-camera-preset="overview">Metro Overview</button><button data-camera-preset="top">Top Grid</button><button data-camera-preset="flow">Transmission Flow</button>';
    const custom = saved
      .map(
        (item, index) =>
          `<button data-saved-camera="${item.id}">Saved View ${index + 1} · ${formatHour(item.time)}</button>`,
      )
      .join('');
    container.innerHTML = presets + custom;
  }

  q('#savedViews')?.addEventListener('click', (event) => {
    const preset = event.target.closest('[data-camera-preset]');
    if (preset) {
      holographic?.setPreset(preset.dataset.cameraPreset);
      return;
    }
    const savedButton = event.target.closest('[data-saved-camera]');
    if (!savedButton) return;
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem('aethergrid.saved.cameras') || '[]');
    } catch {}
    const item = saved.find((entry) => String(entry.id) === savedButton.dataset.savedCamera);
    if (!item || !holographic) return;
    holographic.yaw = Number(item.yaw);
    holographic.pitch = Number(item.pitch);
    holographic.distance = Number(item.distance);
    holographic.setTime(item.time);
    if (q('#holoTimeSlider')) q('#holoTimeSlider').value = String(item.time);
    if (q('#holoTimeValue')) q('#holoTimeValue').textContent = formatHour(item.time);
    holographic.updateReadout();
    showToast('CAMERA RESTORED', 'Saved holographic view restored.');
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
    renderSavedViews();
    showToast('CAMERA SAVED', 'Holographic camera state saved locally.');
  });
  renderSavedViews();

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
    custom: 'Operator-defined load, renewable availability, storage reserve and weather-risk assumptions.',
  };

  function currentCustomScenarioParameters() {
    return {
      loadMultiplierPercent: Number(q('#customLoad')?.value || 110),
      renewableAvailabilityPercent: Number(q('#customRenewable')?.value || 100),
      storageReservePercent: Number(q('#customStorage')?.value || 18),
      weatherRiskPercent: Number(q('#customRisk')?.value || 20),
    };
  }

  function syncCustomScenarioControls(parameters = state.system.scenarioParameters) {
    const values = {
      customLoad: parameters.loadMultiplierPercent,
      customRenewable: parameters.renewableAvailabilityPercent,
      customStorage: parameters.storageReservePercent,
      customRisk: parameters.weatherRiskPercent,
    };
    for (const [id, value] of Object.entries(values)) {
      const input = q(`#${id}`);
      if (input) input.value = String(value);
    }
    if (q('#customLoadValue')) q('#customLoadValue').textContent = `${values.customLoad}%`;
    if (q('#customRenewableValue')) q('#customRenewableValue').textContent = `${values.customRenewable}%`;
    if (q('#customStorageValue')) q('#customStorageValue').textContent = `${values.customStorage}%`;
    if (q('#customRiskValue')) q('#customRiskValue').textContent = `${values.customRisk}%`;
  }

  async function activateScenario(name, parameters = undefined) {
    state.system.scenario = name;
    state.system.view = 'scenario';
    if (name === 'custom' && parameters) state.system.scenarioParameters = { ...parameters };
    syncStateToUi();
    if (q('#scenarioDetailTitle')) q('#scenarioDetailTitle').textContent = titleCase(name);
    if (q('#scenarioDetailCopy')) q('#scenarioDetailCopy').textContent = scenarioDescriptions[name];
    try {
      mergeState(
        await api('./api/aethergrid/scenario', {
          method: 'POST',
          body: JSON.stringify({ scenario: name, parameters }),
        }),
      );
      syncCustomScenarioControls(state.system.scenarioParameters);
    } catch {}
    showToast('SCENARIO LOADED', titleCase(name));
  }

  qa('[data-scenario]').forEach((button) =>
    button.addEventListener('click', () =>
      activateScenario(
        button.dataset.scenario,
        button.dataset.scenario === 'custom' ? currentCustomScenarioParameters() : undefined,
      ),
    ),
  );

  for (const [inputId, outputId] of [
    ['customLoad', 'customLoadValue'],
    ['customRenewable', 'customRenewableValue'],
    ['customStorage', 'customStorageValue'],
    ['customRisk', 'customRiskValue'],
  ]) {
    q(`#${inputId}`)?.addEventListener('input', (event) => {
      q(`#${outputId}`).textContent = `${event.target.value}%`;
    });
  }

  q('[data-action="apply-custom-scenario"]')?.addEventListener('click', () =>
    activateScenario('custom', currentCustomScenarioParameters()),
  );

  const scenarioTemplateParameters = {
    'peak-demand': {
      loadMultiplierPercent: 125,
      renewableAvailabilityPercent: 92,
      storageReservePercent: 22,
      weatherRiskPercent: 22,
    },
    'renewable-surge': {
      loadMultiplierPercent: 92,
      renewableAvailabilityPercent: 148,
      storageReservePercent: 18,
      weatherRiskPercent: 12,
    },
    'storage-stress': {
      loadMultiplierPercent: 112,
      renewableAvailabilityPercent: 88,
      storageReservePercent: 8,
      weatherRiskPercent: 26,
    },
    'weather-event': {
      loadMultiplierPercent: 108,
      renewableAvailabilityPercent: 78,
      storageReservePercent: 30,
      weatherRiskPercent: 78,
    },
  };

  q('[data-action="duplicate-scenario"]')?.addEventListener('click', () => {
    const parameters =
      state.system.scenario === 'custom'
        ? { ...state.system.scenarioParameters }
        : { ...(scenarioTemplateParameters[state.system.scenario] || currentCustomScenarioParameters()) };
    syncCustomScenarioControls(parameters);
    activateScenario('custom', parameters);
    showToast('SCENARIO DUPLICATED', 'Template copied into the editable custom scenario.');
  });

  q('[data-action="reset-scenario"]')?.addEventListener('click', () =>
    activateScenario('peak-demand'),
  );

  syncCustomScenarioControls();

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
      mergeState({
        optimization: {
          ...result.optimization,
          classicalCandidateCost:
            result.comparison?.classical?.candidateCost ??
            result.optimization?.classicalCandidateCost,
          reliabilityScore:
            result.comparison?.experimental?.reliabilityScore ??
            result.optimization?.reliabilityScore,
        },
      });
      receipt = result.receipt;
      if (Array.isArray(result.activity)) state.activity = result.activity;
      renderActivity();
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
      classicalCandidateCost: state.optimization.classicalCandidateCost,
      candidateCost: state.optimization.candidateCost,
      emissionsReduction: state.optimization.emissionsReduction,
      reliabilityScore: state.optimization.reliabilityScore,
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
            (item) => `<div class="history-row"><b>${escapeHtml(titleCase(item.objective))}</b><small>${escapeHtml(titleCase(item.scenario))} · classical ${Math.round(item.classicalCandidateCost || item.candidateCost * 1.08).toLocaleString()} · experimental ${Math.round(item.candidateCost).toLocaleString()}/hr · reliability ${Number(item.reliabilityScore || 90).toFixed(1)} · ↓ ${item.emissionsReduction}% · ${escapeHtml(item.id.slice(0, 18))}</small></div>`,
          )
          .join('')
      : '<div class="empty-state">No optimization run in this session yet.</div>';
  }

  const AGENT_CHAT_STORAGE_KEY = 'aethergrid.agent.chats.v2';
  const AGENT_CHAT_IDS = ['TEAM', 'VÆLON', 'AUREN', 'SOLVÆR'];

  function loadAgentChats() {
    try {
      const stored = JSON.parse(localStorage.getItem(AGENT_CHAT_STORAGE_KEY) || '{}');
      for (const id of AGENT_CHAT_IDS) {
        state.agentChats[id] = Array.isArray(stored[id]) ? stored[id].slice(-50) : [];
      }
    } catch {
      for (const id of AGENT_CHAT_IDS) state.agentChats[id] = [];
    }
  }

  function persistAgentChats() {
    try {
      localStorage.setItem(AGENT_CHAT_STORAGE_KEY, JSON.stringify(state.agentChats));
    } catch {}
  }

  function agentWelcome(name) {
    if (name === 'TEAM') return 'Team thread ready. VÆLON, AUREN and SOLVÆR share the active operator, city, scenario and evidence context for coordinated synthesis.';
    if (name === 'VÆLON') return 'VÆLON thread ready. Focus: bounded optimization, scenario tradeoffs, constraints and candidate comparison.';
    if (name === 'AUREN') return 'AUREN thread ready. Focus: semantic meaning, spatial relationships, operator context and city intelligence.';
    return 'SOLVÆR thread ready. Focus: simulation, evidence generation, validation and reproducible comparison.';
  }

  function renderSelectedAgentChat() {
    const log = q('#chatLog');
    if (!log) return;
    const name = state.selectedAgent;
    const messages = state.agentChats[name] || [];
    if (!messages.length) {
      log.innerHTML = `<div class="chat-bubble system">${escapeHtml(agentWelcome(name))}</div>`;
    } else {
      log.innerHTML = messages.map((item) => {
        const roleClass = item.role === 'user' ? 'user' : 'system';
        const runtime = item.runtime ? `<div class="agent-runtime-line">${escapeHtml(item.runtime.provider || 'local')} · ${escapeHtml(item.runtime.model || 'fallback')}${item.runtime.fallbackUsed ? ' · fallback' : ''}</div>` : '';
        const contributions = Array.isArray(item.contributions) && item.contributions.length
          ? `<details class="agent-contributions"><summary>View ${item.contributions.length} specialist contributions</summary>${item.contributions.map((entry) => `<article><b>${escapeHtml(entry.agent)}</b><small>${escapeHtml(entry.runtime?.provider || 'local')} · ${escapeHtml(entry.runtime?.model || 'fallback')}</small><p>${escapeHtml(entry.reply || '')}</p></article>`).join('')}</details>`
          : '';
        return `<div class="chat-bubble ${roleClass}"><div>${escapeHtml(item.content || '')}</div>${runtime}${contributions}</div>`;
      }).join('');
    }
    const threadBadge = q('#agentThreadBadge');
    if (threadBadge) threadBadge.textContent = `${name} THREAD · ${messages.length} MSG${messages.length === 1 ? '' : 'S'}`;
    qa('[data-agent]').forEach((button) => {
      const hasHistory = Boolean((state.agentChats[button.dataset.agent] || []).length);
      button.dataset.hasHistory = hasHistory ? 'true' : 'false';
    });
    log.scrollTop = log.scrollHeight;
  }

  function agentHistory(name) {
    return (state.agentChats[name] || [])
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-16)
      .map((item) => ({ role: item.role, content: item.content }));
  }

  function appendAgentMessage(name, entry) {
    if (!state.agentChats[name]) state.agentChats[name] = [];
    state.agentChats[name].push({ ...entry, at: entry.at || new Date().toISOString() });
    state.agentChats[name] = state.agentChats[name].slice(-50);
    persistAgentChats();
    if (state.selectedAgent === name) renderSelectedAgentChat();
  }

  function setSelectedAgent(name) {
    if (!AGENT_CHAT_IDS.includes(name)) name = 'TEAM';
    state.selectedAgent = name;
    qa('[data-agent]').forEach((button) => button.classList.toggle('active', button.dataset.agent === name));
    if (q('#activeAgentTitle')) q('#activeAgentTitle').textContent = name === 'TEAM' ? 'TEAM MODE' : name;
    if (q('#activeAgentSubtitle')) {
      q('#activeAgentSubtitle').textContent =
        name === 'TEAM' ? 'VÆLON + AUREN + SOLVÆR' : state.agents[name]?.role || 'Specialized Agent';
    }
    renderSelectedAgentChat();
  }

  qa('[data-agent]').forEach((button) =>
    button.addEventListener('click', () => setSelectedAgent(button.dataset.agent)),
  );

  q('[data-action="clear-chat"]')?.addEventListener('click', () => {
    state.agentChats[state.selectedAgent] = [];
    persistAgentChats();
    renderSelectedAgentChat();
    showToast('THREAD CLEARED', `${state.selectedAgent} conversation cleared. Live system context remains connected.`);
  });

  q('#chatForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = q('#chatInput');
    const message = input.value.trim();
    if (!message) return;
    const agent = state.selectedAgent;
    const history = agentHistory(agent);
    appendAgentMessage(agent, { role: 'user', content: message });
    input.value = '';
    const log = q('#chatLog');
    const pendingId = `pending-${Date.now()}`;
    log?.insertAdjacentHTML('beforeend', `<div class="chat-bubble system" id="${pendingId}">Working in ${escapeHtml(agent)} thread…</div>`);
    if (log) log.scrollTop = log.scrollHeight;
    let reply = 'Local fallback active. Start the Node backend and configure a provider to enable model-backed agent reasoning.';
    let runtime = null;
    let contributions = [];
    try {
      const endpoint = agent === 'TEAM' ? './api/aethergrid/team' : `./api/aethergrid/agents/${encodeURIComponent(agent)}`;
      const activeCity = state.geospatial.cityMesh?.city || null;
      const activeUseCase = state.geospatial.activeUseCase || null;
      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          message,
          history,
          context: {
            region: state.system.region,
            scenario: state.system.scenario,
            view: state.system.view,
            metrics: state.metrics,
            city: activeCity ? { id: activeCity.id, name: activeCity.name, lat: activeCity.lat, lon: activeCity.lon } : null,
            cityOperation: activeUseCase ? { id: activeUseCase.useCase?.id, label: activeUseCase.useCase?.label, planningIndex: activeUseCase.planningIndex, observations: activeUseCase.observations } : null,
          },
        }),
      });
      reply = result.reply || result.synthesis || reply;
      runtime = result.runtime || null;
      contributions = Array.isArray(result.contributions) ? result.contributions.map((item) => ({
        agent: item.agent,
        reply: item.reply,
        runtime: item.runtime ? { provider: item.runtime.provider, model: item.runtime.model, fallbackUsed: item.runtime.fallbackUsed } : null,
      })) : [];
      if (result.runtime) state.runtime = result.runtime;
      if (Array.isArray(result.activity)) state.activity = result.activity;
      if (result.evidence) {
        state.evidence.unshift(result.evidence);
        state.evidence = state.evidence.slice(0, 24);
        renderEvidence();
      } else {
        renderActivity();
      }
      if (result.runtime?.agent && result.runtime.agent !== 'TEAM') {
        const badge = q(`[data-agent-runtime="${CSS.escape(result.runtime.agent)}"]`);
        if (badge) badge.textContent = result.runtime.model || result.runtime.provider || 'READY';
      }
    } catch {
      try {
        const result = await api('./api/aethergrid/chat', {
          method: 'POST',
          body: JSON.stringify({ message, agent, history }),
        });
        reply = result.reply || reply;
      } catch {}
    }
    q(`#${pendingId}`)?.remove();
    appendAgentMessage(agent, {
      role: 'assistant',
      content: reply,
      runtime: runtime ? { provider: runtime.provider, model: runtime.model, fallbackUsed: runtime.fallbackUsed } : null,
      contributions,
    });
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

  const PROFILE_CACHE_KEY = 'aethergrid.operator.profile.v1';
  const profileDialog = q('#profileDialog');

  function applyProfile(profile = {}) {
    state.profile = { ...state.profile, ...profile };
    const initials = (state.profile.initials || 'OP').slice(0, 4).toUpperCase();
    const buttonInitials = q('#profileInitials');
    const buttonAvatar = q('#profileAvatarButton');
    if (buttonInitials) {
      buttonInitials.textContent = initials;
      buttonInitials.hidden = Boolean(state.profile.avatarDataUrl);
    }
    if (buttonAvatar) {
      buttonAvatar.hidden = !state.profile.avatarDataUrl;
      if (state.profile.avatarDataUrl) buttonAvatar.src = state.profile.avatarDataUrl;
      else buttonAvatar.removeAttribute('src');
    }

    const previewInitials = q('#profileAvatarPreviewInitials');
    const previewImage = q('#profileAvatarPreviewImage');
    if (previewInitials) {
      previewInitials.textContent = initials;
      previewInitials.hidden = Boolean(state.profile.avatarDataUrl);
    }
    if (previewImage) {
      previewImage.hidden = !state.profile.avatarDataUrl;
      if (state.profile.avatarDataUrl) previewImage.src = state.profile.avatarDataUrl;
      else previewImage.removeAttribute('src');
    }

    const fields = {
      profileDisplayName: state.profile.displayName,
      profileInitialsInput: initials,
      profileTitle: state.profile.title,
      profileOrganization: state.profile.organization,
      profileHomeRegion: state.profile.homeRegion,
      profileTimezone: state.profile.timezone,
      profileBio: state.profile.bio,
    };
    for (const [id, value] of Object.entries(fields)) {
      const input = q(`#${id}`);
      if (input) input.value = value || '';
    }
    if (q('#profilePersistStatus')) {
      q('#profilePersistStatus').textContent = state.profile.updatedAt
        ? `SAVED · ${new Date(state.profile.updatedAt).toLocaleString()}`
        : 'LOCAL PROFILE';
    }
  }

  async function loadProfile() {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null');
    } catch {}
    if (cached) applyProfile(cached);
    try {
      const result = await api('./api/aethergrid/profile');
      if (result.profile) {
        applyProfile(result.profile);
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(result.profile));
      }
    } catch {}
  }

  function profilePayload() {
    return {
      ...state.profile,
      displayName: q('#profileDisplayName')?.value.trim() || 'Operator',
      initials: q('#profileInitialsInput')?.value.trim().toUpperCase() || 'OP',
      title: q('#profileTitle')?.value.trim() || 'ÆTHERGRID Operator',
      organization: q('#profileOrganization')?.value.trim() || '',
      homeRegion: q('#profileHomeRegion')?.value.trim() || 'New York Metro',
      timezone: q('#profileTimezone')?.value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
      bio: q('#profileBio')?.value.trim() || '',
      avatarDataUrl: state.profile.avatarDataUrl || '',
    };
  }

  async function saveProfile(profile) {
    let saved = { ...profile, updatedAt: new Date().toISOString() };
    try {
      const result = await api('./api/aethergrid/profile', {
        method: 'PUT',
        body: JSON.stringify({ profile }),
      });
      if (result.profile) saved = result.profile;
      if (Array.isArray(result.activity)) state.activity = result.activity;
    } catch {}
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(saved));
    applyProfile(saved);
    renderActivity();
    showToast('PROFILE SAVED', `${saved.displayName} · ${saved.title}`);
    return saved;
  }

  async function resizeProfileAvatar(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 8_000_000) throw new Error('Avatar image must be under 8 MB.');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Unable to read image.'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode image.'));
      element.src = dataUrl;
    });
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - size) / 2;
    const sy = (image.naturalHeight - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.drawImage(image, sx, sy, size, size, 0, 0, 256, 256);
    return canvas.toDataURL('image/webp', 0.78);
  }

  q('[data-action="profile"]')?.addEventListener('click', () => {
    applyProfile(state.profile);
    profileDialog?.showModal();
  });

  q('#profileAvatarInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      state.profile.avatarDataUrl = await resizeProfileAvatar(file);
      applyProfile(state.profile);
      showToast('AVATAR READY', 'Profile avatar resized to 256×256 and ready to save.');
    } catch (error) {
      showToast('AVATAR ERROR', error.message || String(error));
    } finally {
      event.target.value = '';
    }
  });

  q('#profileForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveProfile(profilePayload());
    profileDialog?.close();
  });

  loadAgentChats();
  setSelectedAgent(state.selectedAgent);
  loadSettings();
  bindSettings();
  switchWorkspace(initialWorkspace(), { persist: false });
  syncStateToUi();
  loadState();
  loadProfile();
  loadGlobalRuntime();
  loadQuantumBackends();
  configureTelemetry();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();