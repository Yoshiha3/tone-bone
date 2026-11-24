import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from '@audio/AudioEngine'
import {
  AudioExporterRegistry,
  createDefaultAudioExporterRegistry
} from '@audio/AudioExporterRegistry'
import { WavExporter } from '@audio/exporters/WavExporter'
import type { AudioExporter, AudioVoice } from '@audio/types'
import { createDefaultVoiceRegistry, VoiceRegistry } from '@audio/VoiceRegistry'
import { PPQN, type Project } from '@core/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VoiceRegistry', () => {
  it('registers synth (default) and drum voices by default and supports custom replacement', () => {
    const registry = createDefaultVoiceRegistry()
    expect(registry.has('synth')).toBe(true)
    expect(registry.has('drum')).toBe(true)
    expect(registry.list().map((v) => v.type)).toEqual(['synth', 'drum'])
    expect(registry.get('synth').type).toBe('synth')
    expect(registry.get('drum').type).toBe('drum')

    const customSynth: AudioVoice = { type: 'synth', trigger: vi.fn() }
    registry.register(customSynth, true)
    expect(registry.get('synth')).toBe(customSynth)
  })

  it('throws when resolving from an empty VoiceRegistry', () => {
    const empty = new VoiceRegistry()
    expect(() => empty.get('synth')).toThrow()
  })

  it('routes both AudioEngine and WavExporter through an injected VoiceRegistry', async () => {
    const customSynth: AudioVoice = { type: 'synth', trigger: vi.fn() }
    const customDrum: AudioVoice = { type: 'drum', trigger: vi.fn() }
    const voiceRegistry = new VoiceRegistry()
    voiceRegistry.register(customSynth, true)
    voiceRegistry.register(customDrum)

    const project: Project = {
      title: 'DI Test',
      bpm: 120,
      bars: 1,
      loopEnabled: false,
      tracks: [
        {
          id: 't1',
          name: 'Synth',
          type: 'synth',
          instrumentId: 'soft-sine',
          colorIndex: 0,
          volume: 0.8,
          muted: false,
          solo: false,
          notes: [{ id: 'n1', pitch: 60, startTick: 0, durationTick: PPQN, velocity: 0.8 }]
        }
      ]
    }

    const fakeGain = { gain: { value: 0 }, connect: vi.fn() }
    const fakeAnalyser = { fftSize: 0, smoothingTimeConstant: 0, connect: vi.fn() }
    const fakeCtx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createGain: vi.fn(() => fakeGain),
      createAnalyser: vi.fn(() => fakeAnalyser),
      close: vi.fn()
    }
    vi.stubGlobal('window', { AudioContext: vi.fn(() => fakeCtx) })

    const engine = new AudioEngine(
      () => project,
      () => [],
      voiceRegistry
    )
    engine.previewNote(project.tracks[0], 64)
    expect(customSynth.trigger).toHaveBeenCalledTimes(1)
    engine.dispose()

    vi.stubGlobal(
      'OfflineAudioContext',
      vi.fn(() => ({
        destination: {},
        createGain: vi.fn(() => fakeGain),
        startRendering: vi.fn(async () => ({
          numberOfChannels: 2,
          sampleRate: 44100,
          getChannelData: () => new Float32Array([0, 0])
        }))
      }))
    )

    const exporter = new WavExporter(voiceRegistry)
    await exporter.export(project, [])
    expect(customSynth.trigger).toHaveBeenCalledTimes(2)
  })
})

describe('AudioExporterRegistry', () => {
  it('registers WavExporter as default and supports registering/selecting custom formats', () => {
    const registry = createDefaultAudioExporterRegistry()
    expect(registry.getDefault().id).toBe('wav-pcm16')
    expect(registry.getDefault().label).toBe('WAV Audio')
    expect(registry.getDefault().extension).toBe('wav')
    expect(registry.get('unknown-id').id).toBe('wav-pcm16')
    expect(registry.getById('unknown-id')).toBeUndefined()

    const mp3Exporter: AudioExporter = {
      id: 'mp3',
      label: 'MP3 Audio',
      extension: 'mp3',
      export: vi.fn(async () => new Uint8Array([1, 2, 3]))
    }
    registry.register(mp3Exporter, true)
    expect(registry.list().map((e) => e.id)).toEqual(['wav-pcm16', 'mp3'])
    expect(registry.getDefault()).toBe(mp3Exporter)
    expect(registry.get('mp3')).toBe(mp3Exporter)
    expect(registry.get('wav-pcm16').id).toBe('wav-pcm16')
  })

  it('throws when empty AudioExporterRegistry has no default exporter', () => {
    const empty = new AudioExporterRegistry()
    expect(() => empty.getDefault()).toThrow()
    expect(() => empty.get('wav-pcm16')).toThrow()
  })
})
