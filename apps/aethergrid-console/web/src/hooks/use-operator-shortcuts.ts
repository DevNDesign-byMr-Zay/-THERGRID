import { useEffect } from 'react';

interface OperatorShortcutActions {
  focusSearch(): void;
  showWorld(): void;
  showCity(): void;
  goLive(): void;
  toggleIntel(): void;
}

function editableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return (
    element.isContentEditable ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select'
  );
}

export function useOperatorShortcuts(actions: OperatorShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;

      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        actions.focusSearch();
        return;
      }

      if (editableTarget(event.target) || command || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'g') {
        actions.showWorld();
      } else if (key === 'c') {
        actions.showCity();
      } else if (key === 'l') {
        actions.goLive();
      } else if (key === 'i') {
        actions.toggleIntel();
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [actions]);
}
