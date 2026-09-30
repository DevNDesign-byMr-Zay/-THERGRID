(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = q('#toast');
  const panelDialog = q('#panelDialog');
  const chatDialog = q('#chatDialog');
  const dialogKicker = q('#dialogKicker');
  const dialogTitle = q('#dialogTitle');
  const dialogBody = q('#dialogBody');
  const chatLog = q('#chatLog');
  const chatForm = q('#chatForm');
  const chatInput = q('#chatInput');

  const demoState = {
    system: { status: 'All Systems Nominal', region: 'New York Metro', mode: 'ADVISORY ONLY' },
    metrics: { generationMw: 2130, loadMw: 2410, renewablePercent: 46.8, storageMw: 590 },
    optimization: {
      currentCost: 12480,
      candidateCost: 10230,
      emissionsReduction: 24.3,
      renewableUtilizationGain: 16.7,
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
  };

  let serverState = structuredClone(demoState);

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
    );
  }

  function showToast(title, copy) {
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

  async function loadState() {
    try {
      serverState = await api('./api/aethergrid/state');
    } catch {
      serverState = structuredClone(demoState);
    }
  }

  function openPanel(kicker, title, html) {
    dialogKicker.textContent = kicker;
    dialogTitle.textContent = title;
    dialogBody.innerHTML = html;
    panelDialog.showModal();
  }

  function panelFor(action) {
    const metrics = serverState.metrics || demoState.metrics;
    const optimization = serverState.optimization || demoState.optimization;
    const sections = {
      overview: [
        'SYSTEM OVERVIEW',
        'New York Metro Operator View',
        `
          <div class="detail-grid">
            <div class="detail-card">
              <h3>System status</h3>
              <p>${escapeHtml(serverState.system?.status || 'All Systems Nominal')}</p>
              <span class="pill">ADVISORY ONLY</span>
            </div>
            <div class="detail-card">
              <h3>Region</h3>
              <p>New York Metro digital-twin review surface.</p>
              <span class="pill">LIVE VIEW</span>
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
        `,
      ],
      grid: [
        'DIGITAL TWIN',
        'Grid & Assets',
        `
          <div class="detail-card">
            <h3>New York Metro live field</h3>
            <p>The approved 1536×1024 ÆTHERGRID control-room canvas remains visually unchanged while this application layer adds grid state, forecast, scenario, AI, evidence, and export behavior.</p>
            <div class="pill-row">
              <span class="pill">Grid Operator</span>
              <span class="pill">Weather & Climate</span>
              <span class="pill">Renewable Forecasts</span>
              <span class="pill">Market Data</span>
              <span class="pill">Sensor Networks</span>
            </div>
          </div>
        `,
      ],
      holographic: [
        'HOLOGRAPHIC',
        '3D Spatial Analysis',
        `
          <div class="detail-card">
            <h3>Layered spatial visualization</h3>
            <p>Infrastructure, energy flow, risk zones, and future-state evidence are exposed as read-only spatial layers.</p>
            <div class="progress-line"><span style="--p:92%"></span></div>
          </div>
          <div class="detail-grid">
            <div class="detail-card"><h3>Infrastructure</h3><p>Grid assets and topology.</p></div>
            <div class="detail-card"><h3>Energy Flow</h3><p>Live animation and validated flows.</p></div>
            <div class="detail-card"><h3>Risk Zones</h3><p>Weather and event overlays.</p></div>
            <div class="detail-card"><h3>Future State</h3><p>Scenario preview.</p></div>
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
          </div>
        `,
      ],
      ai: [
        'AI COLLABORATION',
        'Specialized Intelligence. Better Decisions.',
        Object.entries(serverState.agents || demoState.agents)
          .map(
            ([name, agent]) => `
              <div class="detail-card">
                <h3>${escapeHtml(name)} · ${escapeHtml(agent.role)}</h3>
                <p>${escapeHtml(agent.description)}</p>
                <span class="pill">${escapeHtml(agent.status || 'ONLINE')}</span>
              </div>
            `,
          )
          .join(''),
      ],
      scenarios: [
        'SCENARIO LAB',
        'Simulate & Compare',
        `
          <div class="detail-card">
            <h3>Peak demand · next 24h</h3>
            <p>Compare baseline, AI-optimized, quantum-inspired, and renewable-supply trajectories. Scenario outputs remain advisory until operator review.</p>
            <div class="pill-row">
              <span class="pill">Baseline</span>
              <span class="pill">AI Optimized</span>
              <span class="pill">Quantum Optimized</span>
              <span class="pill">Renewable Supply</span>
            </div>
          </div>
        `,
      ],
      evidence: [
        'RECENT EVIDENCE',
        'Verified Simulations & Decisions',
        `
          <div class="detail-card"><h3>Scenario: Peak Load Reduction</h3><p>Verified evidence package with provenance and operator-review status.</p><span class="pill">VERIFIED</span></div>
          <div class="detail-card"><h3>Quantum Optimization Run</h3><p>Candidate comparison with classical baseline.</p><span class="pill">VERIFIED</span></div>
          <div class="detail-card"><h3>Grid Resilience Analysis</h3><p>Semantic + spatial intelligence review.</p><span class="pill">VERIFIED</span></div>
        `,
      ],
      settings: [
        'SYSTEM CONFIGURATION',
        'Settings',
        `
          <div class="detail-card">
            <h3>Safety boundary</h3>
            <p>Recommendations remain advisory. Hardware actuation and infrastructure dispatch stay disabled. Evidence and provenance remain required.</p>
            <div class="pill-row">
              <span class="pill">NO ACTUATION</span>
              <span class="pill">HUMAN REVIEW</span>
              <span class="pill">EVIDENCE REQUIRED</span>
            </div>
          </div>
        `,
      ],
    };
    return sections[action] || sections.overview;
  }

  async function runOptimization() {
    showToast('QUANTUM OPTIMIZATION', 'Starting bounded multi-objective scenario evaluation…');
    try {
      const result = await api('./api/aethergrid/optimize', {
        method: 'POST',
        body: JSON.stringify({ objective: 'minimize_cost_emissions' }),
      });
      serverState.optimization = result.optimization || serverState.optimization;
      setTimeout(
        () =>
          showToast(
            'OPTIMIZATION COMPLETE',
            `Candidate $${Number(serverState.optimization.candidateCost || 10230).toLocaleString()}/hr · classical comparison preserved.`,
          ),
        700,
      );
    } catch {
      setTimeout(
        () =>
          showToast(
            'OPTIMIZATION COMPLETE',
            'Standalone demo candidate generated. Classical comparison and operator review remain required.',
          ),
        700,
      );
    }
  }

  async function exportEvidence(kind) {
    const payload = {
      kind,
      generatedAt: new Date().toISOString(),
      system: serverState.system,
      metrics: serverState.metrics,
      optimization: serverState.optimization,
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
      `,
    );
  }

  qa('[data-dialog-close]').forEach((button) =>
    button.addEventListener('click', () => button.closest('dialog').close()),
  );

  qa('.hotspot').forEach((button) =>
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'run-optimization') return runOptimization();
      if (action === 'compare-classical')
        return showToast(
          'CLASSICAL COMPARISON',
          'Baseline comparison opened for evidence review.',
        );
      if (action === 'ai-chat') {
        chatDialog.showModal();
        chatInput.focus();
        return;
      }
      if (action.startsWith('agent-')) {
        const names = {
          'agent-vaelon': 'VÆLON',
          'agent-auren': 'AUREN',
          'agent-solvaer': 'SOLVÆR',
        };
        return openAgent(names[action]);
      }
      if (action.startsWith('export-')) return exportEvidence(action.replace('export-', ''));
      if (['live', 'forecast', 'scenario-view'].includes(action))
        return showToast(
          `${action.toUpperCase()} VIEW`,
          `New York Metro grid canvas switched to ${action.replace('-', ' ')} review mode.`,
        );
      const [kicker, title, html] = panelFor(action);
      openPanel(kicker, title, html);
    }),
  );

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    chatLog.insertAdjacentHTML(
      'beforeend',
      `<div class="chat-bubble user">${escapeHtml(message)}</div>`,
    );
    chatInput.value = '';
    let reply =
      'VÆLON, AUREN, and SOLVÆR reviewed the request. This interface is advisory-only; recommendations remain evidence-bound and require operator review.';
    try {
      const result = await api('./api/aethergrid/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      reply = result.reply || reply;
    } catch {}
    chatLog.insertAdjacentHTML(
      'beforeend',
      `<div class="chat-bubble system">${escapeHtml(reply)}</div>`,
    );
    chatLog.scrollTop = chatLog.scrollHeight;
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  loadState();
})();