(() => {
  'use strict';
  // Classic-script companion for direct-open and inlined legacy HTML.
  function resolvedTheme(theme, systemLight = false) {
    return theme === 'system' ? (systemLight ? 'light' : 'dark') : theme === 'light' ? 'light' : 'dark';
  }

  function loadSettings(storage, key, defaults) {
    try {
      return { ...defaults, ...JSON.parse(storage.getItem(key) || '{}') };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(storage, key, settings) {
    storage.setItem(key, JSON.stringify(settings));
  }

  function applySettings(settings, systemLight = false) {
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

  globalThis.AETHERGRID_SETTINGS_CONTROLLER = Object.freeze({
    resolvedTheme, loadSettings, saveSettings, applySettings,
  });
})();
