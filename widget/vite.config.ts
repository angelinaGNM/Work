import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@copilot-poc/icons': path.resolve(__dirname, '../../copilot-poc/icons'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/copilot': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Disable proxy buffering so SSE events stream through immediately
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
  },
})
