import {
  findNotesInRect,
  floorTickToGrid,
  getGridTickStep,
  moveNotes,
  snapTick
} from '@core/musicMath'
import { getTrackTypeSpec } from '@core/trackTypes'
import type { GridDivision, Note, NoteInputMode, NoteLengthMode, Track } from '@core/types'
import {
  contentXToTick,
  contentYToPitch,
  CREATE_DRAG_THRESHOLD_PX,
  hitTestNote,
  KEY_COL_WIDTH,
  RULER_HEIGHT,
  type PianoRollMetrics
} from './pianoRollGeometry'
import type { MarqueeRect } from './pianoRollRenderer'

export const PIANO_ROLL_TOOLS = [
  { id: 'draw', label: '入力', testId: 'tool-draw-btn' },
  { id: 'select', label: '範囲選択', testId: 'tool-select-btn' }
] as const

export type PianoRollToolMode = (typeof PIANO_ROLL_TOOLS)[number]['id']

export type DragState =
  | { kind: 'none' }
  | {
      kind: 'create'
      noteId: string
      anchorTick: number
      pitch: number
      startX: number
      hasDragged: boolean
    }
  | { kind: 'resize'; noteId: string; origStart: number }
  | {
      kind: 'move'
      startX: number
      startY: number
      origNotes: Note[]
      selectedSet: Set<string>
      anchorNoteId: string
      lastPreviewPitch: number
      lastDeltaTick: number
      lastDeltaPitch: number
    }
  | { kind: 'marquee'; startX: number; startY: number; curX: number; curY: number }

export interface PointerCoords {
  viewX: number
  viewY: number
  contentX: number
  contentY: number
}

export interface InteractionSession {
  drag: DragState
  previewNotes: Note[] | null
  marquee: MarqueeRect | null
}

export interface InteractionEnv {
  track: Track
  metrics: PianoRollMetrics
  gridDivision: GridDivision
  toolMode: PianoRollToolMode
  selectedNoteIds: readonly string[]
  noteLengthMode: NoteLengthMode
  noteInputMode: NoteInputMode
  lastNoteDurationTick: number
  addNote: (trackId: string, note: Omit<Note, 'id'>) => Note
  updateNote: (trackId: string, noteId: string, patch: Partial<Omit<Note, 'id'>>) => void
  deleteNote: (trackId: string, noteId: string) => void
  setSelectedNoteIds: (noteIds: string[]) => void
  setLastNoteDurationTick: (ticks: number) => void
  commitTrackNotes: (trackId: string, notes: Note[]) => void
  getLatestTrackNotes: (trackId: string) => readonly Note[] | null
  seek: (tick: number) => void
  previewNote: (track: Track, pitch: number, durationSeconds?: number) => void
}

export function createInteractionSession(): InteractionSession {
  return {
    drag: { kind: 'none' },
    previewNotes: null,
    marquee: null
  }
}

function createNoteAt(
  session: InteractionSession,
  contentX: number,
  contentY: number,
  env: InteractionEnv
): void {
  const { track, metrics, gridDivision } = env
  const trackSpec = getTrackTypeSpec(track.type)
  const step = getGridTickStep(gridDivision)
  const startTick = Math.min(
    metrics.totalTicks - step,
    floorTickToGrid(contentXToTick(contentX, metrics), gridDivision)
  )
  const pitch = contentYToPitch(contentY, metrics)
  const preferredDuration =
    trackSpec.remembersLastNoteDuration && env.noteLengthMode === 'last-used'
      ? env.lastNoteDurationTick
      : step
  const durationTick = Math.max(30, Math.min(metrics.totalTicks - startTick, preferredDuration))
  const created = env.addNote(track.id, { pitch, startTick, durationTick, velocity: 0.8 })
  env.setSelectedNoteIds([created.id])
  env.previewNote(track, pitch, 0.18)

  if (trackSpec.supportsNoteResize) {
    session.drag = {
      kind: 'create',
      noteId: created.id,
      anchorTick: startTick,
      pitch,
      startX: contentX,
      hasDragged: false
    }
  }
}

export function handlePianoRollKeyDrawStart(
  session: InteractionSession,
  coords: PointerCoords,
  env: InteractionEnv
): boolean {
  if (env.noteInputMode !== 'key' || env.toolMode !== 'draw') return false
  if (session.drag.kind !== 'none') return false
  if (coords.viewX < KEY_COL_WIDTH || coords.viewY < RULER_HEIGHT) return false
  if (hitTestNote(env.track.notes, coords.contentX, coords.contentY, env.metrics)) return false

  createNoteAt(session, coords.contentX, coords.contentY, env)
  return true
}

export function handlePianoRollPointerDown(
  session: InteractionSession,
  coords: PointerCoords,
  input: { button: number; shiftKey: boolean },
  env: InteractionEnv
): void {
  const { viewX, viewY, contentX, contentY } = coords
  const { track, metrics, gridDivision } = env
  const trackSpec = getTrackTypeSpec(track.type)

  if (viewY < RULER_HEIGHT && viewX >= KEY_COL_WIDTH) {
    env.seek(floorTickToGrid(contentXToTick(contentX, metrics), gridDivision))
    return
  }
  if (viewX < KEY_COL_WIDTH && viewY >= RULER_HEIGHT) {
    env.previewNote(track, contentYToPitch(contentY, metrics))
    return
  }
  if (viewY < RULER_HEIGHT) return

  const hit = hitTestNote(track.notes, contentX, contentY, metrics)

  if (input.button === 2) {
    if (hit) env.deleteNote(track.id, hit.note.id)
    return
  }
  if (input.button !== 0) return

  if (hit) {
    const isAlreadySelected = env.selectedNoteIds.includes(hit.note.id)
    let nextSelected: string[] = [...env.selectedNoteIds]
    if (input.shiftKey) {
      nextSelected = isAlreadySelected
        ? env.selectedNoteIds.filter((id) => id !== hit.note.id)
        : [...env.selectedNoteIds, hit.note.id]
    } else if (!isAlreadySelected) {
      nextSelected = [hit.note.id]
    }
    env.setSelectedNoteIds(nextSelected)
    if (trackSpec.remembersLastNoteDuration) {
      env.setLastNoteDurationTick(hit.note.durationTick)
    }

    if (hit.isRightEdge && trackSpec.supportsNoteResize) {
      session.drag = { kind: 'resize', noteId: hit.note.id, origStart: hit.note.startTick }
    } else {
      session.drag = {
        kind: 'move',
        startX: contentX,
        startY: contentY,
        origNotes: track.notes.map((n) => ({ ...n })),
        selectedSet: new Set(nextSelected),
        anchorNoteId: hit.note.id,
        lastPreviewPitch: hit.note.pitch,
        lastDeltaTick: 0,
        lastDeltaPitch: 0
      }
      session.previewNotes = track.notes.map((n) => ({ ...n }))
    }
    env.previewNote(track, hit.note.pitch, 0.14)
    return
  }

  if (env.toolMode === 'select' || input.shiftKey) {
    if (!input.shiftKey) env.setSelectedNoteIds([])
    session.drag = {
      kind: 'marquee',
      startX: contentX,
      startY: contentY,
      curX: contentX,
      curY: contentY
    }
    session.marquee = { x1: contentX, y1: contentY, x2: contentX, y2: contentY }
    return
  }

  if (env.noteInputMode !== 'click') return

  createNoteAt(session, contentX, contentY, env)
}

export function handlePianoRollPointerMove(
  session: InteractionSession,
  coords: Pick<PointerCoords, 'contentX' | 'contentY'>,
  env: InteractionEnv
): void {
  const { drag } = session
  if (drag.kind === 'none') return

  const { contentX, contentY } = coords
  const { track, metrics, gridDivision } = env
  const step = getGridTickStep(gridDivision)

  if (drag.kind === 'create' || drag.kind === 'resize') {
    if (drag.kind === 'create' && !drag.hasDragged) {
      const curGridTick = floorTickToGrid(contentXToTick(contentX, metrics), gridDivision)
      const movedRightEnough = contentX - drag.startX >= CREATE_DRAG_THRESHOLD_PX
      if (!movedRightEnough || curGridTick <= drag.anchorTick) return
      drag.hasDragged = true
    }

    const anchor = drag.kind === 'create' ? drag.anchorTick : drag.origStart
    const endTick = Math.max(
      anchor + step,
      snapTick(contentXToTick(contentX, metrics), gridDivision)
    )
    const clampedDuration = Math.max(step, Math.min(metrics.totalTicks - anchor, endTick - anchor))
    const latestNotes = env.getLatestTrackNotes(track.id)
    if (latestNotes) {
      session.previewNotes = latestNotes.map((n) =>
        n.id === drag.noteId ? { ...n, durationTick: clampedDuration } : n
      )
    }
    return
  }

  if (drag.kind === 'move') {
    const deltaTick = Math.round((contentX - drag.startX) / metrics.pxPerTick / step) * step
    const deltaPitch = -Math.round((contentY - drag.startY) / metrics.rowHeight)
    if (deltaTick !== drag.lastDeltaTick || deltaPitch !== drag.lastDeltaPitch) {
      drag.lastDeltaTick = deltaTick
      drag.lastDeltaPitch = deltaPitch
      session.previewNotes = moveNotes(
        drag.origNotes,
        drag.selectedSet,
        deltaTick,
        deltaPitch,
        metrics.minPitch,
        metrics.maxPitch,
        metrics.totalTicks
      )
      const movedAnchor = session.previewNotes.find((n) => n.id === drag.anchorNoteId)
      if (movedAnchor && movedAnchor.pitch !== drag.lastPreviewPitch) {
        drag.lastPreviewPitch = movedAnchor.pitch
        env.previewNote(track, movedAnchor.pitch, 0.14)
      }
    }
    return
  }

  if (drag.kind === 'marquee') {
    const clampedX = Math.max(KEY_COL_WIDTH, Math.min(metrics.contentWidth, contentX))
    const clampedY = Math.max(RULER_HEIGHT, Math.min(metrics.contentHeight, contentY))
    drag.curX = clampedX
    drag.curY = clampedY
    session.marquee = { x1: drag.startX, y1: drag.startY, x2: clampedX, y2: clampedY }
  }
}

export function finishPianoRollDrag(session: InteractionSession, env: InteractionEnv): void {
  const { drag } = session
  if (drag.kind === 'none') return

  const { track, metrics } = env

  if (
    ((drag.kind === 'create' && drag.hasDragged) || drag.kind === 'resize') &&
    session.previewNotes
  ) {
    const target = session.previewNotes.find((n) => n.id === drag.noteId)
    if (target) env.updateNote(track.id, drag.noteId, { durationTick: target.durationTick })
  } else if (
    drag.kind === 'move' &&
    session.previewNotes &&
    (drag.lastDeltaTick !== 0 || drag.lastDeltaPitch !== 0)
  ) {
    env.commitTrackNotes(track.id, session.previewNotes)
  } else if (drag.kind === 'marquee') {
    const found = findNotesInRect(track.notes, {
      minTick: contentXToTick(Math.min(drag.startX, drag.curX), metrics),
      maxTick: contentXToTick(Math.max(drag.startX, drag.curX), metrics),
      minPitch: contentYToPitch(Math.max(drag.startY, drag.curY), metrics),
      maxPitch: contentYToPitch(Math.min(drag.startY, drag.curY), metrics)
    })
    env.setSelectedNoteIds(found)
  }

  session.drag = { kind: 'none' }
  session.previewNotes = null
  session.marquee = null
}
