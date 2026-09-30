(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const toast = q('#toast');
  const panelDialog = q('#panelDialog');
  const chatDialog = q('#chatDialog');
  const dialogKicker = q('#dialogKicker');
  const dialogTitle = q('#dialogTitle');
  const dialogBody = q('#dialogBody');
  const chatLog = q('#chatLog');
  const chatForm = q('#chatForm');
  const chatInput = q('#chatInput');
  const selectionGlow = q('#selectionGlow');
  const telemetryBadge = q('#telemetryBadge');

  const demoState = {
    system: {
      status: 'All Systems Nominal',
      region: 'New York Metro',
      mode: 'ADVISORY ONLY',
      view: 'live',
      scenario: 'peak-demand',
      physicalActuation: false,
      infrastructureDispatch: false,
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
      'VÆLON': {
        role: 'Optimization & Scenario Exploration',
        description:
          'Runs bounded multi-objective scenario exploration with renewable prioritization and classical-baseline comparison.',
        status: 'ONLINE',
      },
      AUREN: {
        role: 'Semantic Analysis & Spatial Intelligence',
        description:
          'Interprets grid-resilience patterns, spatial relationships, operator context, and evidence-linked meaning.',
        status: 'ONLINE',
      },
      'SOLVÆR': {
        role: 'Simulation & Evidence Generation',
        description:
          'Generates bounded simulations, validation evidence, provenance records, and candidate-comparison packages.',
        status: 'ONLINE',
      },
    },
    evidence: [
      { id: 'peak-load-reduction', title: 'Scenario: Peak Load Reduction', age: '12 min', status: 'VERIFIED' },
      { id: 'quantum-optimization', title: 'Quantum Optimization Run', age: '28 min', status: 'VERIFIED' },
      { id: 'grid-resilience', title: 'Grid Resilience Analysis', age: '1 hour', status: 'VERIFIED' },
      { id: 'renewable-integration', title: 'Renewable Integration Study', age: '2 hours', status: 'VERIFIED' },
    ],
    activity: [],
  };

  let serverState = structuredClone(demoState);
  let activeHotspot = null;
  let telemetryTimer = null;

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
    );
  }

  function showToast(title, copy) {
    if (!toast) return;
    toast.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(copy)}</small>`;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  async function api(path, options = {}) {
    if (location.protocol === 'file:') throw new Error('standalone mode');
    const response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? response.json() : response.text();
  }

  function mergeState(next) {
    serverState = {
      ...serverState,
      ...next,
      system: { ...serverState.system, ...(next?.system || {}) },
      metrics: { ...serverState.metrics, ...(next?.metrics || {}) },
      optimization: { ...serverState.optimization, ...(next?.optimization || {}) },
      agents: { ...serverState.agents, ...(next?.agents || {}) },
    };
  }

  async function loadState() {
    try {
      mergeState(await api('./api/aethergrid/state'));
    } catch {
      serverState = structuredClone(demoState);
    }
    updateTelemetryBadge();
  }

  function updateTelemetryBadge() {
    if (!telemetryBadge) return;
    telemetryBadge.innerHTML = `<i></i><span>${escapeHtml(
      serverState.system?.view || 'live',
    )} · ${Number(serverState.metrics?.loadMw || 2410).toLocaleString()} MW</span>`;
  }

  async function refreshTelemetry() {
    if (document.hidden) return;
    if (location.protocol === 'file:') {
      const metrics = serverState.metrics;
      const tick = Math.sin(Date.now() / 8000);
      metrics.generationMw = Math.round(2130 + tick * 17);
      metrics.loadMw = Math.round(2410 + Math.cos(Date.now() / 9500) * 21);
      metrics.renewablePercent = Number((46.8 + Math.sin(Date.now() / 12000) * 1.2).toFixed(1));
      metrics.storageMw = Math.round(590 + Math.cos(Date.now() / 10000) * 9);
      updateTelemetryBadge();
      return;
    }
    try {
      const telemetry = await api('./api/aethergrid/telemetry');
      mergeState({ metrics: telemetry.metrics, system: telemetry.system });
      updateTelemetryBadge();
    } catch {}
  }

  function activateHotspot(button) {
    if (!button) return;
    if (activeHotspot) activeHotspot.classList.remove('active-hit');
    activeHotspot = button;
    button.classList.add('active-hit');
    if (!selectionGlow) return;
    for (const name of ['x', 'y', 'w', 'h']) {
      selectionGlow.style.setProperty(`--${name}`, button.style.getPropertyValue(`--${name}`));
    }
    selectionGlow.style.left = `calc(${button.style.getPropertyValue('--x')} * 1%)`;
    selectionGlow.style.top = `calc(${button.style.getPropertyValue('--y')} * 1%)`;
    selectionGlow.style.width = `calc(${button.style.getPropertyValue('--w')} * 1%)`;
    selectionGlow.style.height = `calc(${button.style.getPropertyValue('--h')} * 1%)`;
    selectionGlow.classList.add('visible');
  }

  function openPanel(kicker, title, html) {
    dialogKicker.textContent = kicker;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    panelDialog.showModal();
  }

  function bars(seed = 0) {
    return Array.from({ length: 18 }, (_, index) => {
      const height = 25 + ((index * 17 + seed * 11) % 64);
      return `<i style="--h:${height}%"></i>`;
    }).join('');
  }

  function timeline(items = serverState.evidence || demoState.evidence) {
    return `<div class="timeline">${items
      .map(
        (item) => `
          <div class="timeline-row">
            <i></i>
            <span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.age || 'recent')}</small></span>
            <em>${escapeHtml(item.status || 'VERIFIED')}</em>
          </div>`,
      )
      .join('')}</div>`;
  }

  function overviewPanel() {
    const metrics = serverState.metrics || demoState.metrics;
    return `
      <div class="detail-grid">
        <div class="detail-card">
          <h3>System status</h3>
          <p>${escapeHtml(serverState.system?.status || 'All Systems Nominal')}</p>
          <span class="pill">ADVISORY ONLY</span>
        </div>
        <div class="detail-card">
          <h3>Region</h3>
          <p>${escapeHtml(serverState.system?.region || 'New York Metro')} digital-twin review surface.</p>
          <span class="pill">${escapeHtml((serverState.system?.view || 'live').toUpperCase())} VIEW</span>
        </div>
      </div>
      <div class="detail-card">
        <h3>System metrics</h3>
        <div class="pill-row">
          <span class="pill">${Number(metrics.generationMw).toLocaleString()} MW generation</span>
          <span class="pill">${Number(metrics.loadMw).toLocaleString()} MW load</span>
          <span class="pill">${metrics.renewablePercent}% renewable</span>
          <span class="pill">${metrics.storageMw} MW storage</span>
        </div>
      </div>
      <div class="detail-card">
        <h3>Live activity</h3>
        <div class="live-log" id="liveLog">
          ${(serverState.activity || [])
            .slice(0, 6)
            .map((entry) => `<div class="log-line">${escapeHtml(entry.message || entry)}</div>`)
            .join('') || '<div class="log-line">Operator console synchronized. Awaiting next event.</div>'}
        </div>
      </div>
    `;
  }

  function metricPanel(action) {
    const metrics = serverState.metrics || demoState.metrics;
    const map = {
      'metric-generation': ['TOTAL GENERATION', metrics.generationMw, 'MW', '+12.4%', 3],
      'metric-load': ['TOTAL LOAD', metrics.loadMw, 'MW', '+8.1%', 6],
      'metric-renewable': ['RENEWABLE %', metrics.renewablePercent, '%', '+6.3%', 9],
      'metric-storage': ['STORAGE AVAILABLE', metrics.storageMw, 'MW', '+18.6%', 12],
    };
    const [title, value, unit, delta, seed] = map[action];
    return `
      <div class="detail-card metric-detail">
        <h3>${title}</h3>
        <div class="metric-value">${Number(value).toLocaleString()} <small>${unit}</small></div>
        <div class="metric-delta">↑ ${delta}</div>
        <div class="mini-bars">${bars(seed)}</div>
        <p>Telemetry is presented for operator review only. This surface does not authorize physical grid actuation.</p>
      </div>
    `;
  }

  function panelFor(action) {
    const optimization = serverState.optimization || demoState.optimization;
    if (action?.startsWith('metric-')) {
      return ['SYSTEM METRICS', action.replace('metric-', '').toUpperCase(), metricPanel(action)];
    }

    const sections = {
      overview: ['SYSTEM OVERVIEW', 'New York Metro Operator View', overviewPanel()],
      grid: [
        'DIGITAL TWIN',
        'Grid & Assets',
        `
          <div class="detail-card">
            <h3>${escapeHtml(serverState.system?.region || 'New York Metro')} live field</h3>
            <p>The approved ÆTHERGRID control-room canvas is the visual baseline. The live application layer tracks review mode, region, scenarios, evidence, AI collaboration, and bounded optimization without changing the system authority boundary.</p>
            <div class="pill-row">
              <span class="pill">Grid Operator</span><span class="pill">Weather & Climate</span>
              <span class="pill">Renewable Forecasts</span><span class="pill">Market Data</span>
              <span class="pill">Sensor Networks</span>
            </div>
          </div>
          <div class="dialog-actions">
            <button data-inline-action="live" class="primary">Live</button>
            <button data-inline-action="forecast">Forecast</button>
            <button data-inline-action="scenario-view">Scenario</button>
            <button data-inline-action="search">Search assets</button>
          </div>
        `,
      ],
      holographic: [
        'HOLOGRAPHIC',
        '3D Spatial Analysis',
        `
          <div class="detail-card">
            <h3>Layered spatial visualization</h3>
            <p>Infrastructure, energy flow, risk zones, and future-state evidence remain renderer-neutral and reviewable.</p>
            <div class="progress-line"><span style="--p:92%"></span></div>
          </div>
          <div class="detail-grid">
            <button class="command-button" data-inline-action="holo-infrastructure"><b>Infrastructure</b><small>Grid assets and topology</small></button>
            <button class="command-button" data-inline-action="holo-energy"><b>Energy Flow</b><small>Live flow animation</small></button>
            <button class="command-button" data-inline-action="holo-risk"><b>Risk Zones</b><small>Weather & events</small></button>
            <button class="command-button" data-inline-action="holo-future"><b>Future State</b><small>Scenario preview</small></button>
          </div>
        `,
      ],
      quantum: [
        'QUANTUM OPTIMIZATION',
        'Multi-objective Energy Optimization',
        `
          <div class="detail-grid">
            <div class="detail-card"><h3>Current solution</h3><p>$${Number(optimization.currentCost).toLocaleString()} / hr</p></div>
            <div class="detail-card"><h3>Candidate solution</h3><p>$${Number(optimization.candidateCost).toLocaleString()} / hr</p></div>
          </div>
          <div class="detail-card">
            <h3>Evidence-bound improvement</h3>
            <div class="pill-row">
              <span class="pill">${optimization.emissionsReduction}% emissions reduction</span>
              <span class="pill">+${optimization.renewableUtilizationGain}% renewable utilization</span>
              <span class="pill">Classical baseline required</span>
            </div>
            <div class="mini-bars">${bars(4)}</div>
          </div>
          <div class="dialog-actions">
            <button data-inline-action="run-optimization" class="primary">Run New Optimization</button>
            <button data-inline-action="compare-classical">Compare with Classical</button>
          </div>
        `,
      ],
      ai: [
        'AI COLLABORATION',
        'Specialized Intelligence. Better Decisions.',
        Object.entries(serverState.agents || demoState.agents)
          .map(
            ([name, agent]) => `
              <button class="command-button" data-inline-action="agent:${escapeHtml(name)}">
                <b>${escapeHtml(name)} · ${escapeHtml(agent.role)}</b>
                <small>${escapeHtml(agent.description)}</small>
              </button>`,
          )
          .join('') +
          '<div class="dialog-actions"><button data-inline-action="ai-chat" class="primary">Ask the AI team</button></div>',
      ],
      scenarios: [
        'SCENARIO LAB',
        'Simulate & Compare',
        `
          <div class="command-grid">
            <button class="scenario-button" data-scenario="peak-demand"><b>Peak Demand</b><small>Next 24 hours</small></button>
            <button class="scenario-button" data-scenario="renewable-surge"><b>Renewable Surge</b><small>High wind + solar</small></button>
            <button class="scenario-button" data-scenario="storage-stress"><b>Storage Stress</b><small>Reserve depletion</small></button>
            <button class="scenario-button" data-scenario="weather-event"><b>Weather Event</b><small>Resilience review</small></button>
          </div>
          <div class="detail-card">
            <h3>Active scenario</h3>
            <p>${escapeHtml(serverState.system?.scenario || 'peak-demand')}</p>
            <div class="mini-bars">${bars(8)}</div>
          </div>
        `,
      ],
      evidence: [
        'RECENT EVIDENCE',
        'Verified Simulations & Decisions',
        timeline(),
      ],
      settings: [
        'SYSTEM CONFIGURATION',
        'Settings',
        `
          <div class="detail-card">
            <h3>Safety boundary</h3>
            <p>Recommendations remain advisory. Hardware actuation and infrastructure dispatch stay disabled. Evidence and provenance remain required.</p>
            <div class="pill-row">
              <span class="pill">NO ACTUATION</span><span class="pill">HUMAN REVIEW</span><span class="pill">EVIDENCE REQUIRED</span>
            </div>
          </div>
          <div class="dialog-actions">
            <button data-inline-action="reset-view">Reset View State</button>
            <button data-inline-action="health-check">Run Health Check</button>
          </div>
        `,
      ],
    };
    return sections[action] || sections.overview;
  }

  function openSearch() {
    openPanel(
      'COMMAND SEARCH',
      'Search assets, regions, or scenarios',
      `
        <div class="detail-card">
          <input id="commandSearchInput" autocomplete="off" placeholder="Search assets, regions, scenarios…" style="width:100%;padding:13px 14px;border-radius:12px;border:1px solid rgba(77,174,255,.4);background:#06142d;color:#fff;outline:none" />
        </div>
        <div class="command-grid" id="commandResults">
          <button class="command-button" data-search-action="grid"><b>New York Metro Grid</b><small>Digital twin & assets</small></button>
          <button class="command-button" data-search-action="renewable"><b>Renewable Generation</b><small>Solar · wind · other</small></button>
          <button class="command-button" data-search-action="storage"><b>Energy Storage</b><small>Battery · pumped · thermal</small></button>
          <button class="command-button" data-search-action="scenario"><b>Peak Demand Scenario</b><small>Next 24h simulation</small></button>
        </div>
      `,
    );
    setTimeout(() => q('#commandSearchInput')?.focus(), 40);
  }

  function openRegions() {
    openPanel(
      'REGION CONTROL',
      'Change Operator Region',
      `
        <div class="command-grid">
          <button class="region-button" data-region="New York Metro"><b>New York Metro</b><small>Current digital twin</small></button>
          <button class="region-button" data-region="Long Island"><b>Long Island</b><small>Coastal energy review</small></button>
          <button class="region-button" data-region="Hudson Valley"><b>Hudson Valley</b><small>Hydro + transmission review</small></button>
          <button class="region-button" data-region="Upstate New York"><b>Upstate New York</b><small>Generation + storage review</small></button>
        </div>
      `,
    );
  }

  async function setView(view) {
    serverState.system.view = view;
    try {
      const result = await api('./api/aethergrid/view', {
        method: 'POST',
        body: JSON.stringify({ view }),
      });
      mergeState(result.state || result);
    } catch {}
    updateTelemetryBadge();
    showToast(`${view.toUpperCase()} VIEW`, `${serverState.system.region} switched to ${view} review mode.`);
  }

  async function setRegion(region) {
    serverState.system.region = region;
    try {
      const result = await api('./api/aethergrid/region', {
        method: 'POST',
        body: JSON.stringify({ region }),
      });
      mergeState(result.state || result);
    } catch {}
    updateTelemetryBadge();
    panelDialog.close();
    showToast('REGION CHANGED', `${region} is now the active operator review region.`);
  }

  async function setScenario(scenario) {
    serverState.system.scenario = scenario;
    try {
      const result = await api('./api/aethergrid/scenario', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      });
      mergeState(result.state || result);
    } catch {}
    showToast('SCENARIO LOADED', `${scenario.replaceAll('-', ' ')} is active for review.`);
    const [kicker, title, html] = panelFor('scenarios');
    openPanel(kicker, title, html);
  }

  async function runOptimization(button = null) {
    if (button) button.classList.add('busy');
    showToast('QUANTUM OPTIMIZATION', 'Starting bounded multi-objective scenario evaluation…');
    try {
      const result = await api('./api/aethergrid/optimize', {
        method: 'POST',
        body: JSON.stringify({
          objective: 'minimize_cost_emissions',
          scenario: serverState.system?.scenario,
          region: serverState.system?.region,
        }),
      });
      mergeState({ optimization: result.optimization, activity: result.activity });
    } catch {
      serverState.optimization.runCount = Number(serverState.optimization.runCount || 0) + 1;
      serverState.optimization.candidateCost = Math.max(
        9800,
        Number(serverState.optimization.candidateCost || 10230) - 35,
      );
      serverState.optimization.emissionsReduction = Number(
        (Number(serverState.optimization.emissionsReduction || 24.3) + 0.4).toFixed(1),
      );
    } finally {
      if (button) setTimeout(() => button.classList.remove('busy'), 700);
    }
    setTimeout(
      () =>
        showToast(
          'OPTIMIZATION COMPLETE',
          `Candidate $${Number(serverState.optimization.candidateCost).toLocaleString()}/hr · classical comparison preserved.`,
        ),
      650,
    );
  }

  async function exportEvidence(kind) {
    const payload = {
      kind,
      generatedAt: new Date().toISOString(),
      system: serverState.system,
      metrics: serverState.metrics,
      optimization: serverState.optimization,
      evidence: serverState.evidence,
      advisoryOnly: true,
    };
    try {
      const result = await api('./api/aethergrid/export', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      payload.serverReceipt = result.receipt;
    } catch {}
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `aethergrid-${kind}-${Date.now()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast('EXPORT READY', `${kind.replaceAll('-', ' ')} generated with evidence metadata.`);
  }

  function openAgent(name) {
    const agent = (serverState.agents || demoState.agents)[name];
    const monogram = name === 'VÆLON' ? 'V' : name === 'AUREN' ? 'A' : 'S';
    openPanel(
      'AI COLLABORATION',
      name,
      `
        <div class="agent-detail">
          <div class="agent-monogram" aria-hidden="true">${monogram}</div>
          <div>
            <h3>${escapeHtml(agent.role)}</h3>
            <p>${escapeHtml(agent.description)}</p>
            <span class="pill">${escapeHtml(agent.status)}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <button data-inline-action="ai-chat" class="primary">Open team chat</button>
          <button data-inline-action="evidence">View evidence</button>
        </div>
      `,
    );
  }

  async function healthCheck() {
    let message = 'Standalone UI, interactions, and local fallback state are operational.';
    try {
      const health = await api('./api/aethergrid/health');
      message = `Backend online · ${health.product} · ${health.authority}`;
    } catch {}
    showToast('SYSTEM HEALTH', message);
  }

  async function resetView() {
    serverState.system.view = 'live';
    serverState.system.scenario = 'peak-demand';
    try {
      const result = await api('./api/aethergrid/reset', { method: 'POST', body: '{}' });
      mergeState(result.state || result);
    } catch {}
    panelDialog.close();
    updateTelemetryBadge();
    showToast('VIEW RESET', 'Operator review state returned to the New York Metro live baseline.');
  }

  function handleAction(action, button = null) {
    if (!action) return;
    if (button) activateHotspot(button);
    if (action === 'run-optimization') return runOptimization(button);
    if (action === 'compare-classical')
      return showToast('CLASSICAL COMPARISON', 'Baseline comparison opened for evidence review.');
    if (action === 'search') return openSearch();
    if (action === 'change-region') return openRegions();
    if (action === 'ai-chat') {
      chatDialog.showModal();
      chatInput.focus();
      return;
    }
    if (action === 'health-check') return healthCheck();
    if (action === 'reset-view') return resetView();
    if (action.startsWith('agent-')) {
      const names = {
        'agent-vaelon': 'VÆLON',
        'agent-auren': 'AUREN',
        'agent-solvaer': 'SOLVÆR',
      };
      return openAgent(names[action]);
    }
    if (action.startsWith('export-')) return exportEvidence(action.replace('export-', ''));
    if (['live', 'forecast', 'scenario-view'].includes(action)) {
      return setView(action === 'scenario-view' ? 'scenario' : action);
    }
    if (action.startsWith('map-')) {
      return showToast('SPATIAL CONTROL', `${action.replace('map-', '').replaceAll('-', ' ')} control engaged in read-only review mode.`);
    }
    if (action.startsWith('holo-')) {
      return showToast('HOLOGRAPHIC LAYER', `${action.replace('holo-', '').replaceAll('-', ' ')} layer selected.`);
    }
    const [kicker, title, html] = panelFor(action);
    openPanel(kicker, title, html);
  }

  qa('[data-dialog-close]').forEach((button) =>
    button.addEventListener('click', () => button.closest('dialog').close()),
  );

  qa('.hotspot').forEach((button) =>
    button.addEventListener('click', () => handleAction(button.dataset.action, button)),
  );

  dialogBody.addEventListener('click', (event) => {
    const target = event.target.closest('[data-inline-action],[data-region],[data-scenario],[data-search-action]');
    if (!target) return;
    if (target.dataset.region) return setRegion(target.dataset.region);
    if (target.dataset.scenario) return setScenario(target.dataset.scenario);
    if (target.dataset.searchAction) {
      const mapping = { grid: 'grid', renewable: 'metric-renewable', storage: 'metric-storage', scenario: 'scenarios' };
      const [kicker, title, html] = panelFor(mapping[target.dataset.searchAction] || 'overview');
      return openPanel(kicker, title, html);
    }
    const action = target.dataset.inlineAction;
    if (action?.startsWith('agent:')) return openAgent(action.slice('agent:'.length));
    return handleAction(action, target);
  });

  dialogBody.addEventListener('input', (event) => {
    if (event.target.id !== 'commandSearchInput') return;
    const needle = event.target.value.trim().toLowerCase();
    qa('#commandResults .command-button').forEach((button) => {
      button.hidden = needle && !button.textContent.toLowerCase().includes(needle);
    });
  });

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    chatLog.insertAdjacentHTML('beforeend', `<div class="chat-bubble user">${escapeHtml(message)}</div>`);
    chatInput.value = '';
    let reply =
      'VÆLON, AUREN, and SOLVÆR reviewed the request. This interface is advisory-only; recommendations remain evidence-bound and require operator review.';
    try {
      const result = await api('./api/aethergrid/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          region: serverState.system?.region,
          scenario: serverState.system?.scenario,
        }),
      });
      reply = result.reply || reply;
      if (result.activity) serverState.activity = result.activity;
    } catch {}
    chatLog.insertAdjacentHTML('beforeend', `<div class="chat-bubble system">${escapeHtml(reply)}</div>`);
    chatLog.scrollTop = chatLog.scrollHeight;
  });

  function initEffects() {
    if (telemetryTimer) clearInterval(telemetryTimer);
    telemetryTimer = setInterval(refreshTelemetry, 3200);
    refreshTelemetry();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshTelemetry();
    });
    const first = q('.hotspot[data-action="overview"]');
    if (first) activateHotspot(first);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  loadState();
  initEffects();
})();