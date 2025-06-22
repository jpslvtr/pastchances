import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Custom plugin to ensure critical files are copied
const copyPublicFiles = () => {
  return {
    name: 'copy-public-files',
    writeBundle() {
      const publicFiles = [
        'stanford.png',
        'stanford.svg',
        'share.png',
        'robots.txt',
        'sitemap.xml',
        '_headers'
      ];

      publicFiles.forEach(file => {
        const src = resolve('public', file);
        const dest = resolve('dist', file);

        if (existsSync(src)) {
          try {
            copyFileSync(src, dest);
            console.log(`✅ Copied ${file} to dist`);
          } catch (error) {
            console.log(`❌ Failed to copy ${file}:`, error);
          }
        } else {
          console.log(`⚠️ Source file not found: ${src}`);
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyPublicFiles()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  }
})