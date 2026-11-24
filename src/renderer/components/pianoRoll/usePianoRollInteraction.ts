import { useRef, type MouseEvent, type RefObject } from 'react'
import type { GridDivision, NoteLengthMode, Track } from '@core/types'
import { audioEngine } from '../../audioContext'
import { projectStore, useProjectStore } from '../../store/useProjectStore'
import type { PianoRollMetrics } from './pianoRollGeometry'
import {
  createInteractionSession,
  finishPianoRollDrag,
  handlePianoRollPointerDown,
  handlePianoRollPointerMove,
  type InteractionEnv,
  type InteractionSession,
  type PianoRollToolMode,
  type PointerCoords
} from './pianoRollInteraction'

interface UsePianoRollInteractionParams {
  scrollRef: RefObject<HTMLDivElement | null>
  track: Track | undefined
  metrics: PianoRollMetrics
  gridDivision: GridDivision
  toolMode: PianoRollToolMode
  selectedNoteIds: readonly string[]
  noteLengthMode: NoteLengthMode
  lastNoteDurationTick: number
}

export function usePianoRollInteraction({
  scrollRef,
  track,
  metrics,
  gridDivision,
  toolMode,
  selectedNoteIds,
  noteLengthMode,
  lastNoteDurationTick
}: UsePianoRollInteractionParams) {
  const setLastNoteDurationTick = useProjectStore((s) => s.setLastNoteDurationTick)
  const setSelectedNoteIds = useProjectStore((s) => s.setSelectedNoteIds)
  const addNote = useProjectStore((s) => s.addNote)
  const updateNote = useProjectStore((s) => s.updateNote)
  const deleteNote = useProjectStore((s) => s.deleteNote)

  const sessionRef = useRef<InteractionSession>(createInteractionSession())

  const getPointerCoords = (e: MouseEvent<HTMLCanvasElement>): PointerCoords => {
    const rect = e.currentTarget.getBoundingClientRect()
    const viewX = e.clientX - rect.left
    const viewY = e.clientY - rect.top
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0
    const scrollTop = scrollRef.current?.scrollTop ?? 0
    return {
      viewX,
      viewY,
      contentX: viewX + scrollLeft,
      contentY: viewY + scrollTop
    }
  }

  const buildEnv = (activeTrack: Track): InteractionEnv => ({
    track: activeTrack,
    metrics,
    gridDivision,
    toolMode,
    selectedNoteIds,
    noteLengthMode,
    lastNoteDurationTick,
    addNote,
    updateNote,
    deleteNote,
    setSelectedNoteIds,
    setLastNoteDurationTick,
    commitTrackNotes: (trackId, notes) => {
      const state = projectStore.getState()
      state.commitProjectSnapshot({
        ...state.project,
        tracks: state.project.tracks.map((t) => (t.id === trackId ? { ...t, notes } : t))
      })
    },
    getLatestTrackNotes: (trackId) =>
      projectStore.getState().project.tracks.find((t) => t.id === trackId)?.notes ?? null,
    seek: (tick) => audioEngine.seek(tick),
    previewNote: (targetTrack, pitch, durationSeconds) =>
      audioEngine.previewNote(targetTrack, pitch, durationSeconds)
  })

  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    handlePianoRollPointerDown(
      sessionRef.current,
      getPointerCoords(e),
      { button: e.button, shiftKey: e.shiftKey },
      buildEnv(track)
    )
  }

  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    handlePianoRollPointerMove(sessionRef.current, getPointerCoords(e), buildEnv(track))
  }

  const finishDrag = (): void => {
    if (!track) return
    finishPianoRollDrag(sessionRef.current, buildEnv(track))
  }

  return {
    sessionRef,
    onMouseDown,
    onMouseMove,
    onMouseUp: finishDrag,
    onMouseLeave: finishDrag
  }
}
