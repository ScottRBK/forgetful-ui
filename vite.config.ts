import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = (env.FORGETFUL_API_URL || 'http://127.0.0.1:8022').replace(/\/+$/, '')
  const proxy = {
    '/api': { target, changeOrigin: false },
    '/health': { target, changeOrigin: false },
    '/.well-known': { target, changeOrigin: false },
  }

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4174,
      strictPort: true,
      proxy,
    },
    build: {
      outDir: 'dist',
    },
  }
})
