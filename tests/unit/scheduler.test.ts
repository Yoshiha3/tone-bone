import { describe, expect, it } from 'vitest'
import { collectScheduledNotes } from '@audio/scheduler'
import { createDemoProject } from '@core/demoProject'
import { secondsToTicks } from '@core/musicMath'
import { TICKS_PER_BAR } from '@core/types'

describe('collectScheduledNotes (monotonic loop scheduler)', () => {
  it('schedules every note exactly once per loop across 3 full loops with zero burst at loop boundary', () => {
    const project = createDemoProject()
    const totalTicks = project.bars * TICKS_PER_BAR
    const totalNotesPerLoop = project.tracks.reduce((sum, t) => sum + t.notes.length, 0)

    const stepSec = 0.025 // 25ms scheduler interval
    const lookaheadSec = 0.12
    const loopDurationSec = (project.bars * 4 * 60) / project.bpm
    const simulateTotalSec = loopDurationSec * 3

    let scheduledUntilAbs = 0
    const countsByLoop = [
      new Map<string, number>(),
      new Map<string, number>(),
      new Map<string, number>()
    ]

    for (let t = 0; t < simulateTotalSec; t += stepSec) {
      const playheadAbs = secondsToTicks(t, project.bpm)
      const windowStartAbs = Math.max(scheduledUntilAbs, playheadAbs)
      const windowEndAbs = playheadAbs + secondsToTicks(lookaheadSec, project.bpm)

      const items = collectScheduledNotes(project, windowStartAbs, windowEndAbs)
      for (const item of items) {
        // Every scheduled note must be at or ahead of the current playhead
        expect(item.absTick).toBeGreaterThanOrEqual(playheadAbs - 1e-6)
        const loopIdx = Math.floor(item.absTick / totalTicks)
        if (loopIdx < 3) {
          const map = countsByLoop[loopIdx]
          map.set(item.note.id, (map.get(item.note.id) ?? 0) + 1)
        }
      }

      scheduledUntilAbs = windowEndAbs
    }

    // Verify each of the 3 loops fired every single note exactly ONCE
    for (let loopIdx = 0; loopIdx < 3; loopIdx++) {
      const map = countsByLoop[loopIdx]
      expect(map.size).toBe(totalNotesPerLoop)
      for (const [, count] of map) {
        expect(count).toBe(1)
      }
    }
  })

  it('stops scheduling after bar end when loopEnabled is false', () => {
    const project = { ...createDemoProject(), loopEnabled: false }
    const totalTicks = project.bars * TICKS_PER_BAR

    const afterEnd = collectScheduledNotes(project, totalTicks, totalTicks + 480)
    expect(afterEnd).toHaveLength(0)

    const straddling = collectScheduledNotes(project, totalTicks - 240, totalTicks + 240)
    for (const item of straddling) {
      expect(item.absTick).toBeLessThan(totalTicks)
    }
  })
})
