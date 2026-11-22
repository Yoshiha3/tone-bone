import { useEffect, useMemo, useRef, useState } from 'react'
import {
  findNotesInRect,
  floorTickToGrid,
  getGridTickStep,
  moveNotes,
  snapTick
} from '@core/musicMath'
import type { Note } from '@core/types'
import { audioEngine } from '../audioContext'
import { projectStore, useProjectStore } from '../store/useProjectStore'
import { readThemeTokens, type ThemeTokens } from '../themeTokens'
import {
  contentXToTick,
  contentYToPitch,
  CREATE_DRAG_THRESHOLD_PX,
  createPianoRollMetrics,
  hitTestNote,
  KEY_COL_WIDTH,
  RULER_HEIGHT,
  SYNTH_MAX_PITCH,
  SYNTH_ROW_HEIGHT
} from './pianoRoll/pianoRollGeometry'
import { renderPianoRollFrame, type MarqueeRect } from './pianoRoll/pianoRollRenderer'
import styles from './PianoRoll.module.css'

type ToolMode = 'draw' | 'select'

type DragState =
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
      lastDeltaTick: number
      lastDeltaPitch: number
    }
  | { kind: 'marquee'; startX: number; startY: number; curX: number; curY: number }

export function PianoRoll() {
  const project = useProjectStore((s) => s.project)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const selectedNoteIds = useProjectStore((s) => s.selectedNoteIds)
  const gridDivision = useProjectStore((s) => s.gridDivision)
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const lastNoteDurationTick = useProjectStore((s) => s.lastNoteDurationTick)
  const setLastNoteDurationTick = useProjectStore((s) => s.setLastNoteDurationTick)
  const activePackIds = useProjectStore((s) => s.mergedPacks.activePackIds)
  const setSelectedNoteIds = useProjectStore((s) => s.setSelectedNoteIds)
  const addNote = useProjectStore((s) => s.addNote)
  const updateNote = useProjectStore((s) => s.updateNote)
  const deleteNote = useProjectStore((s) => s.deleteNote)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndoFlag = useProjectStore((s) => s.history.past.length > 0)
  const canRedoFlag = useProjectStore((s) => s.history.future.length > 0)

  const [toolMode, setToolMode] = useState<ToolMode>('draw')
  const [pxPerBeat, setPxPerBeat] = useState(84)
  const [viewport, setViewport] = useState({ width: 960, height: 600 })

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<DragState>({ kind: 'none' })
  const previewNotesRef = useRef<Note[] | null>(null)
  const marqueeRef = useRef<MarqueeRect | null>(null)
  const themeRef = useRef<ThemeTokens>(readThemeTokens())

  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0]
  const isDrum = track?.type === 'drum'

  const metrics = useMemo(
    () => createPianoRollMetrics(Boolean(isDrum), project.bars, pxPerBeat),
    [isDrum, project.bars, pxPerBeat]
  )

  // Observe visible viewport size so Canvas never grows with bar count
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const updateSize = (): void => {
      const w = Math.max(1, el.clientWidth)
      const h = Math.max(1, el.clientHeight)
      setViewport((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Refresh cached CSS theme tokens only when active resource packs change
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      themeRef.current = readThemeTokens()
    })
    return () => cancelAnimationFrame(raf)
  }, [activePackIds])

  // Center synth scroll around C4 when switching to a synth track
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isDrum) return
    const c4Row = SYNTH_MAX_PITCH - 60
    el.scrollTop = Math.max(0, c4Row * SYNTH_ROW_HEIGHT - el.clientHeight * 0.45)
  }, [selectedTrackId, isDrum])

  const getPointerCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    const { viewX, viewY, contentX, contentY } = getPointerCoords(e)

    if (viewY < RULER_HEIGHT && viewX >= KEY_COL_WIDTH) {
      audioEngine.seek(floorTickToGrid(contentXToTick(contentX, metrics), gridDivision))
      return
    }
    if (viewX < KEY_COL_WIDTH && viewY >= RULER_HEIGHT) {
      audioEngine.previewNote(track, contentYToPitch(contentY, metrics))
      return
    }
    if (viewY < RULER_HEIGHT) return

    const hit = hitTestNote(track.notes, contentX, contentY, metrics)

    if (e.button === 2) {
      if (hit) deleteNote(track.id, hit.note.id)
      return
    }
    if (e.button !== 0) return

    if (hit) {
      const isAlreadySelected = selectedNoteIds.includes(hit.note.id)
      let nextSelected = selectedNoteIds
      if (e.shiftKey) {
        nextSelected = isAlreadySelected
          ? selectedNoteIds.filter((id) => id !== hit.note.id)
          : [...selectedNoteIds, hit.note.id]
      } else if (!isAlreadySelected) {
        nextSelected = [hit.note.id]
      }
      setSelectedNoteIds(nextSelected)
      if (!isDrum) setLastNoteDurationTick(hit.note.durationTick)

      if (hit.isRightEdge && !isDrum) {
        dragRef.current = { kind: 'resize', noteId: hit.note.id, origStart: hit.note.startTick }
      } else {
        dragRef.current = {
          kind: 'move',
          startX: contentX,
          startY: contentY,
          origNotes: track.notes.map((n) => ({ ...n })),
          selectedSet: new Set(nextSelected),
          lastDeltaTick: 0,
          lastDeltaPitch: 0
        }
        previewNotesRef.current = track.notes.map((n) => ({ ...n }))
      }
      audioEngine.previewNote(track, hit.note.pitch, 0.14)
      return
    }

    if (toolMode === 'select' || e.shiftKey) {
      if (!e.shiftKey) setSelectedNoteIds([])
      dragRef.current = {
        kind: 'marquee',
        startX: contentX,
        startY: contentY,
        curX: contentX,
        curY: contentY
      }
      marqueeRef.current = { x1: contentX, y1: contentY, x2: contentX, y2: contentY }
      return
    }

    const step = getGridTickStep(gridDivision)
    const startTick = Math.min(
      metrics.totalTicks - step,
      floorTickToGrid(contentXToTick(contentX, metrics), gridDivision)
    )
    const pitch = contentYToPitch(contentY, metrics)
    const preferredDuration = !isDrum && noteLengthMode === 'last-used' ? lastNoteDurationTick : step
    const durationTick = Math.max(30, Math.min(metrics.totalTicks - startTick, preferredDuration))
    const created = addNote(track.id, { pitch, startTick, durationTick, velocity: 0.8 })
    setSelectedNoteIds([created.id])
    audioEngine.previewNote(track, pitch, 0.18)

    if (!isDrum) {
      dragRef.current = {
        kind: 'create',
        noteId: created.id,
        anchorTick: startTick,
        pitch,
        startX: contentX,
        hasDragged: false
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    const drag = dragRef.current
    if (drag.kind === 'none') return

    const { contentX, contentY } = getPointerCoords(e)
    const step = getGridTickStep(gridDivision)

    if (drag.kind === 'create' || drag.kind === 'resize') {
      if (drag.kind === 'create' && !drag.hasDragged) {
        const curGridTick = floorTickToGrid(contentXToTick(contentX, metrics), gridDivision)
        const movedRightEnough = contentX - drag.startX >= CREATE_DRAG_THRESHOLD_PX
        if (!movedRightEnough || curGridTick <= drag.anchorTick) return
        drag.hasDragged = true
      }

      const anchor = drag.kind === 'create' ? drag.anchorTick : drag.origStart
      const endTick = Math.max(anchor + step, snapTick(contentXToTick(contentX, metrics), gridDivision))
      const clampedDuration = Math.max(step, Math.min(metrics.totalTicks - anchor, endTick - anchor))
      const currentTrack = projectStore.getState().project.tracks.find((t) => t.id === track.id)
      if (currentTrack) {
        previewNotesRef.current = currentTrack.notes.map((n) =>
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
        previewNotesRef.current = moveNotes(
          drag.origNotes,
          drag.selectedSet,
          deltaTick,
          deltaPitch,
          metrics.minPitch,
          metrics.maxPitch,
          metrics.totalTicks
        )
      }
      return
    }

    if (drag.kind === 'marquee') {
      drag.curX = contentX
      drag.curY = contentY
      marqueeRef.current = { x1: drag.startX, y1: drag.startY, x2: contentX, y2: contentY }
    }
  }

  const finishDrag = (): void => {
    if (!track) return
    const drag = dragRef.current
    if (drag.kind === 'none') return

    if (
      ((drag.kind === 'create' && drag.hasDragged) || drag.kind === 'resize') &&
      previewNotesRef.current
    ) {
      const target = previewNotesRef.current.find((n) => n.id === drag.noteId)
      if (target) updateNote(track.id, drag.noteId, { durationTick: target.durationTick })
    } else if (
      drag.kind === 'move' &&
      previewNotesRef.current &&
      (drag.lastDeltaTick !== 0 || drag.lastDeltaPitch !== 0)
    ) {
      const state = projectStore.getState()
      state.commitProjectSnapshot({
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === track.id ? { ...t, notes: previewNotesRef.current! } : t
        )
      })
    } else if (drag.kind === 'marquee') {
      const found = findNotesInRect(track.notes, {
        minTick: contentXToTick(Math.min(drag.startX, drag.curX), metrics),
        maxTick: contentXToTick(Math.max(drag.startX, drag.curX), metrics),
        minPitch: contentYToPitch(Math.max(drag.startY, drag.curY), metrics),
        maxPitch: contentYToPitch(Math.min(drag.startY, drag.curY), metrics)
      })
      setSelectedNoteIds(found)
    }

    dragRef.current = { kind: 'none' }
    previewNotesRef.current = null
    marqueeRef.current = null
  }

  useEffect(() => {
    let rafId = 0

    const draw = (): void => {
      const canvas = canvasRef.current
      const scrollEl = scrollRef.current
      if (canvas && scrollEl && track) {
        const dpr = window.devicePixelRatio || 1
        const targetW = Math.floor(viewport.width * dpr)
        const targetH = Math.floor(viewport.height * dpr)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)
          renderPianoRollFrame({
            ctx,
            viewW: viewport.width,
            viewH: viewport.height,
            scrollLeft: scrollEl.scrollLeft,
            scrollTop: scrollEl.scrollTop,
            metrics,
            project,
            track,
            notesToDraw: previewNotesRef.current ?? track.notes,
            selectedNoteIds,
            gridDivision,
            playheadTick: audioEngine.getCurrentTick(),
            isPlaying: audioEngine.getIsPlaying(),
            marquee: marqueeRef.current,
            theme: themeRef.current
          })
          ctx.restore()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [project, track, selectedNoteIds, gridDivision, activePackIds, viewport, metrics])

  return (
    <section className={styles.wrapper} data-testid="piano-roll">
      <div className={styles.scrollArea} ref={scrollRef}>
        <div
          className={styles.spacer}
          style={{ width: metrics.contentWidth, height: metrics.contentHeight }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: viewport.width, height: viewport.height }}
            className={`${styles.canvas} ${toolMode === 'select' ? styles.canvasSelect : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={finishDrag}
            onMouseLeave={finishDrag}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="piano-roll-canvas"
          />
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerGroup}>
          <button
            type="button"
            className={`${styles.toolBtn} ${toolMode === 'draw' ? styles.toolBtnActive : ''}`}
            onClick={() => setToolMode('draw')}
            data-testid="tool-draw-btn"
          >
            入力
          </button>
          <button
            type="button"
            className={`${styles.toolBtn} ${toolMode === 'select' ? styles.toolBtnActive : ''}`}
            onClick={() => setToolMode('select')}
            data-testid="tool-select-btn"
          >
            範囲選択
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={undo}
            disabled={!canUndoFlag}
            data-testid="undo-btn"
          >
            元に戻す
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={redo}
            disabled={!canRedoFlag}
            data-testid="redo-btn"
          >
            やり直し
          </button>
        </div>

        <span className={styles.hint}>
          クリック: 配置 / 右クリック: 削除 / Shift+ドラッグ: 範囲選択 / Cmd+C・V: コピペ
        </span>

        <div className={styles.footerGroup}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setPxPerBeat((z) => Math.max(48, z - 16))}
            title="縮小"
          >
            -
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => setPxPerBeat((z) => Math.min(160, z + 16))}
            title="拡大"
          >
            +
          </button>
        </div>
      </div>
    </section>
  )
}
