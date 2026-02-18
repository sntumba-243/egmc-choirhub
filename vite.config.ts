import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync } from 'fs';

// Auto-generate version.json with timestamp on each build
const versionPlugin = {
  name: 'version-json',
  buildStart() {
    const version = Date.now().toString();
    writeFileSync('public/version.json', JSON.stringify({ version, timestamp: version }));
    console.log(`📦 Generated version.json: ${version}`);
  }
};

export default defineConfig({
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
