const state = {
  capabilities: null,
  activeTab: 'grid',
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function label(value) {
  return String(value)
    .replaceAll('-', ' ')
    .replaceAll('.', ' · ')
    .replace(/w/g, (letter) => letter.toUpperCase());
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
    compact.innerHTML = `
      <div class="model-icon">${model.id.slice(0, 1)}</div>
      <div><strong>${model.id}</strong><small>${label(model.role)}</small></div>
    `;
    list.append(compact);

    const card = document.createElement('article');
    card.className = 'ai-card';
    card.style.setProperty('--card-glow', colors[index % colors.length]);
    const caps = model.capabilities
      .map((capability) => `<span class="capability">${label(capability)}</span>`)
      .join('');
    card.innerHTML = `
      <div class="eyebrow">AI ROLE 0${index + 1}</div>
      <h4>${model.id}</h4>
      <p>${label(model.role)}</p>
      <div class="capabilities">${caps}</div>
    `;
    grid.append(card);
  });
}

function renderTargets(targets) {
  const host = qs('#holoTargets');
  host.replaceChildren();
  targets.forEach((target) => {
    const item = document.createElement('div');
    item.className = 'target-card';
    item.innerHTML = `<strong>${label(target)}</strong><small>presentation adapter target</small>`;
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

function renderEvidence(capabilities) {
  const host = qs('#evidenceChain');
  host.replaceChildren();
  capabilities.evidence.capabilities.forEach((capability) => {
    const item = document.createElement('div');
    item.className = 'evidence-node';
    item.innerHTML = `<strong>${label(capability)}</strong><small>integrity-bound operator evidence</small>`;
    host.append(item);
  });
}

function renderCapabilities(capabilities) {
  state.capabilities = capabilities;
  qs('#productPurpose').textContent = capabilities.purpose;
  qs('#twinStatus').textContent = `TWIN · ${capabilities.digitalTwin.state.toUpperCase()}`;
  qs('#evidenceStatus').textContent = `EVIDENCE · ${capabilities.evidence.state.toUpperCase()}`;
  qs('#twinMetric').textContent = capabilities.digitalTwin.state.toUpperCase();
  qs('#holoMetric').textContent = capabilities.holographic.state.toUpperCase();
  qs('#quantumMetric').textContent = capabilities.quantum.state.toUpperCase();
  qs('#apiState').textContent = `Capability contract v${capabilities.version} · connected`;

  renderModels(capabilities.ai.models);
  renderTargets(capabilities.holographic.supportedTargets);
  renderQuantum(capabilities);
  renderEvidence(capabilities);
}

async function loadCapabilities() {
  try {
    const response = await fetch('/api/capabilities', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderCapabilities(await response.json());
  } catch (error) {
    qs('#apiState').textContent = `Capability contract unavailable · ${error.message}`;
    qs('#productPurpose').textContent =
      'ÆTHERGRID operator intelligence is unavailable because the local capability contract could not be loaded.';
  }
}

qsa('.tab').forEach((button) =>
  button.addEventListener('click', () => setActiveTab(button.dataset.tab)),
);
qsa('[data-open-tab]').forEach((button) =>
  button.addEventListener('click', () => setActiveTab(button.dataset.openTab)),
);

loadCapabilities();
