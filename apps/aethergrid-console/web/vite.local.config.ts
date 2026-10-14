import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));

// Classic inline JavaScript does not require a server or file-origin module access.
export default defineConfig({
  plugins: [react()],
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
