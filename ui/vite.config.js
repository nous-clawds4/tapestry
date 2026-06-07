import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Local control panel: default `docker compose` maps host :7778 (and :80 via nginx).
        // :8080 is the PRODUCTION remap only (OPERATIONS.md sed "80:80"→"127.0.0.1:8080:80"),
        // absent on a default local stack.
        target: 'http://localhost:7778',
        changeOrigin: true,
      },
    },
  },
})
