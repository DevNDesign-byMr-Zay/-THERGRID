import { useEffect, useRef, useState } from 'react';

/** Responsive dialog semantics, keyboard containment and focus restoration. */
export function useCommandDrawer(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 1100px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 1100px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open || !compact || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0);
    const focusFrame = requestAnimationFrame(() => (controls()[0] ?? root).focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (!root.contains(document.activeElement)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) (controls()[0] ?? root).focus();
    };
    document.addEventListener('focusin', containFocus);
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, compact]);
  return { ref, compact };
}
