import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'cesium/Build/Cesium/Widgets/widgets.css';

import { App } from './app/App';
import './app/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('ÆTHERGRID root element was not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
