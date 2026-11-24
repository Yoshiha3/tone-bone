import { describe, expect, it } from 'vitest'
import { createDemoProject, createEmptyProject } from '@core/demoProject'
import { TICKS_PER_BAR } from '@core/types'

describe('demoProject factories', () => {
  it('creates an empty project with default synth + drum tracks and no notes', () => {
    const p1 = createEmptyProject()
    const p2 = createEmptyProject()

    expect(p1.title).toBe('Untitled')
    expect(p1.bpm).toBe(120)
    expect(p1.bars).toBe(4)
    expect(p1.tracks).toHaveLength(2)
    expect(p1.tracks.map((t) => t.type)).toEqual(['synth', 'drum'])
    expect(p1.tracks.every((t) => t.notes.length === 0)).toBe(true)

    // Instances are independent
    p1.tracks[0].name = 'Modified'
    expect(p2.tracks[0].name).not.toBe('Modified')
  })

  it('creates a valid demo project with all notes strictly within project bounds', () => {
    const demo = createDemoProject()
    const totalTicks = demo.bars * TICKS_PER_BAR

    expect(demo.tracks.length).toBeGreaterThanOrEqual(2)
    expect(demo.tracks.some((t) => t.notes.length > 0)).toBe(true)

    for (const track of demo.tracks) {
      for (const note of track.notes) {
        expect(note.startTick).toBeGreaterThanOrEqual(0)
        expect(note.startTick + note.durationTick).toBeLessThanOrEqual(totalTicks)
        expect(note.durationTick).toBeGreaterThan(0)
        expect(note.velocity).toBeGreaterThan(0)
        expect(note.velocity).toBeLessThanOrEqual(1)
      }
    }
  })
})
