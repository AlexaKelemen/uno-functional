import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The functional model from assignment 4 lives in ../src. `@model` points there,
// so the client uses the very same code that the model tests cover.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@model': fileURLToPath(new URL('../src/model', import.meta.url)),
      '@utils': fileURLToPath(new URL('../src/utils', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // The model imports lodash; use the client's copy for it too
    dedupe: ['lodash'],
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
  },
})
