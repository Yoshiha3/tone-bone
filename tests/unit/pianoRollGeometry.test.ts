import { describe, expect, it } from 'vitest'
import type { Note } from '@core/types'
import {
  computeVisibleBounds,
  contentXToTick,
  contentYToPitch,
  createPianoRollMetrics,
  hitTestNote,
  KEY_COL_WIDTH,
  pitchToContentY
} from '@renderer/components/pianoRoll/pianoRollGeometry'

describe('pianoRollGeometry', () => {
  it('converts pitch and ticks accurately for synth metrics', () => {
    const metrics = createPianoRollMetrics(false, 4, 80)
    const yC4 = pitchToContentY(60, metrics)
    expect(contentYToPitch(yC4 + 5, metrics)).toBe(60)
    expect(contentXToTick(KEY_COL_WIDTH + 80, metrics)).toBeCloseTo(480, 5)
    expect(contentXToTick(0, metrics)).toBe(0)
  })

  it('computes culled visible bounds inside a long 200-bar timeline', () => {
    const metrics = createPianoRollMetrics(false, 200, 80)
    // Scrolled to bar 50 (50 * 4 beats * 80px = 16000px)
    const bounds = computeVisibleBounds(metrics, 16000, 200, 1000, 600)
    expect(bounds.startTick).toBeGreaterThanOrEqual(50 * 1920 - 1)
    expect(bounds.endTick).toBeLessThan(55 * 1920)
    expect(bounds.minPitch).toBeGreaterThanOrEqual(metrics.minPitch)
    expect(bounds.maxPitch).toBeLessThanOrEqual(metrics.maxPitch)
  })

  it('detects note body vs right-edge resize zone accurately', () => {
    const metrics = createPianoRollMetrics(false, 4, 80)
    const notes: Note[] = [
      { id: 'n1', pitch: 60, startTick: 480, durationTick: 480, velocity: 0.8 }
    ]
    const ny = pitchToContentY(60, metrics) + 8
    const noteLeft = KEY_COL_WIDTH + 80
    const noteRight = KEY_COL_WIDTH + 160

    const hitBody = hitTestNote(notes, noteLeft + 20, ny, metrics)
    expect(hitBody?.note.id).toBe('n1')
    expect(hitBody?.isRightEdge).toBe(false)

    const hitEdge = hitTestNote(notes, noteRight - 3, ny, metrics)
    expect(hitEdge?.note.id).toBe('n1')
    expect(hitEdge?.isRightEdge).toBe(true)

    expect(hitTestNote(notes, noteLeft - 10, ny, metrics)).toBeNull()
  })
})
