(() => {
  'use strict';
  // Classic-script companion for direct-open and inlined legacy HTML.
  function resolvedTheme(theme, systemLight = false) {
    return theme === 'system'
      ? systemLight
        ? 'light'
        : 'dark'
      : theme === 'light'
        ? 'light'
        : 'dark';
  }

  function loadStoredSettings(storage, key, defaults) {
    try {
      if (typeof storage === 'function') storage = storage();
      return { ...defaults, ...JSON.parse(storage.getItem(key) || '{}') };
    } catch {
      return { ...defaults };
    }
  }

  function saveStoredSettings(storage, key, settings) {
    storage.setItem(key, JSON.stringify(settings));
  }

  function settingsPresentation(settings, systemLight = false) {
    return {
      theme: resolvedTheme(settings.theme, systemLight),
      density: settings.density,
      spatialLabels: settings.spatialLabels ? 'on' : 'off',
      motion: settings.reducedMotion || settings.animationIntensity === 0 ? 'reduced' : 'full',
      animationScale: String(settings.animationIntensity / 100),
      bindings: {
        settingTheme: settings.theme,
        settingDefaultWorkspace: settings.defaultWorkspace,
        settingDensity: settings.density,
        settingAnimation: settings.animationIntensity,
        settingReducedMotion: settings.reducedMotion,
        settingAutoRotate: settings.autoRotate,
        settingSpatialLabels: settings.spatialLabels,
        settingHour: settings.defaultHour,
        settingLiveStream: settings.liveStream,
        settingRefresh: String(settings.refreshMs),
      },
    };
  }

  function createSettingsUi({
    document,
    state,
    settingsKey,
    defaultSettings,
    getStorage,
    getSystemTheme,
    formatHour,
    applyRendererSettings,
    configureTelemetry,
    healthCheck,
    showToast,
  }) {
    const q = (selector) => document.querySelector(selector);

    function isLightTheme() {
      return resolvedTheme(state.settings.theme, Boolean(getSystemTheme()?.matches)) === 'light';
    }

    function loadSettings() {
      state.settings = loadStoredSettings(getStorage, settingsKey, defaultSettings);
      applySettings();
    }

    function saveSettings() {
      saveStoredSettings(getStorage(), settingsKey, state.settings);
      applySettings();
      const badge = q('#settingsSavedBadge');
      if (badge) {
        badge.textContent = 'SAVED';
        clearTimeout(saveSettings.timer);
        saveSettings.timer = setTimeout(() => (badge.textContent = 'SAVED LOCALLY'), 1200);
      }
    }

    function applySettings() {
      const view = settingsPresentation(state.settings, isLightTheme());
      document.documentElement.dataset.theme = view.theme;
      document.documentElement.style.colorScheme = view.theme;
      document.body.dataset.density = view.density;
      document.body.dataset.spatialLabels = view.spatialLabels;
      document.body.dataset.motion = view.motion;
      document.documentElement.style.setProperty('--animation-scale', view.animationScale);
      const bindings = view.bindings;
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

      applyRendererSettings(state.settings.defaultHour, state.settings.autoRotate);
      const gridSlider = q('#timeSlider');
      const holoSlider = q('#holoTimeSlider');
      if (gridSlider) gridSlider.value = state.settings.defaultHour;
      if (holoSlider) holoSlider.value = state.settings.defaultHour;
      if (q('#timeValue')) q('#timeValue').textContent = formatHour(state.settings.defaultHour);
      if (q('#holoTimeValue'))
        q('#holoTimeValue').textContent = formatHour(state.settings.defaultHour);
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
            mode === 'checked'
              ? input.checked
              : mode === 'number'
                ? Number(input.value)
                : input.value;
          saveSettings();
          if (key === 'liveStream') configureTelemetry();
        });
        input.addEventListener('change', () => {
          state.settings[key] =
            mode === 'checked'
              ? input.checked
              : mode === 'number'
                ? Number(input.value)
                : input.value;
          saveSettings();
          if (key === 'liveStream' || key === 'refreshMs') configureTelemetry();
        });
      }
      q('[data-action="reset-settings"]')?.addEventListener('click', () => {
        state.settings = { ...defaultSettings };
        getStorage().removeItem(settingsKey);
        applySettings();
        configureTelemetry();
        showToast('SETTINGS RESET', 'Operator preferences restored to defaults.');
      });
      q('[data-action="health-check"]')?.addEventListener('click', healthCheck);
      getSystemTheme()?.addEventListener?.('change', () => {
        if (state.settings.theme === 'system') applySettings();
      });
    }

    return Object.freeze({ loadSettings, bindSettings, isLightTheme });
  }

  globalThis.AETHERGRID_SETTINGS_CONTROLLER = Object.freeze({
    resolvedTheme,
    loadSettings: loadStoredSettings,
    saveSettings: saveStoredSettings,
    applySettings: settingsPresentation,
    createSettingsUi,
  });
})();
