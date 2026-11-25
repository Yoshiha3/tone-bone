import { describe, expect, it } from 'vitest'
import { TRACK_TYPE_SPECS } from '@core/trackTypes'
import type { Note } from '@core/types'
import {
  clampPxPerBeat,
  computeAnchoredScrollLeft,
  computeEdgeAutoScrollDelta,
  computePinchZoomPxPerBeat,
  computeVisibleBounds,
  contentXToTick,
  contentYToPitch,
  createPianoRollMetrics,
  hitTestNote,
  KEY_COL_WIDTH,
  MAX_PX_PER_BEAT,
  MIN_PX_PER_BEAT,
  pitchToContentY,
  RULER_HEIGHT,
  SYNTH_MAX_PITCH,
  SYNTH_MIN_PITCH
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

  it('derives synth pitch range from TRACK_TYPE_SPECS (C1 to C7)', () => {
    expect(SYNTH_MIN_PITCH).toBe(TRACK_TYPE_SPECS.synth.minPitch)
    expect(SYNTH_MAX_PITCH).toBe(TRACK_TYPE_SPECS.synth.maxPitch)
    const metrics = createPianoRollMetrics(false, 4, 84)
    expect(metrics.minPitch).toBe(24)
    expect(metrics.maxPitch).toBe(96)
  })

  it('computes pinch zoom within bounds and keeps pointer tick anchored on scroll', () => {
    expect(clampPxPerBeat(10)).toBe(MIN_PX_PER_BEAT)
    expect(clampPxPerBeat(999)).toBe(MAX_PX_PER_BEAT)

    const zoomedIn = computePinchZoomPxPerBeat(84, -30)
    const zoomedOut = computePinchZoomPxPerBeat(84, 30)
    expect(zoomedIn).toBeGreaterThan(84)
    expect(zoomedOut).toBeLessThan(84)

    const anchorViewX = KEY_COL_WIDTH + 200
    const oldScrollLeft = 120
    const oldMetrics = createPianoRollMetrics(false, 8, 84)
    const newMetrics = createPianoRollMetrics(false, 8, 168)
    const tickBefore = contentXToTick(anchorViewX + oldScrollLeft, oldMetrics)
    const newScrollLeft = computeAnchoredScrollLeft({
      anchorViewX,
      currentScrollLeft: oldScrollLeft,
      oldPxPerBeat: 84,
      newPxPerBeat: 168
    })
    const tickAfter = contentXToTick(anchorViewX + newScrollLeft, newMetrics)
    expect(tickAfter).toBeCloseTo(tickBefore, 4)
  })

  it('computes edge auto-scroll deltas near or outside grid viewport edges', () => {
    expect(computeEdgeAutoScrollDelta(400, 300, 960, 600)).toEqual({ dx: 0, dy: 0 })

    const topLeft = computeEdgeAutoScrollDelta(KEY_COL_WIDTH - 10, RULER_HEIGHT - 10, 960, 600)
    expect(topLeft.dx).toBeLessThan(0)
    expect(topLeft.dy).toBeLessThan(0)

    const bottomRight = computeEdgeAutoScrollDelta(955, 595, 960, 600)
    expect(bottomRight.dx).toBeGreaterThan(0)
    expect(bottomRight.dy).toBeGreaterThan(0)
  })
})
