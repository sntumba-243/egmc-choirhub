import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync, readFileSync } from 'fs';

// Auto-generate version.json with timestamp on each build
const versionPlugin = {
  name: 'version-json',
  buildStart() {
    const version = Date.now().toString();
    writeFileSync('public/version.json', JSON.stringify({ version, timestamp: version }));
    console.log(`📦 Generated version.json: ${version}`);
  }
};

// Read current version.json to bake into the build
function getBuildVersion(): string {
  try {
    const data = JSON.parse(readFileSync('public/version.json', 'utf-8'));
    return data.version || '0';
  } catch {
    return '0';
  }
}

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(getBuildVersion()),
  },
  plugins: [react(), versionPlugin],
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
  },
});
