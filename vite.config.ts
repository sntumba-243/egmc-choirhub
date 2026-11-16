import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { writeFileSync, readFileSync, readdirSync, statSync } from 'fs';

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

// Service-worker precache: after the bundle is written, inject this build's
// version and the full list of built files into dist/service-worker.js so the
// SW install caches the ENTIRE app shell (JS/CSS chunks, pdf.js worker, icons).
// Without it, offline launches got index.html but none of its hashed assets.
const SW_EXCLUDE = /(^|\/)(service-worker\.js|firebase-messaging-sw\.js|version\.json|index\.html)$|\.map$/;
const swPrecachePlugin = {
  name: 'sw-precache',
  apply: 'build' as const,
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else {
          const rel = path.relative(dist, full).split(path.sep).join('/');
          if (!SW_EXCLUDE.test(rel)) files.push('/' + rel);
        }
      }
    };
    walk(dist);
    const swPath = path.join(dist, 'service-worker.js');
    let sw = readFileSync(swPath, 'utf8');
    if (!sw.includes('/*__PRECACHE_MANIFEST__*/[]') || !sw.includes("const SW_VERSION = 'dev';")) {
      throw new Error('sw-precache: placeholders missing from public/service-worker.js');
    }
    sw = sw
      .replace("const SW_VERSION = 'dev';", `const SW_VERSION = '${BUILD_VERSION}';`)
      .replace('/*__PRECACHE_MANIFEST__*/[]', JSON.stringify(files.sort()));
    writeFileSync(swPath, sw);
    console.log(`🗂  SW precache: ${files.length} files injected (version ${BUILD_VERSION})`);
  },
};

// Sentry source maps: uploaded only when SENTRY_AUTH_TOKEN is set (Vercel env
// var). Without it — local/CI builds — the plugin is disabled and no maps are
// emitted, so the build never fails on a missing token. With it, maps are
// 'hidden' (no sourceMappingURL in the bundle) and deleted from dist after
// upload, so they're never served publicly.
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    versionPlugin,
    swPrecachePlugin,
    sentryVitePlugin({
      // Slugs, not IDs: override with SENTRY_ORG / SENTRY_PROJECT env vars if they differ.
      org: process.env.SENTRY_ORG || 'o4511217496227841',
      project: process.env.SENTRY_PROJECT || 'choirhub',
      authToken: SENTRY_AUTH_TOKEN,
      disable: !SENTRY_AUTH_TOKEN,
      telemetry: false,
      // Release = git SHA (auto-detected from VERCEL_GIT_COMMIT_SHA on Vercel).
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }),
  ],
  build: {
    // Vite 7 defaults to 'baseline-widely-available' (~Chrome107/Safari16), which
    // can leave the MAIN bundle one syntax feature away from breaking older,
    // hardware-capped iPads entirely. Down-level to es2018/safari13 so the app
    // shell runs there too (the PDF layer uses pdfjs' legacy build separately).
    // Negligible bundle-size cost; a few transpiled helpers.
    target: ['es2018', 'safari13'],
    sourcemap: SENTRY_AUTH_TOKEN ? 'hidden' : false,
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
