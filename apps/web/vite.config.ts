import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

// GitHub Pages serves the site at https://<user>.github.io/test-case-exorcist/
export default defineConfig({
  base: process.env['BASE_PATH'] ?? '/test-case-exorcist/',
  plugins: [react()],
  // Most of the bundle is the compromise NLP tagger (~600 kB, ~230 kB gzipped).
  build: { chunkSizeWarningLimit: 1000 },
  resolve: {
    alias: {
      // Use the core library's TypeScript source directly (no separate build step).
      '@exorcist/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
})
