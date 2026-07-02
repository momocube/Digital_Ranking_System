import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';

/**
 * MPA 架構：4 個 HTML 對應 4 個頁面
 *  index.html         → 主頁          (雙擊入口)
 *  console.html       → 投播控制台
 *  broadcast.html     → 投播畫面      (被控制台 window.open)
 *  full-ranking.html  → 完整名次      (被控制台 window.open)
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    open: '/index.html'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:        resolve(__dirname, 'index.html'),
        console:     resolve(__dirname, 'console.html'),
        broadcast:   resolve(__dirname, 'broadcast.html'),
        fullRanking: resolve(__dirname, 'full-ranking.html')
      }
    }
  }
});
