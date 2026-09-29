const state = {
  capabilities: null,
  operatorState: null,
  activeTab: 'grid',
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const MODEL_LOGOS = Object.freeze({
  VÆLON: '/assets/ai/vaelon.jpg',
  AUREN: '/assets/ai/auren.jpg',
  SOLVÆR: '/assets/ai/solvaer.jpg',
});
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function label(value) {
  return String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replaceAll('.', ' · ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortFingerprint(value, length = 16) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function formatKw(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)} kW` : '—';
}

function createModelLogo(modelId, className, decorative = false) {
  const source = MODEL_LOGOS[modelId];
  if (!source) {
    const fallback = document.createElement('div');
    fallback.className = `${className} model-logo-fallback`;
    fallback.textContent = modelId.slice(0, 1);
    return fallback;
  }

  const image = document.createElement('img');
  image.className = className;
  image.src = source;
  image.alt = decorative ? '' : `${modelId} model logo`;
  image.decoding = 'async';
  image.loading = 'lazy';
  return image;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  qsa('.tab').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  qsa('.view').forEach((view) => view.classList.toggle('is-active', view.dataset.view === tab));
}

function renderModels(models) {
  const list = qs('#modelList');
  const grid = qs('#aiGrid');
  list.replaceChildren();
  grid.replaceChildren();

  const colors = ['#4befff', '#8068ff', '#e25cff'];

  models.forEach((model, index) => {
    const compact = document.createElement('div');
    compact.className = 'model-item';

    const icon = createModelLogo(model.id, 'model-icon', true);

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = model.id;
    const role = document.createElement('small');
    role.textContent = label(model.role);
    copy.append(title, role);
    compact.append(icon, copy);
    list.append(compact);

    const card = document.createElement('article');
    card.className = 'ai-card';
    card.style.setProperty('--card-glow', colors[index % colors.length]);

    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = `AI ROLE 0${index + 1}`;

    const identity = document.createElement('div');
    identity.className = 'ai-card-identity';

    const logo = createModelLogo(model.id, 'ai-card-logo');

    const identityCopy = document.createElement('div');
    const heading = document.createElement('h4');
    heading.textContent = model.id;

    const description = document.createElement('p');
    description.textContent = label(model.role);
    identityCopy.append(heading, description);
    identity.append(logo, identityCopy);

    const caps = document.createElement('div');
    caps.className = 'capabilities';
    model.capabilities.forEach((capability) => {
      const pill = document.createElement('span');
      pill.className = 'capability';
      pill.textContent = label(capability);
      caps.append(pill);
    });

    card.append(eyebrow, identity, caps);
    grid.append(card);
  });
}

function renderTargets(targets, activeTarget = null) {
  const host = qs('#holoTargets');
  host.replaceChildren();

  targets.forEach((target) => {
    const item = document.createElement('div');
    item.className = `target-card${target === activeTarget ? ' is-active' : ''}`;

    const title = document.createElement('strong');
    title.textContent = label(target);

    const note = document.createElement('small');
    note.textContent =
      target === activeTarget ? 'active validated presentation target' : 'available adapter target';

    item.append(title, note);
    host.append(item);
  });
}

function renderQuantum(capabilities) {
  qs('#quantumBackend').textContent = label(capabilities.quantum.localQuantumInspiredBackend);
  qs('#quantumAlgorithm').textContent = label(capabilities.quantum.localQuantumInspiredAlgorithm);

  const host = qs('#quantumProgression');
  host.replaceChildren();
  capabilities.quantum.progression.forEach((step) => {
    const item = document.createElement('li');
    item.textContent = label(step);
    host.append(item);
  });
}

function assetPosition(asset, index) {
  const preferred = {
    solar: [145, 275],
    wind: [250, 218],
    battery: [375, 305],
    load: [520, 260],
    grid_interconnect: [625, 292],
  };
  const base = preferred[asset.kind] ?? [180 + index * 95, 275 + (index % 2) * 35];
  return [base[0], base[1]];
}

function nodeClass(kind) {
  if (kind === 'grid_interconnect') return 'grid';
  return ['solar', 'wind', 'battery', 'load'].includes(kind) ? kind : 'grid';
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function renderGrid(operatorState) {
  const flowsHost = qs('#gridFlows');
  const nodesHost = qs('#gridNodes');
  flowsHost.replaceChildren();
  nodesHost.replaceChildren();

  const powerFlows = operatorState.spatialScene.evidence.powerFlows;
  const center = [375, 305];

  powerFlows.forEach((asset, index) => {
    const [x, y] = assetPosition(asset, index);
    const path = createSvgElement('path', {
      class: `energy-flow${index % 2 ? ' secondary' : ''}`,
      d: `M ${x} ${y} Q ${(x + center[0]) / 2} ${Math.min(y, center[1]) - 70} ${center[0]} ${center[1]}`,
    });
    flowsHost.append(path);

    const group = createSvgElement('g', {
      class: `node ${nodeClass(asset.kind)}`,
      transform: `translate(${x} ${y})`,
    });

    const radius = asset.kind === 'battery' ? 31 : asset.kind === 'grid_interconnect' ? 29 : 26;
    group.append(
      createSvgElement('circle', { r: radius }),
      createSvgElement('circle', { r: 7, class: 'node-core' }),
    );

    const name = createSvgElement('text', { x: 0, y: radius + 24 });
    name.textContent = label(asset.kind).toUpperCase();

    const power = createSvgElement('text', {
      x: 0,
      y: radius + 42,
      class: 'node-power',
    });
    power.textContent = formatKw(asset.powerKw);

    group.append(name, power);
    nodesHost.append(group);
  });

  const totals = operatorState.twin.totals;
  qs('#generationMetric').textContent = formatKw(totals.generationKw);
  qs('#loadMetric').textContent = formatKw(totals.loadKw);
  qs('#balanceMetric').textContent = formatKw(totals.balanceKw);

  qs('#dataSourceStatus').textContent = 'VALIDATED SYNTHETIC';
  qs('#fieldNote').textContent =
    `${operatorState.source.snapshotId} · ${operatorState.spatialScene.sceneId} · renderer-neutral · no actuation authority`;
}

function spatialLayerDefinitions(renderPacket) {
  const layers = renderPacket.layers ?? {};
  const definitions = [];

  if (layers.topology)
    definitions.push({ label: 'DIGITAL TWIN TOPOLOGY', detail: 'validated scene nodes' });
  if (layers.powerFlows)
    definitions.push({
      label: 'POWER FLOWS',
      detail: `${renderPacket.evidence.powerFlows.length} asset flows`,
    });
  if (layers.forecastDelta)
    definitions.push({ label: 'FORECAST DELTA', detail: 'scenario persistence evidence' });
  if (layers.simulationEvidence)
    definitions.push({
      label: 'SIMULATION EVIDENCE',
      detail: renderPacket.evidence.simulation?.status ?? 'unknown',
    });
  if (Array.isArray(layers.attention) && layers.attention.length) {
    definitions.push({
      label: 'OPERATOR ATTENTION',
      detail: `${layers.attention.length} sealed item(s)`,
    });
  }

  return definitions;
}

function renderSpatial(operatorState) {
  const renderPacket = operatorState.holographic.renderPacket;
  const host = qs('#spatialLayers');
  host.replaceChildren();

  const definitions = spatialLayerDefinitions(renderPacket);
  definitions.forEach((definition, index) => {
    const layer = document.createElement('div');
    layer.className = 'scene-layer';
    layer.style.bottom = `${38 + index * 68}px`;
    layer.style.left = `${12 + index * 2.5}%`;
    layer.style.right = `${12 + index * 2.5}%`;
    layer.style.zIndex = String(index + 1);

    const labelNode = document.createElement('span');
    labelNode.textContent = definition.label;

    const detail = document.createElement('small');
    detail.textContent = definition.detail;

    const depth = document.createElement('b');
    depth.textContent = `z ${index * 25}`;

    const copy = document.createElement('div');
    copy.className = 'scene-layer-copy';
    copy.append(labelNode, detail);
    layer.append(copy, depth);
    host.append(layer);
  });

  const summary = qs('#renderSummary');
  summary.replaceChildren();

  const status = document.createElement('span');
  status.className = 'mini-status cyan';
  status.textContent = `TARGET · ${label(renderPacket.target ?? 'none').toUpperCase()}`;

  const device = document.createElement('div');
  device.className = 'render-detail';
  device.textContent = `${renderPacket.deviceId ?? 'no device'} · ${label(renderPacket.status)} · checksum ${shortFingerprint(renderPacket.checksum, 12)}`;

  summary.append(status, device);
}

function addEvidenceNode(host, title, detail, tone = '') {
  const item = document.createElement('div');
  item.className = `evidence-node${tone ? ` ${tone}` : ''}`;

  const strong = document.createElement('strong');
  strong.textContent = title;

  const small = document.createElement('small');
  small.textContent = detail;

  item.append(strong, small);
  host.append(item);
}

function renderEvidence(operatorState) {
  const host = qs('#evidenceChain');
  host.replaceChildren();

  operatorState.evidence.operatorItems.forEach((item) => {
    addEvidenceNode(
      host,
      `${item.severity.toUpperCase()} · ${label(item.id)}`,
      `${item.reason} · ${item.assetNodeRefs.length} asset/node binding(s)`,
      item.severity,
    );
  });

  addEvidenceNode(
    host,
    'Operator evidence package',
    `SHA-256 ${shortFingerprint(operatorState.evidence.packageFingerprint)}`,
  );
  addEvidenceNode(
    host,
    'Operator attention',
    `SHA-256 ${shortFingerprint(operatorState.evidence.attentionFingerprint)}`,
  );
  addEvidenceNode(
    host,
    'Provenance graph',
    `SHA-256 ${shortFingerprint(operatorState.evidence.provenanceFingerprint)}`,
  );
  addEvidenceNode(
    host,
    'Dashboard view',
    `SHA-256 ${shortFingerprint(operatorState.evidence.viewFingerprint)}`,
  );
}

function renderCapabilities(capabilities) {
  state.capabilities = capabilities;
  qs('#productPurpose').textContent = capabilities.purpose;
  qs('#twinStatus').textContent = `TWIN · ${capabilities.digitalTwin.state.toUpperCase()}`;
  qs('#evidenceStatus').textContent = `EVIDENCE · ${capabilities.evidence.state.toUpperCase()}`;

  renderModels(capabilities.ai.models);
  renderTargets(
    capabilities.holographic.supportedTargets,
    state.operatorState?.holographic.presentation.target ?? null,
  );
  renderQuantum(capabilities);
}

function renderOperatorState(operatorState) {
  state.operatorState = operatorState;

  qs('#twinStatus').textContent = 'TWIN · VALIDATED';
  qs('#evidenceStatus').textContent = 'EVIDENCE · SEALED';

  renderGrid(operatorState);
  renderSpatial(operatorState);
  renderEvidence(operatorState);

  if (state.capabilities) {
    renderTargets(
      state.capabilities.holographic.supportedTargets,
      operatorState.holographic.presentation.target,
    );
  }

  qs('#apiState').textContent =
    `Capability v${state.capabilities?.version ?? '?'} · operator state v${operatorState.version} · validated synthetic evidence · connected`;
}

async function fetchJson(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function loadConsole() {
  try {
    const [capabilities, operatorState] = await Promise.all([
      fetchJson('/api/capabilities'),
      fetchJson('/api/operator-state'),
    ]);
    renderCapabilities(capabilities);
    renderOperatorState(operatorState);
  } catch (error) {
    qs('#apiState').textContent = `Validated console state unavailable · ${error.message}`;
    qs('#productPurpose').textContent =
      'ÆTHERGRID could not load its local validated capability and operator-state contracts.';
    qs('#dataSourceStatus').textContent = 'STATE UNAVAILABLE';
    qs('#fieldNote').textContent = 'No unvalidated fallback data is rendered.';
  }
}

qsa('.tab').forEach((button) =>
  button.addEventListener('click', () => setActiveTab(button.dataset.tab)),
);
qsa('[data-open-tab]').forEach((button) =>
  button.addEventListener('click', () => setActiveTab(button.dataset.openTab)),
);

loadConsole();
