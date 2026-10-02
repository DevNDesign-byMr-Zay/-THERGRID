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
      targets: [
        { src: `${cesiumBuild}/Assets/**/*`, dest: 'cesium/Assets' },
        { src: `${cesiumBuild}/ThirdParty/**/*`, dest: 'cesium/ThirdParty' },
        { src: `${cesiumBuild}/Widgets/**/*`, dest: 'cesium/Widgets' },
        { src: `${cesiumBuild}/Workers/**/*`, dest: 'cesium/Workers' }
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
