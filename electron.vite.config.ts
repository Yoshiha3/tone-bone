import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { PRODUCTION_CSP } from './src/main/security'

function injectProductionCspPlugin(): Plugin {
  return {
    name: 'onkai-production-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: PRODUCTION_CSP
          },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

const sharedAlias = {
  '@core': resolve(__dirname, 'src/core'),
  '@codecs': resolve(__dirname, 'src/codecs'),
  '@packs': resolve(__dirname, 'src/packs'),
  '@audio': resolve(__dirname, 'src/audio'),
  '@visualizers': resolve(__dirname, 'src/visualizers'),
  '@platform': resolve(__dirname, 'src/platform'),
  '@persistence': resolve(__dirname, 'src/persistence'),
  '@renderer': resolve(__dirname, 'src/renderer')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: sharedAlias },
    plugins: [react(), injectProductionCspPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
