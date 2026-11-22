import {
  GRID_DIVISIONS,
  PPQN,
  TICKS_PER_BAR,
  type GridDivision,
  type Note,
  type Track
} from './types'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function getGridTickStep(division: GridDivision): number {
  const found = GRID_DIVISIONS.find((d) => d.value === division)
  if (!found) {
    throw new Error(`Unknown grid division: ${division}`)
  }
  return TICKS_PER_BAR / found.stepsPerBar
}

export function snapTick(tick: number, division: GridDivision): number {
  const step = getGridTickStep(division)
  return Math.max(0, Math.round(tick / step) * step)
}

export function floorTickToGrid(tick: number, division: GridDivision): number {
  const step = getGridTickStep(division)
  return Math.max(0, Math.floor(tick / step) * step)
}

export function ticksToSeconds(ticks: number, bpm: number): number {
  if (bpm <= 0) throw new Error('BPM must be positive')
  const beats = ticks / PPQN
  return (beats * 60) / bpm
}

export function secondsToTicks(seconds: number, bpm: number): number {
  if (bpm <= 0) throw new Error('BPM must be positive')
  const beats = (seconds * bpm) / 60
  return beats * PPQN
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10
}

export interface SelectionRect {
  minTick: number
  maxTick: number
  minPitch: number
  maxPitch: number
}

export function findNotesInRect(notes: readonly Note[], rect: SelectionRect): string[] {
  const minTick = Math.min(rect.minTick, rect.maxTick)
  const maxTick = Math.max(rect.minTick, rect.maxTick)
  const minPitch = Math.min(rect.minPitch, rect.maxPitch)
  const maxPitch = Math.max(rect.minPitch, rect.maxPitch)

  return notes
    .filter((n) => {
      const noteEnd = n.startTick + n.durationTick
      const tickOverlaps = noteEnd > minTick && n.startTick < maxTick
      const pitchInRange = n.pitch >= minPitch && n.pitch <= maxPitch
      return tickOverlaps && pitchInRange
    })
    .map((n) => n.id)
}

export function moveNotes(
  notes: readonly Note[],
  selectedIds: ReadonlySet<string>,
  deltaTick: number,
  deltaPitch: number,
  minPitch: number,
  maxPitch: number,
  maxTotalTicks: number
): Note[] {
  return notes.map((note) => {
    if (!selectedIds.has(note.id)) return note
    const nextStart = Math.max(
      0,
      Math.min(maxTotalTicks - note.durationTick, note.startTick + deltaTick)
    )
    const nextPitch = Math.max(minPitch, Math.min(maxPitch, note.pitch + deltaPitch))
    return {
      ...note,
      startTick: nextStart,
      pitch: nextPitch
    }
  })
}

export function cloneNotesForPaste(
  copiedNotes: readonly Note[],
  targetTick: number,
  maxTotalTicks: number,
  createId: () => string
): Note[] {
  if (copiedNotes.length === 0) return []
  const earliestTick = Math.min(...copiedNotes.map((n) => n.startTick))
  const offset = targetTick - earliestTick

  return copiedNotes
    .map((note) => ({
      ...note,
      id: createId(),
      startTick: Math.max(0, note.startTick + offset)
    }))
    .filter((note) => note.startTick < maxTotalTicks)
}

/**
 * Resolves which tracks should produce sound according to standard DAW Mute/Solo rules.
 * If any track has solo === true, only soloed (and non-muted) tracks are active.
 * Otherwise, all non-muted tracks are active.
 */
export function getAudibleTrackIds(tracks: readonly Track[]): Set<string> {
  const hasSolo = tracks.some((t) => t.solo)
  const audible = new Set<string>()
  for (const track of tracks) {
    if (hasSolo) {
      if (track.solo && !track.muted) {
        audible.add(track.id)
      }
    } else if (!track.muted) {
      audible.add(track.id)
    }
  }
  return audible
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
