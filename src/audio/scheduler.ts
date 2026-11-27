import { getAudibleTrackIds } from '@core/musicMath'
import { TICKS_PER_BAR, type Note, type Project, type Track } from '@core/types'

export interface ScheduledNoteItem {
  track: Track
  note: Note
  /** Monotonic absolute tick on the playback timeline (never wraps backward) */
  absTick: number
}

/**
 * Pure lookahead window collector using monotonic absolute ticks.
 * Because `windowStartAbs` and `windowEndAbs` never wrap backward, every note
 * is guaranteed to be scheduled at most once per loop iteration, even right
 * across bar/loop boundaries.
 */
export function collectScheduledNotes(
  project: Project,
  windowStartAbs: number,
  windowEndAbs: number
): ScheduledNoteItem[] {
  const totalTicks = project.bars * TICKS_PER_BAR
  if (totalTicks <= 0 || windowEndAbs <= windowStartAbs) {
    return []
  }

  const effectiveEnd = project.loopEnabled ? windowEndAbs : Math.min(windowEndAbs, totalTicks)
  if (effectiveEnd <= windowStartAbs) {
    return []
  }

  const audibleIds = getAudibleTrackIds(project.tracks)
  const firstLoop = Math.max(0, Math.floor(windowStartAbs / totalTicks))
  const lastLoop = project.loopEnabled ? Math.floor((effectiveEnd - 1e-9) / totalTicks) : 0

  const results: ScheduledNoteItem[] = []

  for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex++) {
    const loopBaseTick = loopIndex * totalTicks
    for (const track of project.tracks) {
      if (!audibleIds.has(track.id) || track.volume <= 0.001) continue
      for (const note of track.notes) {
        if (note.startTick < 0 || note.startTick >= totalTicks) continue
        const absTick = loopBaseTick + note.startTick
        if (absTick >= windowStartAbs && absTick < effectiveEnd) {
          results.push({ track, note, absTick })
        }
      }
    }
  }

  return results
}
