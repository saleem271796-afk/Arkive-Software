import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase'],
          charts: ['recharts'],
          utils: ['date-fns', 'xlsx', 'clsx']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
