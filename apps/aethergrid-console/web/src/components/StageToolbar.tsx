import { useEffect, useRef, useState } from 'react';
import { VISUAL_MODES } from '../app/city-targets';
import type {
  SpatialInteractionMode,
  VisualMode
} from '../renderer/spatial-renderer';

interface StageToolbarProps {
  frameMode: string;
  scope: 'world' | 'city';
  onWorld: () => void;
  onCity: () => void;
  interactionMode: SpatialInteractionMode;
  onInteractionChange: (mode: SpatialInteractionMode) => void;
  visualMode: VisualMode;
  onVisualChange: (mode: VisualMode) => void;
}

export function StageToolbar({
  frameMode,
  scope,
  onWorld,
  onCity,
  interactionMode,
  onInteractionChange,
  visualMode,
  onVisualChange
}: StageToolbarProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  const updateScrollEdges = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const left = controls.scrollLeft > 1;
    const right = controls.scrollLeft + controls.clientWidth < controls.scrollWidth - 1;
    setScrollEdges((previous) =>
      previous.left === left && previous.right === right ? previous : { left, right }
    );
  };

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateScrollEdges);
    observer?.observe(controls);
    window.addEventListener('resize', updateScrollEdges);
    updateScrollEdges();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollEdges);
    };
  }, []);

  const scrollControls = (direction: -1 | 1) => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.scrollBy({
      left: direction * Math.max(180, Math.floor(controls.clientWidth * 0.75)),
      behavior: 'instant'
    });
    updateScrollEdges();
  };

  return (
    <div className="stage-toolbar">
      <div>
        <span className="eyebrow">ACTIVE FRAME</span>
        <strong>{frameMode.toUpperCase()}</strong>
      </div>
      <div className="stage-control-scroll">
        <button
          type="button"
          className="stage-control-arrow"
          aria-label="Scroll spatial controls left"
          disabled={!scrollEdges.left}
          onClick={() => scrollControls(-1)}
        >
          ‹
        </button>
        <div
          className="stage-controls"
          ref={controlsRef}
          tabIndex={0}
          aria-label="Spatial controls — use arrow keys to scroll"
          onScroll={updateScrollEdges}
        >
          <div className="scope-modes" role="group" aria-label="Spatial scope">
            <button
              type="button"
              className={scope === 'world' ? 'active' : ''}
              aria-pressed={scope === 'world'}
              onClick={onWorld}
            >
              WORLD
            </button>
            <button
              type="button"
              className={scope === 'city' ? 'active' : ''}
              aria-pressed={scope === 'city'}
              onClick={onCity}
            >
              CITY
            </button>
          </div>
          <div className="interaction-modes" role="group" aria-label="Spatial interaction">
            {(['inspect', 'measure', 'measure-area'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={interactionMode === mode ? 'active' : ''}
                aria-pressed={interactionMode === mode}
                onClick={() => onInteractionChange(mode)}
              >
                {mode === 'measure-area' ? 'AREA' : mode.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="visual-modes" role="group" aria-label="Visual mode">
            {VISUAL_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === visualMode ? 'active' : ''}
                aria-pressed={mode === visualMode}
                onClick={() => onVisualChange(mode)}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="stage-control-arrow"
          aria-label="Scroll spatial controls right"
          disabled={!scrollEdges.right}
          onClick={() => scrollControls(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
