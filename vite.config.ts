import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// npm run build        — обычная сборка для сервера: мелкие файлы с хэшами, кэшируются браузером (важно на медленных каналах).
// npm run build:single — всё приложение одним файлом dist-single/index.html: открыть двойным щелчком или переслать.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: mode === 'single'
    ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 20000 }
    : {
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('katex')) return 'vendor-katex'
                if (id.includes('markdown-it') || id.includes('yaml')) return 'vendor-parsers'
                if (id.includes('react')) return 'vendor-react'
              }
              return undefined
            },
          },
        },
      },
  server: { open: true, proxy: { '/api': 'http://localhost:8787' } },
}))
