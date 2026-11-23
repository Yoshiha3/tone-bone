import { describe, expect, it } from 'vitest'
import type { SoundPack, ThemePack } from '@core/types'
import { mergeSoundPacks, mergeThemePacks } from '@packs/packMerger'

const lightTheme: ThemePack = {
  meta: {
    id: 'minimal-light',
    name: 'Minimal Light',
    version: '1.0.0',
    author: 'Test',
    description: 'Light theme'
  },
  source: 'builtin',
  path: '/themes/minimal-light',
  tokens: {
    '--bg-app': '#ffffff',
    '--accent-primary': '#336699'
  },
  overrideCss: '.a { color: red; }',
  visualizer: { background: '#ffffff', waveColor: '#336699' }
}

const darkTheme: ThemePack = {
  meta: {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    version: '1.0.0',
    author: 'Test',
    description: 'Dark theme'
  },
  source: 'builtin',
  path: '/themes/minimal-dark',
  tokens: {
    '--bg-app': '#111111'
  },
  overrideCss: '.b { color: blue; }',
  visualizer: { background: '#111111' }
}

const defaultSounds: SoundPack = {
  meta: {
    id: 'default-sounds',
    name: 'Default Electronic Kit',
    version: '1.0.0',
    author: 'Test',
    description: 'Built-in sounds'
  },
  source: 'builtin',
  path: '/sounds/default-sounds',
  instruments: [
    {
      id: 'soft-sine',
      name: 'Soft Sine',
      type: 'synth',
      synth: { waveform: 'sine', attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 }
    },
    { id: 'basic-kit', name: 'Basic Rhythm Kit', type: 'drum' }
  ]
}

const extraSounds: SoundPack = {
  meta: {
    id: 'chiptune',
    name: 'Chiptune Pack',
    version: '1.0.0',
    author: 'User',
    description: 'Extra chiptune sounds'
  },
  source: 'user',
  path: '/sounds/chiptune',
  instruments: [
    {
      id: 'soft-sine',
      name: 'Retro Sine',
      type: 'synth',
      synth: { waveform: 'triangle', attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.1 }
    },
    {
      id: 'extra-bell',
      name: 'Extra Bell',
      type: 'synth',
      synth: { waveform: 'square', attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.3 }
    }
  ]
}

describe('mergeThemePacks & mergeSoundPacks', () => {
  it('layers theme packs in priority order and falls back when empty', () => {
    const merged = mergeThemePacks([lightTheme, darkTheme], ['minimal-light', 'minimal-dark'])
    expect(merged.activeThemePackIds).toEqual(['minimal-light', 'minimal-dark'])
    expect(merged.tokens['--bg-app']).toBe('#111111')
    expect(merged.tokens['--accent-primary']).toBe('#336699')
    expect(merged.visualizer.background).toBe('#111111')
    expect(merged.visualizer.waveColor).toBe('#336699')
    expect(merged.overrideCss).toContain('.a { color: red; }')
    expect(merged.overrideCss).toContain('.b { color: blue; }')

    const fallback = mergeThemePacks([lightTheme, darkTheme], [])
    expect(fallback.activeThemePackIds).toEqual(['minimal-light'])
  })

  it('always pins default-sounds as the lowest sound layer and overrides/adds instruments on top', () => {
    // Even if activeSoundPackIds omits default-sounds, it is pinned at index 0
    const merged = mergeSoundPacks([defaultSounds, extraSounds], ['chiptune'])
    expect(merged.activeSoundPackIds).toEqual(['default-sounds', 'chiptune'])
    expect(merged.instruments.map((i) => i.id)).toEqual(['soft-sine', 'basic-kit', 'extra-bell'])
    // chiptune overrides soft-sine while keeping basic-kit intact
    expect(merged.instruments.find((i) => i.id === 'soft-sine')?.name).toBe('Retro Sine')

    const emptyRequest = mergeSoundPacks([defaultSounds, extraSounds], [])
    expect(emptyRequest.activeSoundPackIds).toEqual(['default-sounds'])
    expect(emptyRequest.instruments.map((i) => i.id)).toEqual(['soft-sine', 'basic-kit'])
  })
})
