(() => {
  'use strict';
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

  globalThis.AETHERGRID_ENVIRONMENT_HELPERS = Object.freeze({ environmentHour, weatherPhenomenon });
})();
