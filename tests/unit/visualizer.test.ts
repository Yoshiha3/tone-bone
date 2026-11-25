import { describe, expect, it, vi } from 'vitest'
import { createDemoProject } from '@core/demoProject'
import { TRACK_TYPE_SPECS } from '@core/trackTypes'
import { DRUM_LANES } from '@core/types'
import { FALLBACK_VISUALIZER_PRESET } from '@packs/packMerger'
import { drawRoundedRect, pitchToVisualYRatio } from '@visualizers/canvasUtils'
import { MinimalFlowRenderer } from '@visualizers/MinimalFlowRenderer'
import { createDefaultVisualizerRegistry, VisualizerRegistry } from '@visualizers/VisualizerRegistry'
import type { VisualizerRenderer } from '@visualizers/types'

function createMockCanvas2DContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn()
  } as unknown as CanvasRenderingContext2D & {
    fillRect: ReturnType<typeof vi.fn>
    arcTo: ReturnType<typeof vi.fn>
    arc: ReturnType<typeof vi.fn>
    fill: ReturnType<typeof vi.fn>
    stroke: ReturnType<typeof vi.fn>
  }
}

describe('VisualizerRegistry', () => {
  it('registers minimal-flow by default and falls back to default for unknown ids', () => {
    const registry = createDefaultVisualizerRegistry()
    expect(registry.list().map((r) => r.id)).toEqual(['minimal-flow'])
    expect(registry.get('minimal-flow').id).toBe('minimal-flow')
    expect(registry.get('non-existent').id).toBe('minimal-flow')
  })

  it('supports registering custom renderers, replacing default, and throwing when empty', () => {
    const empty = new VisualizerRegistry()
    expect(() => empty.get('anything')).toThrow()

    const custom: VisualizerRenderer = {
      id: 'custom-neon',
      name: 'Custom Neon',
      render: vi.fn()
    }
    empty.register(custom, true)
    expect(empty.get('custom-neon')).toBe(custom)
    expect(empty.get('fallback')).toBe(custom)
  })
})

describe('canvasUtils', () => {
  it('maps synth and drum pitches monotonically and clamps out-of-range synth pitches', () => {
    const { minPitch, maxPitch } = TRACK_TYPE_SPECS.synth
    const lowSynth = pitchToVisualYRatio(minPitch, false)
    const midSynth = pitchToVisualYRatio(60, false)
    const highSynth = pitchToVisualYRatio(maxPitch, false)
    expect(highSynth).toBeLessThan(midSynth)
    expect(midSynth).toBeLessThan(lowSynth)

    // Out-of-range pitches clamp to range boundaries
    expect(pitchToVisualYRatio(0, false)).toBe(lowSynth)
    expect(pitchToVisualYRatio(127, false)).toBe(highSynth)

    // Drum lanes go upward as lane pitch increases
    const lane0 = pitchToVisualYRatio(0, true)
    const lastLane = pitchToVisualYRatio(DRUM_LANES.length - 1, true)
    expect(lastLane).toBeLessThan(lane0)
  })

  it('clamps corner radius in drawRoundedRect to half of min(width, height)', () => {
    const ctx = createMockCanvas2DContext()
    drawRoundedRect(ctx, 10, 20, 40, 10, 99)
    expect(ctx.arcTo).toHaveBeenCalledTimes(4)
    expect(ctx.arcTo).toHaveBeenNthCalledWith(1, 50, 20, 50, 30, 5)
    expect(ctx.closePath).toHaveBeenCalledTimes(1)
  })
})

describe('MinimalFlowRenderer', () => {
  it('renders background, audible notes, active rings, live ripples, and waveform', () => {
    const renderer = new MinimalFlowRenderer()
    const ctx = createMockCanvas2DContext()
    const project = createDemoProject()
    // Mute one track to ensure getAudibleTrackIds filtering is respected
    project.tracks[1].muted = true

    const waveform = new Uint8Array(new ArrayBuffer(64))
    waveform.fill(140)

    renderer.render(
      ctx,
      {
        width: 800,
        height: 450,
        nowMs: 1000,
        currentTick: 0,
        isPlaying: true,
        project,
        trackColors: ['#4f8cff', '#ff6b6b'],
        waveform,
        ripples: [
          // Active ripple (age < 1)
          { xRatio: 0.28, yRatio: 0.5, color: '#4f8cff', createdAtMs: 800, strength: 1 },
          // Expired ripple (age >= 1) should be skipped
          { xRatio: 0.28, yRatio: 0.5, color: '#ff0000', createdAtMs: 100, strength: 1 }
        ]
      },
      { ...FALLBACK_VISUALIZER_PRESET, showWaveform: true }
    )

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 450)
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('renders cleanly with loop disabled and waveform hidden', () => {
    const renderer = new MinimalFlowRenderer()
    const ctx = createMockCanvas2DContext()
    const project = createDemoProject()
    project.loopEnabled = false

    renderer.render(
      ctx,
      {
        width: 640,
        height: 360,
        nowMs: 500,
        currentTick: 480,
        isPlaying: false,
        project,
        trackColors: ['#4f8cff'],
        waveform: new Uint8Array(new ArrayBuffer(0)),
        ripples: []
      },
      { ...FALLBACK_VISUALIZER_PRESET, showWaveform: false }
    )

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 360)
  })
})
