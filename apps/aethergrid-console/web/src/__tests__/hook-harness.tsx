import { createRoot } from 'react-dom/client';
import { useWorkspacePanels } from '../hooks/use-workspace-panels';
import { useWeatherRadar } from '../hooks/use-weather-radar';
import { useOperationalContext } from '../hooks/use-operational-context';

const globals = window as typeof window & { hook: any; update: (props: any) => void; unmount: () => void };
const root = createRoot(document.getElementById('root')!);
let props: any = {
  scope: 'city', mode: 'live', enabled: true, visualMode: 'solid',
  city: { id: 'new-york', latitude: 40.75, longitude: -73.98 },
};
const kind = new URLSearchParams(location.search).get('hook');
function Panels() {
  const value = useWorkspacePanels(props);
  globals.hook = value;
  return <><button id="trigger" onClick={() => value.setNavOpen(true)}>Open</button>
    <nav ref={value.navigationDrawer.ref} hidden={!value.navOpen}><button>Navigation</button></nav>
    <aside ref={value.intelligenceDrawer.ref} hidden={!value.intelOpen}><button>Intelligence</button></aside>
    <output>{JSON.stringify({ nav: value.navOpen, intel: value.intelOpen, workspace: value.intelWorkspace })}</output></>;
}
function Radar() { globals.hook = useWeatherRadar(props); return <output>Radar ready</output>; }
function Operational() { globals.hook = useOperationalContext(props); return <output>Operational ready</output>; }
function render() { root.render(kind === 'panels' ? <Panels /> : kind === 'radar' ? <Radar /> : <Operational />); }
globals.update = (next) => { props = { ...props, ...next }; render(); };
globals.unmount = () => root.unmount();
render();
