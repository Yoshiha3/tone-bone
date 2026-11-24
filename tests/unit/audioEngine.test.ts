import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from '@audio/AudioEngine'
import { WavExporter } from '@audio/exporters/WavExporter'
import { DrumVoice } from '@audio/voices/DrumVoice'
import { SynthVoice } from '@audio/voices/SynthVoice'
import { PPQN, TICKS_PER_BAR, type InstrumentDef, type Project } from '@core/types'

function createFakeAudioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  }
}

function createFakeAudioContext() {
  const oscillators: Array<{
    type: string
    frequency: ReturnType<typeof createFakeAudioParam>
    detune: ReturnType<typeof createFakeAudioParam>
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }> = []
  const bufferSources: Array<{
    buffer: unknown
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }> = []
  const filters: Array<{
    type: string
    frequency: ReturnType<typeof createFakeAudioParam>
    Q: ReturnType<typeof createFakeAudioParam>
    connect: ReturnType<typeof vi.fn>
  }> = []
  const gains: Array<{
    gain: ReturnType<typeof createFakeAudioParam>
    connect: ReturnType<typeof vi.fn>
  }> = []

  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    connect: vi.fn(),
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(150)),
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(80))
  }

  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    state: 'suspended' as AudioContextState,
    destination: { kind: 'destination' } as unknown as AudioDestinationNode,
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed'
    }),
    createGain: vi.fn(() => {
      const node = { gain: createFakeAudioParam(), connect: vi.fn() }
      gains.push(node)
      return node
    }),
    createAnalyser: vi.fn(() => analyser),
    createOscillator: vi.fn(() => {
      const node = {
        type: 'sine',
        frequency: createFakeAudioParam(),
        detune: createFakeAudioParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }
      oscillators.push(node)
      return node
    }),
    createBiquadFilter: vi.fn(() => {
      const node = {
        type: 'lowpass',
        frequency: createFakeAudioParam(),
        Q: createFakeAudioParam(),
        connect: vi.fn()
      }
      filters.push(node)
      return node
    }),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length))
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: (ch: number) => data[ch]
      }
    }),
    createBufferSource: vi.fn(() => {
      const node = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      bufferSources.push(node)
      return node
    }),
    _oscillators: oscillators,
    _bufferSources: bufferSources,
    _filters: filters,
    _gains: gains,
    _analyser: analyser
  }

  return ctx
}

function createSampleProject(loopEnabled = true): Project {
  return {
    title: 'Audio Test',
    bpm: 120,
    bars: 1,
    loopEnabled,
    tracks: [
      {
        id: 't-synth',
        name: 'Synth',
        type: 'synth',
        instrumentId: 'lead',
        colorIndex: 0,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: [
          { id: 'n1', pitch: 60, startTick: 0, durationTick: PPQN, velocity: 0.8 }
        ]
      },
      {
        id: 't-drum',
        name: 'Drum',
        type: 'drum',
        instrumentId: 'basic-kit',
        colorIndex: 1,
        volume: 0.9,
        muted: false,
        solo: false,
        notes: [
          { id: 'd1', pitch: 0, startTick: 0, durationTick: 120, velocity: 0.9 }
        ]
      }
    ]
  }
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'lead',
    name: 'Lead',
    type: 'synth',
    synth: {
      waveform: 'sawtooth',
      attack: 0.01,
      decay: 0.1,
      sustain: 0.6,
      release: 0.15,
      filterCutoff: 1800,
      detuneCents: 6,
      gainScale: 0.9
    }
  },
  { id: 'basic-kit', name: 'Basic Kit', type: 'drum' }
]

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('SynthVoice & DrumVoice', () => {
  it('triggers SynthVoice with default params, custom filter/detune, and short-note envelope branch', () => {
    const ctx = createFakeAudioContext()
    const voice = new SynthVoice()

    // Default params (no instrument provided)
    voice.trigger({
      context: ctx as unknown as BaseAudioContext,
      destination: ctx.destination,
      pitch: 69,
      startTime: 1.0,
      durationSeconds: 0.5,
      velocity: 0.8
    })
    expect(ctx._oscillators).toHaveLength(1)
    expect(ctx._oscillators[0].type).toBe('sine')
    expect(ctx._filters).toHaveLength(0)

    // Custom instrument with filterCutoff, detuneCents, and short duration (decayEnd >= noteOffTime)
    voice.trigger({
      context: ctx as unknown as BaseAudioContext,
      destination: ctx.destination,
      pitch: 60,
      startTime: 2.0,
      durationSeconds: 0.02,
      velocity: 0.7,
      instrument: INSTRUMENTS[0]
    })
    expect(ctx._oscillators).toHaveLength(2)
    expect(ctx._oscillators[1].type).toBe('sawtooth')
    expect(ctx._oscillators[1].detune.setValueAtTime).toHaveBeenCalledWith(6, 2.0)
    expect(ctx._filters).toHaveLength(1)
    expect(ctx._filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(1800, 2.0)
  })

  it('triggers all 8 drum lanes plus fallback and caches noise buffer per AudioContext', () => {
    const ctx = createFakeAudioContext()
    const drum = new DrumVoice()

    for (const pitch of [0, 1, 2, 3, 4, 5, 6, 7, 99]) {
      drum.trigger({
        context: ctx as unknown as BaseAudioContext,
        destination: ctx.destination,
        pitch,
        startTime: 0.5,
        durationSeconds: 0.1,
        velocity: 0.85
      })
    }

    // Noise buffer should be created only once and reused across snare/hihats/clap
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1)
    expect(ctx._oscillators.length).toBeGreaterThanOrEqual(6)
    expect(ctx._bufferSources.length).toBeGreaterThanOrEqual(6)
  })
})

describe('AudioEngine', () => {
  it('handles play, pause, stop, seek, waveform/frequency reads, note trigger events, and dispose', () => {
    vi.useFakeTimers()
    const ctx = createFakeAudioContext()
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => ctx)
    })

    const project = createSampleProject(true)
    const engine = new AudioEngine(
      () => project,
      () => INSTRUMENTS
    )

    // Before AudioContext is initialized, analyser reads return false
    const wave = new Uint8Array(new ArrayBuffer(16))
    const freq = new Uint8Array(new ArrayBuffer(16))
    expect(engine.getWaveformData(wave)).toBe(false)
    expect(engine.getFrequencyData(freq)).toBe(false)

    const triggered: string[] = []
    const unsubscribe = engine.onNoteTrigger((evt) => triggered.push(evt.note.id))

    engine.play()
    expect(engine.getIsPlaying()).toBe(true)
    expect(ctx.resume).toHaveBeenCalled()
    expect(triggered).toEqual(['n1', 'd1'])

    // Waveform and frequency now populate via AnalyserNode
    expect(engine.getWaveformData(wave)).toBe(true)
    expect(wave[0]).toBe(150)
    expect(engine.getFrequencyData(freq)).toBe(true)
    expect(freq[0]).toBe(80)

    // Advance time by 0.5s (1 beat = 480 ticks at 120 BPM)
    ctx.currentTime = 0.5
    expect(Math.round(engine.getCurrentTick())).toBe(PPQN)

    // Pause freezes playhead
    engine.pause()
    expect(engine.getIsPlaying()).toBe(false)
    ctx.currentTime = 2.0
    expect(Math.round(engine.getCurrentTick())).toBe(PPQN)

    // Seek clamps within [0, totalTicks]
    engine.seek(-100)
    expect(engine.getCurrentTick()).toBe(0)
    engine.seek(TICKS_PER_BAR + 500)
    // In loop mode totalTicks wraps to 0
    expect(engine.getCurrentTick()).toBe(0)

    // Preview synth & drum notes
    engine.previewNote(project.tracks[0], 64)
    engine.previewNote(project.tracks[1], 1)
    expect(ctx._oscillators.length).toBeGreaterThan(2)

    // Unsubscribe stops further notifications
    unsubscribe()
    engine.stop()
    expect(engine.getCurrentTick()).toBe(0)

    engine.dispose()
    expect(ctx.close).toHaveBeenCalledTimes(1)
    expect(engine.getWaveformData(wave)).toBe(false)
  })

  it('auto-stops at end of project when loopEnabled is false and restarts from 0 on next play', () => {
    vi.useFakeTimers()
    const ctx = createFakeAudioContext()
    vi.stubGlobal('window', {
      AudioContext: vi.fn(() => ctx)
    })

    const project = createSampleProject(false) // 1 bar at 120 BPM = 2.0 seconds
    const engine = new AudioEngine(
      () => project,
      () => INSTRUMENTS
    )

    engine.play()
    expect(engine.getIsPlaying()).toBe(true)

    // Move past 2.0s and fire scheduler interval
    ctx.currentTime = 2.5
    vi.advanceTimersByTime(30)
    expect(engine.getIsPlaying()).toBe(false)
    expect(engine.getCurrentTick()).toBe(0)

    // Seeking to end and pressing play resets to 0
    engine.seek(TICKS_PER_BAR)
    expect(engine.getCurrentTick()).toBe(TICKS_PER_BAR)
    engine.play()
    expect(engine.getCurrentTick()).toBe(0)
    engine.dispose()
  })
})

describe('WavExporter.export', () => {
  it('renders audible tracks via OfflineAudioContext and encodes valid WAV bytes', async () => {
    const fakeCtx = createFakeAudioContext()
    const renderedBuffer = {
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array([0.1, -0.1, 0.2, -0.2])
    }

    const OfflineAudioContextMock = vi.fn(() => ({
      ...fakeCtx,
      startRendering: vi.fn(async () => renderedBuffer)
    }))
    vi.stubGlobal('OfflineAudioContext', OfflineAudioContextMock)

    const project = createSampleProject(true)
    project.tracks[1].muted = true // muted track should be skipped

    const exporter = new WavExporter()
    const bytes = await exporter.export(project, INSTRUMENTS)

    expect(OfflineAudioContextMock).toHaveBeenCalledTimes(1)
    expect(fakeCtx._oscillators).toHaveLength(1) // only synth note rendered; muted drum skipped
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
  })
})
