import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// npm run build        — обычная сборка для сервера: мелкие файлы с хэшами, кэшируются браузером (важно на медленных каналах).
// npm run build:single — всё приложение одним файлом dist-single/index.html: открыть двойным щелчком или переслать.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 20000 } : { chunkSizeWarningLimit: 2500 },
  server: { open: true, proxy: { '/api': 'http://localhost:8787' } },
}))
