import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  server: {
    proxy: {
      '/api': 'http://localhost:5503',
      '/status': 'http://localhost:5503',
      '/control': 'http://localhost:5503',
      '/activate': 'http://localhost:5503',
      '/license': 'http://localhost:5503',
      '/save': 'http://localhost:5503',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
})
