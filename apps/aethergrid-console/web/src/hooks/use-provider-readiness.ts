import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadPublicProviderRuntime, loadRuntimeDiagnostics,
  type PublicProviderRuntime, type RuntimeDiagnostics
} from '../services/runtime-client';

export function useProviderReadiness() {
  const [state, setState] = useState<{
    runtime: RuntimeDiagnostics | null;
    providers: PublicProviderRuntime | null;
    loading: boolean;
    error: string | null;
    checkedAt: string | null;
  }>({ runtime: null, providers: null, loading: true, error: null, checkedAt: null });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    void Promise.all([
      loadRuntimeDiagnostics(controller.signal),
      loadPublicProviderRuntime(controller.signal)
    ]).then(([runtime, providers]) => {
      if (controller.signal.aborted || request.current !== controller) return;
      setState({ runtime, providers, loading: false, error: null, checkedAt: new Date().toISOString() });
    }).catch(() => {
      if (controller.signal.aborted || request.current !== controller) return;
      setState((previous) => ({ ...previous, loading: false, error: 'Provider readiness is unavailable. Retry to check the registry again.' }));
    });
  }, []);
  useEffect(() => {
    refresh();
    return () => request.current?.abort();
  }, [refresh]);
  return { ...state, refresh };
}
