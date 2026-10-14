import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'cesium/Build/Cesium/Widgets/widgets.css';

import { SessionGate } from './components/SessionGate';
import { installStandaloneRuntime } from './standalone/runtime';

import { App } from './app/App';
import './app/app.css';
import './app/command-center.css';

const root = document.getElementById('root');
installStandaloneRuntime();
if (!root) throw new Error('ÆTHERGRID root element was not found');

createRoot(root).render(
  <StrictMode>
    <SessionGate><App /></SessionGate>
  </StrictMode>
);
