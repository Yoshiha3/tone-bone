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
  let minAllowedTick = -Infinity
  let maxAllowedTick = Infinity
  let minAllowedPitch = -Infinity
  let maxAllowedPitch = Infinity
  let hasSelected = false

  for (const note of notes) {
    if (!selectedIds.has(note.id)) continue
    hasSelected = true
    minAllowedTick = Math.max(minAllowedTick, -note.startTick)
    maxAllowedTick = Math.min(maxAllowedTick, maxTotalTicks - note.durationTick - note.startTick)
    minAllowedPitch = Math.max(minAllowedPitch, minPitch - note.pitch)
    maxAllowedPitch = Math.min(maxAllowedPitch, maxPitch - note.pitch)
  }

  if (!hasSelected) return [...notes]

  const effectiveDeltaTick = clamp(
    deltaTick,
    minAllowedTick,
    Math.max(minAllowedTick, maxAllowedTick)
  )
  const effectiveDeltaPitch = clamp(
    deltaPitch,
    minAllowedPitch,
    Math.max(minAllowedPitch, maxAllowedPitch)
  )

  return notes.map((note) => {
    if (!selectedIds.has(note.id)) return note
    const nextStart = clamp(note.startTick + effectiveDeltaTick, 0, maxTotalTicks - note.durationTick)
    const nextPitch = clamp(note.pitch + effectiveDeltaPitch, minPitch, maxPitch)
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

export function getNotesEndTick(notes: readonly Note[]): number | null {
  if (notes.length === 0) return null
  let maxEnd = 0
  for (const note of notes) {
    maxEnd = Math.max(maxEnd, note.startTick + note.durationTick)
  }
  return maxEnd
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
