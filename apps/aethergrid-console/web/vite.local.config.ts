import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));

// Classic inline JavaScript does not require a server or file-origin module access.
export default defineConfig({
  plugins: [react(), {
    name: 'embedded-cesium-module-urls',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.endsWith('buildModuleUrl.js') && importer?.includes('/@cesium/engine/')) {
        return path.join(directory, 'src/standalone/cesium-module-url.ts');
      }
    },
    transform(code, id) {
      if (id.endsWith('/Core/TaskProcessor.js')) {
        return code.replace('function createWorker(url) {', `function createWorker(url) {
          const embedded = globalThis.__AETHERGRID_ASSETS__;
          const key = 'Workers/' + url.replace(/\\.js$/, '') + '.js';
          if (embedded && embedded[key]) return new Worker(embedded[key], {type:'classic'});
        `);
      }
    }
  }],
  define: {
    CESIUM_BASE_URL: JSON.stringify('./web/dist/cesium'),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.url': 'location.href'
  },
  build: {
    outDir: 'local-dist',
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: path.join(directory, 'src/main.tsx'),
      name: 'AethergridLocal',
      formats: ['iife'],
      fileName: () => 'workspace.js',
      cssFileName: 'workspace'
    }
  }
});
