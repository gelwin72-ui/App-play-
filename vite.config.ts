import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const rootDir = import.meta.dirname;

export default defineConfig(() => {
  return {
    // Relative base ensures assets resolve cleanly on GitHub Pages subpaths (/repo-name/) and root domains
    base: './',
    plugins: [
      {
        name: 'mark-vite-runtime',
        transformIndexHtml(html: string) {
          return html.replace(
            '/*__VITE_RUNTIME__*/',
            'window.__APPVERSE_VITE_RUNTIME__ = true;',
          );
        },
      },
      react(),
      tailwindcss(),
      {
        name: 'copy-unbundled-src-assets-and-spa-fallback',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
          // Create 404.html fallback for GitHub Pages SPA deep links
          const distIndex = path.resolve(distDir, 'index.html');
          const dist404 = path.resolve(distDir, '404.html');
          if (fs.existsSync(distIndex)) {
            fs.copyFileSync(distIndex, dist404);
          }
          // Sync static pre-built bundle into /gh-pages/ for branch-based GitHub Pages deployments
          if (process.env.GITHUB_ACTIONS !== 'true') {
            const distBuiltAssets = path.resolve(distDir, 'assets');
            const ghPagesDir = path.resolve(rootDir, 'gh-pages');
            if (fs.existsSync(distBuiltAssets)) {
              fs.rmSync(ghPagesDir, {recursive: true, force: true});
              fs.mkdirSync(ghPagesDir, {recursive: true});
              for (const entry of fs.readdirSync(distBuiltAssets)) {
                const srcFile = path.join(distBuiltAssets, entry);
                if (!fs.statSync(srcFile).isFile()) {
                  continue;
                }
                if (entry.startsWith('index-') && entry.endsWith('.js')) {
                  fs.copyFileSync(srcFile, path.join(ghPagesDir, 'appverse.js'));
                } else if (entry.startsWith('index-') && entry.endsWith('.css')) {
                  fs.copyFileSync(srcFile, path.join(ghPagesDir, 'appverse.css'));
                } else {
                  fs.copyFileSync(srcFile, path.join(ghPagesDir, entry));
                }
              }
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
