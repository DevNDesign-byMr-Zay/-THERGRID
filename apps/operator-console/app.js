(() => {
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => [...root.querySelectorAll(s)];

  const demo = {
    system: { status: 'All Systems Nominal', region: 'NEW YORK METRO' },
    generationMw: 2130,
    loadMw: 2410,
    renewablePercent: 46.8,
    storageMw: 590,
    models: ['VÆLON', 'AUREN', 'SOLVÆR'],
  };

  function setMode(mode) {
    qsa('.mode-tab').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    const target = qs(`#${mode}`) || qs('#overview');
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    flash(target);
  }

  function flash(node) {
    if (!node) return;
    node.animate(
      [
        { boxShadow: '0 0 0 rgba(25,220,255,0)' },
        { boxShadow: '0 0 32px rgba(25,220,255,.28)' },
        { boxShadow: '0 0 0 rgba(25,220,255,0)' },
      ],
      { duration: 900, easing: 'ease-out' },
    );
  }

  function setSection(section) {
    qsa('.side-item').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
    const topMode = ['grid', 'holographic', 'quantum', 'ai', 'evidence'].includes(section) ? section : 'grid';
    qsa('.mode-tab').forEach((button) => button.classList.toggle('active', button.dataset.mode === topMode));
    (qs(`#${section}`) || qs('#overview'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setClock() {
    const now = new Date();
    const date = qs('#systemDate');
    const clock = qs('#systemClock');
    if (!date || !clock) return;
    date.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    clock.textContent = `${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} LOCAL`;
  }

  function showToast(title, copy) {
    const toast = qs('#toast');
    if (!toast) return;
    qs('b', toast).textContent = title;
    qs('small', toast).textContent = copy;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function wireActions() {
    qsa('.mode-tab').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
    qsa('.side-item').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.section)));

    qsa('.segmented button').forEach((button) => {
      button.addEventListener('click', () => {
        qsa('.segmented button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        showToast(`${button.textContent.toUpperCase()} VIEW`, `Grid scene switched to ${button.textContent.toLowerCase()} review mode.`);
      });
    });

    qsa('.map-tools button').forEach((button, index) => button.addEventListener('click', () => {
      showToast('MAP CONTROL', `Spatial control ${index + 1} engaged in advisory-only mode.`);
    }));

    qs('.run-button')?.addEventListener('click', (event) => {
      const button = event.currentTarget;
      const original = button.textContent;
      button.textContent = '◌ Optimizing…';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = '✓ Optimization Complete';
        showToast('QUANTUM RUN COMPLETE', 'Candidate scenario generated. Classical comparison and operator review remain required.');
        setTimeout(() => { button.textContent = original; button.disabled = false; }, 2200);
      }, 1600);
    });

    qs('.compare-button')?.addEventListener('click', () => showToast('CLASSICAL COMPARISON', 'Baseline comparison opened for evidence review.'));
    qsa('.holo-card').forEach((card) => card.addEventListener('click', () => {
      qsa('.holo-card').forEach((item) => item.classList.remove('active'));
      card.classList.add('active');
      showToast('HOLOGRAPHIC LAYER', `${qs('b', card).textContent} layer selected.`);
    }));
    qsa('.outline-button').forEach((button) => button.addEventListener('click', () => showToast('VIEW READY', `${button.textContent.trim()} opened in read-only review mode.`)));
    qsa('.export-grid button').forEach((button) => button.addEventListener('click', () => showToast('EXPORT PREPARED', `${qs('b', button).textContent} queued with provenance metadata.`)));

    const prompt = qs('.ai-prompt input');
    const send = qs('.ai-prompt .send');
    const submitPrompt = () => {
      const value = prompt?.value.trim();
      if (!value) return showToast('AI COLLABORATION', 'Enter an operator question for the model team.');
      showToast('AI TEAM RECEIVED', `VÆLON, AUREN, and SOLVÆR are reviewing: “${value.slice(0, 58)}${value.length > 58 ? '…' : ''}”`);
      prompt.value = '';
    };
    send?.addEventListener('click', submitPrompt);
    prompt?.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitPrompt(); });
  }

  async function refreshFromRuntime() {
    if (location.protocol === 'file:') return;
    try {
      const [capRes, stateRes] = await Promise.all([
        fetch('./api/capabilities', { headers: { accept: 'application/json' } }),
        fetch('./api/operator-state', { headers: { accept: 'application/json' } }),
      ]);
      if (!capRes.ok || !stateRes.ok) return;
      const [capabilities, operatorState] = await Promise.all([capRes.json(), stateRes.json()]);
      const agents = qsa('.agent-card');
      capabilities.ai?.models?.forEach((model, index) => {
        const card = agents[index];
        if (!card) return;
        qs('.agent-title b', card).textContent = model.id;
        const role = qs('.agent-copy>small', card);
        if (role) role.textContent = String(model.role || '').replaceAll('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
      });
      const totals = operatorState.twin?.totals;
      if (totals) {
        const cards = qsa('.metric-card b');
        if (cards[0]) cards[0].innerHTML = `${Math.round(totals.generationKw / 1000).toLocaleString()} <em>MW</em>`;
        if (cards[1]) cards[1].innerHTML = `${Math.round(totals.loadKw / 1000).toLocaleString()} <em>MW</em>`;
      }
    } catch {
      // The standalone HTML intentionally keeps the complete demonstration UI available.
    }
  }

  function init() {
    document.documentElement.dataset.ready = 'true';
    setClock();
    setInterval(setClock, 1000);
    wireActions();
    refreshFromRuntime();
    setTimeout(() => showToast('ÆTHERGRID READY', `${demo.system.region} operator console initialized. Advisory-only authority boundary is active.`), 550);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
