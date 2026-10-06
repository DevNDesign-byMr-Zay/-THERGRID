import { useState } from 'react';

import type {
  AppearanceMode,
  ResolvedAppearance
} from '../hooks/use-appearance';
import { RuntimeDiagnosticsPanel } from './RuntimeDiagnosticsPanel';

type SettingsSection = 'appearance' | 'developer';

interface SettingsAppearance {
  mode: AppearanceMode;
  resolved: ResolvedAppearance;
  setMode: (next: AppearanceMode) => void;
}

interface SettingsPanelProps {
  appearance: SettingsAppearance;
}

const APPEARANCE_MODES: readonly AppearanceMode[] = ['dark', 'light', 'system'];

export function SettingsPanel({ appearance }: SettingsPanelProps) {
  const [section, setSection] = useState<SettingsSection>('appearance');

  return (
    <section className="settings-panel" aria-label="Settings">
      <header className="settings-panel-head">
        <div>
          <small>SYSTEM SETTINGS</small>
          <strong>{section === 'appearance' ? 'APPEARANCE' : 'DEVELOPER / DIAGNOSTICS'}</strong>
        </div>
        <span>{appearance.resolved.toUpperCase()} ACTIVE</span>
      </header>

      <nav className="settings-section-tabs" aria-label="Settings sections">
        <button
          type="button"
          className={section === 'appearance' ? 'active' : ''}
          aria-pressed={section === 'appearance'}
          onClick={() => setSection('appearance')}
        >
          APPEARANCE
        </button>
        <button
          type="button"
          className={section === 'developer' ? 'active' : ''}
          aria-pressed={section === 'developer'}
          onClick={() => setSection('developer')}
        >
          DEVELOPER / DIAGNOSTICS
        </button>
      </nav>

      {section === 'appearance' ? (
        <div className="settings-section settings-appearance">
          <div className="settings-section-copy">
            <small>THEME</small>
            <strong>Choose how ÆTHERGRID renders operator surfaces.</strong>
            <p>
              System follows the operating-system preference. The selected theme applies
              immediately and remains in memory even when browser storage is unavailable.
            </p>
          </div>
          <div className="settings-choice-grid" role="group" aria-label="Appearance mode">
            {APPEARANCE_MODES.map((mode) => (
              <button
                type="button"
                key={mode}
                className={appearance.mode === mode ? 'active' : ''}
                aria-pressed={appearance.mode === mode}
                onClick={() => {
                  if (mode === 'dark') appearance.setMode('dark');
                  else if (mode === 'light') appearance.setMode('light');
                  else appearance.setMode('system');
                }}
              >
                <span aria-hidden="true">
                  {mode === 'dark' ? '◐' : mode === 'light' ? '☀' : '◒'}
                </span>
                <strong>{mode.toUpperCase()}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="settings-section settings-developer">
          <div className="settings-section-copy">
            <small>DEVELOPER / DIAGNOSTICS</small>
            <strong>Connection Center and provider readiness</strong>
            <p>
              Diagnostics report server-safe configuration and provider state. Credentials
              are never rendered in this client.
            </p>
          </div>
          <RuntimeDiagnosticsPanel />
        </div>
      )}
    </section>
  );
}
