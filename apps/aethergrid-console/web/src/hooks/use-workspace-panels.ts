import { useEffect, useState } from 'react';
import { useCommandDrawer } from './use-command-drawer';
import type { DomainId } from '../domains/domain-registry';
import type { VisualMode } from '../renderer/spatial-renderer';

export function useWorkspacePanels({ scope, visualMode }: { scope: 'world' | 'city'; visualMode: VisualMode }) {
  const [intelOpen, setIntelOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navigationTab, setNavigationTab] = useState('world');
  const [inspector, setInspector] = useState('overview');
  const [productMode, setProductMode] = useState('GLOBAL');
  const [activeDomain, setActiveDomain] = useState<DomainId>('energy');
  const navigationDrawer = useCommandDrawer(navOpen, () => setNavOpen(false));
  const intelligenceDrawer = useCommandDrawer(intelOpen, () => setIntelOpen(false));
  const [intelWorkspace, setIntelWorkspace] = useState<
    | 'context'
    | 'operations'
    | 'analysis'
    | 'ai'
    | 'scenario'
    | 'quantum'
    | 'evidence'
    | 'system'
    | 'settings'
  >('context');
  const openIntelligence = () => { setNavOpen(false); setIntelOpen(true); };
  const showIntelligence = (workspace: typeof intelWorkspace) => {
    setInspector('overview'); setIntelWorkspace(workspace); openIntelligence();
  };
  useEffect(() => {
    setProductMode(scope === 'world' ? 'GLOBAL' : visualMode === 'holographic' ? 'HOLOGRAPHIC' : 'GRID');
  }, [scope, visualMode]);
  return { intelOpen, setIntelOpen, navOpen, setNavOpen, navigationTab, setNavigationTab, inspector, setInspector, productMode, setProductMode, activeDomain, setActiveDomain, navigationDrawer, intelligenceDrawer, intelWorkspace, setIntelWorkspace, openIntelligence, showIntelligence };
}
