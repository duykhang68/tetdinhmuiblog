import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const ROOT = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        editor: resolve(ROOT, 'index.html'),
        starbucksInsights: resolve(ROOT, 'starbucks-insights/index.html'),
        highlandsInsights: resolve(ROOT, 'highlands-insights/index.html'),
        payrollInsights: resolve(ROOT, 'payroll-insights/index.html'),
        expenses: resolve(ROOT, 'expenses/index.html')
      }
    }
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/auth': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
});
