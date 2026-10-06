import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const directory = path.dirname(fileURLToPath(import.meta.url));
const cesiumBuild = normalizePath(path.join(directory, 'node_modules/cesium/Build/Cesium'));

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      // Strip node_modules/cesium/Build/Cesium/<group>, preserving nested asset paths.
      targets: [
        { src: `${cesiumBuild}/Assets/**/*`, dest: 'cesium/Assets', rename: { stripBase: 5 } },
        { src: `${cesiumBuild}/ThirdParty/**/*`, dest: 'cesium/ThirdParty', rename: { stripBase: 5 } },
        { src: `${cesiumBuild}/Widgets/**/*`, dest: 'cesium/Widgets', rename: { stripBase: 5 } },
        { src: `${cesiumBuild}/Workers/**/*`, dest: 'cesium/Workers', rename: { stripBase: 5 } }
      ]
    })
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium')
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8090'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true
  }
});
