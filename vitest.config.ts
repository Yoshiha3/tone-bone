import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@codecs': resolve(__dirname, 'src/codecs'),
      '@packs': resolve(__dirname, 'src/packs'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@visualizers': resolve(__dirname, 'src/visualizers'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@persistence': resolve(__dirname, 'src/persistence'),
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts']
  }
})
