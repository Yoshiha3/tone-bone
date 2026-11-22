import { describe, expect, it } from 'vitest'
import type { ResourcePack } from '@core/types'
import { mergeResourcePacks } from '@packs/packMerger'

const basePack: ResourcePack = {
  meta: {
    id: 'base',
    name: 'Base',
    version: '1.0.0',
    author: 'Test',
    description: 'Base pack'
  },
  source: 'builtin',
  path: '/base',
  tokens: {
    '--bg-app': '#ffffff',
    '--accent-primary': '#336699'
  },
  overrideCss: '.a { color: red; }',
  visualizer: { background: '#ffffff', waveColor: '#336699' },
  instruments: [
    {
      id: 'soft-sine',
      name: 'Soft Sine',
      type: 'synth',
      synth: { waveform: 'sine', attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 }
    }
  ]
}

const overlayPack: ResourcePack = {
  meta: {
    id: 'overlay',
    name: 'Overlay',
    version: '1.0.0',
    author: 'Test',
    description: 'Overlay pack'
  },
  source: 'user',
  path: '/overlay',
  tokens: {
    '--bg-app': '#111111'
  },
  overrideCss: '.b { color: blue; }',
  visualizer: { background: '#111111' },
  instruments: [
    {
      id: 'extra-bell',
      name: 'Extra Bell',
      type: 'synth',
      synth: { waveform: 'triangle', attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.3 }
    }
  ]
}

describe('mergeResourcePacks', () => {
  it('layers packs in priority order, overriding tokens and adding instruments', () => {
    const merged = mergeResourcePacks([basePack, overlayPack], ['base', 'overlay'])

    expect(merged.activePackIds).toEqual(['base', 'overlay'])
    expect(merged.tokens['--bg-app']).toBe('#111111')
    expect(merged.tokens['--accent-primary']).toBe('#336699')
    expect(merged.visualizer.background).toBe('#111111')
    expect(merged.visualizer.waveColor).toBe('#336699')
    expect(merged.instruments.map((i) => i.id)).toEqual(['soft-sine', 'extra-bell'])
    expect(merged.overrideCss).toContain('.a { color: red; }')
    expect(merged.overrideCss).toContain('.b { color: blue; }')
  })

  it('falls back to first available pack when activePackIds is empty', () => {
    const merged = mergeResourcePacks([basePack, overlayPack], [])
    expect(merged.activePackIds).toEqual(['base'])
  })
})
