import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { writeFileSync } from 'fs';

// One build version, written to version.json AND baked into the bundle so they
// always match. A later deploy writes a NEWER version.json than the running
// bundle's baked value — that mismatch is exactly the "update available" signal.
const BUILD_VERSION = Date.now().toString();
const versionPlugin = {
  name: 'version-json',
  buildStart() {
    writeFileSync('public/version.json', JSON.stringify({ version: BUILD_VERSION, timestamp: BUILD_VERSION }));
    console.log(`📦 Generated version.json: ${BUILD_VERSION}`);
  }
};

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    versionPlugin,
    sentryVitePlugin({
      org: 'o4511217496227841',
      project: 'choirhub',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react'],
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['pdfjs-dist'],
  },
});
