import { useCallback, useEffect, useRef, type MouseEvent, type RefObject } from 'react'
import type { GridDivision, NoteInputMode, NoteLengthMode, Track } from '@core/types'
import { audioEngine } from '../../audioContext'
import { projectStore, useProjectStore } from '../../store/useProjectStore'
import { computeEdgeAutoScrollDelta, type PianoRollMetrics } from './pianoRollGeometry'
import {
  createInteractionSession,
  finishPianoRollDrag,
  handlePianoRollKeyDrawStart,
  handlePianoRollPointerDown,
  handlePianoRollPointerMove,
  type InteractionEnv,
  type InteractionSession,
  type PianoRollToolMode,
  type PointerCoords
} from './pianoRollInteraction'

interface UsePianoRollInteractionParams {
  scrollRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  track: Track | undefined
  metrics: PianoRollMetrics
  gridDivision: GridDivision
  toolMode: PianoRollToolMode
  selectedNoteIds: readonly string[]
  noteLengthMode: NoteLengthMode
  noteInputMode: NoteInputMode
  noteDrawKey: string
  lastNoteDurationTick: number
}

type DragEndTrigger = { kind: 'pointer' } | { kind: 'key'; code: string }

export function usePianoRollInteraction({
  scrollRef,
  canvasRef,
  track,
  metrics,
  gridDivision,
  toolMode,
  selectedNoteIds,
  noteLengthMode,
  noteInputMode,
  noteDrawKey,
  lastNoteDurationTick
}: UsePianoRollInteractionParams) {
  const setLastNoteDurationTick = useProjectStore((s) => s.setLastNoteDurationTick)
  const setSelectedNoteIds = useProjectStore((s) => s.setSelectedNoteIds)
  const addNote = useProjectStore((s) => s.addNote)
  const updateNote = useProjectStore((s) => s.updateNote)
  const deleteNote = useProjectStore((s) => s.deleteNote)

  const sessionRef = useRef<InteractionSession>(createInteractionSession())
  const isDraggingRef = useRef(false)
  const pointerClientRef = useRef<{ x: number; y: number } | null>(null)
  const hoverClientRef = useRef<{ x: number; y: number } | null>(null)
  const autoScrollRafRef = useRef<number | null>(null)
  const cleanupDragListenersRef = useRef<(() => void) | null>(null)

  const latestRef = useRef({
    track,
    metrics,
    gridDivision,
    toolMode,
    selectedNoteIds,
    noteLengthMode,
    noteInputMode,
    noteDrawKey,
    lastNoteDurationTick,
    addNote,
    updateNote,
    deleteNote,
    setSelectedNoteIds,
    setLastNoteDurationTick
  })
  latestRef.current = {
    track,
    metrics,
    gridDivision,
    toolMode,
    selectedNoteIds,
    noteLengthMode,
    noteInputMode,
    noteDrawKey,
    lastNoteDurationTick,
    addNote,
    updateNote,
    deleteNote,
    setSelectedNoteIds,
    setLastNoteDurationTick
  }

  const getCoordsFromClient = useCallback(
    (clientX: number, clientY: number): PointerCoords | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const viewX = clientX - rect.left
      const viewY = clientY - rect.top
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0
      const scrollTop = scrollRef.current?.scrollTop ?? 0
      return {
        viewX,
        viewY,
        contentX: viewX + scrollLeft,
        contentY: viewY + scrollTop
      }
    },
    [canvasRef, scrollRef]
  )

  const buildEnv = useCallback((activeTrack: Track): InteractionEnv => {
    const cur = latestRef.current
    return {
      track: activeTrack,
      metrics: cur.metrics,
      gridDivision: cur.gridDivision,
      toolMode: cur.toolMode,
      selectedNoteIds: cur.selectedNoteIds,
      noteLengthMode: cur.noteLengthMode,
      noteInputMode: cur.noteInputMode,
      lastNoteDurationTick: cur.lastNoteDurationTick,
      addNote: cur.addNote,
      updateNote: cur.updateNote,
      deleteNote: cur.deleteNote,
      setSelectedNoteIds: cur.setSelectedNoteIds,
      setLastNoteDurationTick: cur.setLastNoteDurationTick,
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
    }
  }, [])

  const stopActiveDragTracking = useCallback((): void => {
    isDraggingRef.current = false
    pointerClientRef.current = null
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current)
      autoScrollRafRef.current = null
    }
    if (cleanupDragListenersRef.current) {
      cleanupDragListenersRef.current()
      cleanupDragListenersRef.current = null
    }
  }, [])

  const finishDrag = useCallback((): void => {
    stopActiveDragTracking()
    const activeTrack = latestRef.current.track
    if (!activeTrack) return
    finishPianoRollDrag(sessionRef.current, buildEnv(activeTrack))
  }, [buildEnv, stopActiveDragTracking])

  const startActiveDragTracking = useCallback(
    (endTrigger: DragEndTrigger): void => {
      stopActiveDragTracking()
      isDraggingRef.current = true

      const syncPointerAtClient = (clientX: number, clientY: number): void => {
        const activeTrack = latestRef.current.track
        if (!activeTrack) return
        const coords = getCoordsFromClient(clientX, clientY)
        if (!coords) return
        handlePianoRollPointerMove(sessionRef.current, coords, buildEnv(activeTrack))
      }

      const onWindowMouseMove = (e: globalThis.MouseEvent): void => {
        if (!isDraggingRef.current) return
        pointerClientRef.current = { x: e.clientX, y: e.clientY }
        syncPointerAtClient(e.clientX, e.clientY)
      }

      const onWindowBlur = (): void => {
        finishDrag()
      }

      const onWindowMouseUp = (): void => {
        finishDrag()
      }

      const onWindowKeyUp = (e: KeyboardEvent): void => {
        if (endTrigger.kind === 'key' && e.code === endTrigger.code) {
          finishDrag()
        }
      }

      const onScrollDuringDrag = (): void => {
        if (!isDraggingRef.current) return
        const pt = pointerClientRef.current
        if (!pt) return
        syncPointerAtClient(pt.x, pt.y)
      }

      const scrollEl = scrollRef.current
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('blur', onWindowBlur)
      if (endTrigger.kind === 'pointer') {
        window.addEventListener('mouseup', onWindowMouseUp)
      } else {
        window.addEventListener('keyup', onWindowKeyUp)
      }
      scrollEl?.addEventListener('scroll', onScrollDuringDrag, { passive: true })

      cleanupDragListenersRef.current = () => {
        window.removeEventListener('mousemove', onWindowMouseMove)
        window.removeEventListener('blur', onWindowBlur)
        if (endTrigger.kind === 'pointer') {
          window.removeEventListener('mouseup', onWindowMouseUp)
        } else {
          window.removeEventListener('keyup', onWindowKeyUp)
        }
        scrollEl?.removeEventListener('scroll', onScrollDuringDrag)
      }

      const tickAutoScroll = (): void => {
        if (!isDraggingRef.current) return
        const pt = pointerClientRef.current
        const canvas = canvasRef.current
        const container = scrollRef.current
        if (pt && canvas && container) {
          const rect = canvas.getBoundingClientRect()
          const viewX = pt.x - rect.left
          const viewY = pt.y - rect.top
          const { dx, dy } = computeEdgeAutoScrollDelta(viewX, viewY, rect.width, rect.height)
          if (dx !== 0 || dy !== 0) {
            const prevLeft = container.scrollLeft
            const prevTop = container.scrollTop
            container.scrollLeft = prevLeft + dx
            container.scrollTop = prevTop + dy
            if (container.scrollLeft !== prevLeft || container.scrollTop !== prevTop) {
              syncPointerAtClient(pt.x, pt.y)
            }
          }
        }
        autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll)
      }

      autoScrollRafRef.current = requestAnimationFrame(tickAutoScroll)
    },
    [buildEnv, canvasRef, finishDrag, getCoordsFromClient, scrollRef, stopActiveDragTracking]
  )

  // Key-driven note placement and duration adjustment for trackpad ergonomics
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent): void => {
      const cur = latestRef.current
      if (cur.noteInputMode !== 'key' || e.code !== cur.noteDrawKey) return
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return

      const state = projectStore.getState()
      if (state.viewMode !== 'edit' || state.settingsOpen || state.unsavedPrompt) return

      const target = e.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return
      }

      const activeTrack = cur.track
      const hover = hoverClientRef.current
      const canvas = canvasRef.current
      if (!activeTrack || !hover || !canvas) return

      const rect = canvas.getBoundingClientRect()
      const coords = getCoordsFromClient(hover.x, hover.y)
      if (!coords || coords.viewX > rect.width || coords.viewY > rect.height) return

      const started = handlePianoRollKeyDrawStart(sessionRef.current, coords, buildEnv(activeTrack))
      if (!started) return

      e.preventDefault()
      if (sessionRef.current.drag.kind !== 'none') {
        pointerClientRef.current = { x: hover.x, y: hover.y }
        startActiveDragTracking({ kind: 'key', code: cur.noteDrawKey })
      }
    }

    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [buildEnv, canvasRef, getCoordsFromClient, startActiveDragTracking])

  useEffect(() => {
    return () => {
      stopActiveDragTracking()
    }
  }, [stopActiveDragTracking])

  const onMouseMove = (e: MouseEvent<HTMLCanvasElement>): void => {
    hoverClientRef.current = { x: e.clientX, y: e.clientY }
  }

  const onMouseLeave = (): void => {
    hoverClientRef.current = null
  }

  const onMouseDown = (e: MouseEvent<HTMLCanvasElement>): void => {
    hoverClientRef.current = { x: e.clientX, y: e.clientY }
    if (!track) return
    const coords = getCoordsFromClient(e.clientX, e.clientY)
    if (!coords) return
    handlePianoRollPointerDown(
      sessionRef.current,
      coords,
      { button: e.button, shiftKey: e.shiftKey },
      buildEnv(track)
    )
    if (sessionRef.current.drag.kind !== 'none') {
      pointerClientRef.current = { x: e.clientX, y: e.clientY }
      startActiveDragTracking({ kind: 'pointer' })
    }
  }

  return {
    sessionRef,
    onMouseDown,
    onMouseMove,
    onMouseLeave
  }
}
