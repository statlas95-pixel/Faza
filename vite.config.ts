import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Сборка в один файл dist/index.html: его можно открыть двойным щелчком или переслать коллеге.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 20000 },
  server: { open: true, proxy: { '/api': 'http://localhost:8787' } },
})
