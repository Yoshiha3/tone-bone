import { DRUM_LANES, PPQN, TICKS_PER_BAR, type Note } from '@core/types'

export const KEY_COL_WIDTH = 72
export const RULER_HEIGHT = 26
export const SYNTH_MIN_PITCH = 36 // C2
export const SYNTH_MAX_PITCH = 84 // C6
export const SYNTH_ROW_HEIGHT = 22
export const DRUM_ROW_HEIGHT = 38
export const CREATE_DRAG_THRESHOLD_PX = 8

export interface PianoRollMetrics {
  isDrum: boolean
  minPitch: number
  maxPitch: number
  rowCount: number
  rowHeight: number
  pxPerTick: number
  totalTicks: number
  contentWidth: number
  contentHeight: number
}

export interface VisibleBounds {
  startTick: number
  endTick: number
  minPitch: number
  maxPitch: number
}

export interface NoteHitResult {
  note: Note
  isRightEdge: boolean
}

export function createPianoRollMetrics(
  isDrum: boolean,
  bars: number,
  pxPerBeat: number
): PianoRollMetrics {
  const minPitch = isDrum ? 0 : SYNTH_MIN_PITCH
  const maxPitch = isDrum ? DRUM_LANES.length - 1 : SYNTH_MAX_PITCH
  const rowCount = maxPitch - minPitch + 1
  const rowHeight = isDrum ? DRUM_ROW_HEIGHT : SYNTH_ROW_HEIGHT
  const pxPerTick = pxPerBeat / PPQN
  const totalTicks = bars * TICKS_PER_BAR

  return {
    isDrum,
    minPitch,
    maxPitch,
    rowCount,
    rowHeight,
    pxPerTick,
    totalTicks,
    contentWidth: Math.ceil(KEY_COL_WIDTH + totalTicks * pxPerTick + 32),
    contentHeight: RULER_HEIGHT + rowCount * rowHeight
  }
}

export function pitchToContentY(pitch: number, metrics: PianoRollMetrics): number {
  return RULER_HEIGHT + (metrics.maxPitch - pitch) * metrics.rowHeight
}

export function contentYToPitch(contentY: number, metrics: PianoRollMetrics): number {
  const row = Math.floor((contentY - RULER_HEIGHT) / metrics.rowHeight)
  return Math.max(metrics.minPitch, Math.min(metrics.maxPitch, metrics.maxPitch - row))
}

export function contentXToTick(contentX: number, metrics: PianoRollMetrics): number {
  return Math.max(0, Math.min(metrics.totalTicks, (contentX - KEY_COL_WIDTH) / metrics.pxPerTick))
}

export function computeVisibleBounds(
  metrics: PianoRollMetrics,
  scrollLeft: number,
  scrollTop: number,
  viewWidth: number,
  viewHeight: number
): VisibleBounds {
  const startTick = Math.max(0, scrollLeft / metrics.pxPerTick)
  const endTick = Math.min(
    metrics.totalTicks,
    (scrollLeft + Math.max(0, viewWidth - KEY_COL_WIDTH)) / metrics.pxPerTick + 1
  )
  const maxPitch = Math.min(
    metrics.maxPitch,
    metrics.maxPitch - Math.floor(Math.max(0, scrollTop - RULER_HEIGHT) / metrics.rowHeight) + 1
  )
  const minPitch = Math.max(
    metrics.minPitch,
    metrics.maxPitch - Math.ceil((scrollTop + viewHeight) / metrics.rowHeight) - 1
  )
  return { startTick, endTick, minPitch, maxPitch }
}

export function hitTestNote(
  notes: readonly Note[],
  contentX: number,
  contentY: number,
  metrics: PianoRollMetrics
): NoteHitResult | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i]
    const nx = KEY_COL_WIDTH + note.startTick * metrics.pxPerTick
    const nw = Math.max(10, note.durationTick * metrics.pxPerTick)
    const ny = pitchToContentY(note.pitch, metrics) + 2
    const nh = metrics.rowHeight - 4
    if (contentX >= nx && contentX <= nx + nw && contentY >= ny && contentY <= ny + nh) {
      return { note, isRightEdge: contentX >= nx + nw - 8 && nw >= 14 }
    }
  }
  return null
}
