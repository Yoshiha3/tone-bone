import { useCallback, useEffect, useRef, useState } from 'react'
import {
  findNotesInRect,
  floorTickToGrid,
  getGridTickStep,
  isBlackKey,
  midiToNoteName,
  moveNotes,
  snapTick
} from '@core/musicMath'
import { DRUM_LANES, PPQN, TICKS_PER_BAR, type Note } from '@core/types'
import { audioEngine } from '../audioContext'
import { projectStore, useProjectStore } from '../store/useProjectStore'
import styles from './PianoRoll.module.css'

const KEY_COL_WIDTH = 72
const RULER_HEIGHT = 26
const SYNTH_MIN_PITCH = 36 // C2
const SYNTH_MAX_PITCH = 84 // C6
const SYNTH_ROW_HEIGHT = 22
const DRUM_ROW_HEIGHT = 38
const CREATE_DRAG_THRESHOLD_PX = 8

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

interface ThemeColors {
  bgGrid: string
  rowAlt: string
  surface: string
  borderSubtle: string
  lineBar: string
  lineBeat: string
  lineSub: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  playheadColor: string
  selectionFill: string
  selectionBorder: string
  trackPalette: string[]
}

function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fb: string): string => s.getPropertyValue(name).trim() || fb
  const defaultPalette = ['#3b6ea5', '#3c8d7a', '#c07a45', '#7b63a8', '#b85c6f', '#547c99']
  return {
    bgGrid: v('--grid-bg', '#fbfcfe'),
    rowAlt: v('--grid-row-alt', '#f3f5f8'),
    surface: v('--bg-surface', '#ffffff'),
    borderSubtle: v('--border-subtle', '#e2e6ed'),
    lineBar: v('--grid-line-bar', '#c5cddb'),
    lineBeat: v('--grid-line-beat', '#dce1ea'),
    lineSub: v('--grid-line-sub', '#eceff4'),
    textPrimary: v('--text-primary', '#1e2430'),
    textSecondary: v('--text-secondary', '#5c6678'),
    textMuted: v('--text-muted', '#8c96a8'),
    playheadColor: v('--playhead', '#3b6ea5'),
    selectionFill: v('--selection-fill', 'rgba(59,110,165,0.14)'),
    selectionBorder: v('--selection-border', '#3b6ea5'),
    trackPalette: defaultPalette.map((fb, i) => v(`--track-color-${i}`, fb))
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

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
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const themeRef = useRef<ThemeColors>(readThemeColors())

  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0]
  const isDrum = track?.type === 'drum'
  const minPitch = isDrum ? 0 : SYNTH_MIN_PITCH
  const maxPitch = isDrum ? DRUM_LANES.length - 1 : SYNTH_MAX_PITCH
  const rowCount = maxPitch - minPitch + 1
  const rowHeight = isDrum ? DRUM_ROW_HEIGHT : SYNTH_ROW_HEIGHT

  const pxPerTick = pxPerBeat / PPQN
  const totalTicks = project.bars * TICKS_PER_BAR
  const contentWidth = Math.ceil(KEY_COL_WIDTH + totalTicks * pxPerTick + 32)
  const contentHeight = RULER_HEIGHT + rowCount * rowHeight

  // Keep canvas sized strictly to the visible viewport (never grows with bar count)
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

  // Cache theme CSS variables only when active packs change (zero getComputedStyle per frame)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      themeRef.current = readThemeColors()
    })
    return () => cancelAnimationFrame(raf)
  }, [activePackIds])

  // Scroll synth roll to middle C (C4) when switching to a synth track
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isDrum) return
    const c4Row = SYNTH_MAX_PITCH - 60
    const targetScroll = Math.max(0, c4Row * SYNTH_ROW_HEIGHT - el.clientHeight * 0.45)
    el.scrollTop = targetScroll
  }, [selectedTrackId, isDrum])

  const pitchToContentY = useCallback(
    (pitch: number): number => RULER_HEIGHT + (maxPitch - pitch) * rowHeight,
    [maxPitch, rowHeight]
  )

  const contentYToPitch = useCallback(
    (contentY: number): number => {
      const row = Math.floor((contentY - RULER_HEIGHT) / rowHeight)
      return Math.max(minPitch, Math.min(maxPitch, maxPitch - row))
    },
    [maxPitch, minPitch, rowHeight]
  )

  const contentXToTick = useCallback(
    (contentX: number): number => Math.max(0, Math.min(totalTicks, (contentX - KEY_COL_WIDTH) / pxPerTick)),
    [pxPerTick, totalTicks]
  )

  const getPointerCoords = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { viewX: number; viewY: number; contentX: number; contentY: number } => {
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

  const hitTestNote = (
    notes: readonly Note[],
    contentX: number,
    contentY: number
  ): { note: Note; isRightEdge: boolean } | null => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      const nx = KEY_COL_WIDTH + n.startTick * pxPerTick
      const nw = Math.max(10, n.durationTick * pxPerTick)
      const ny = pitchToContentY(n.pitch) + 2
      const nh = rowHeight - 4
      if (contentX >= nx && contentX <= nx + nw && contentY >= ny && contentY <= ny + nh) {
        return { note: n, isRightEdge: contentX >= nx + nw - 8 && nw >= 14 }
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    const { viewX, viewY, contentX, contentY } = getPointerCoords(e)

    // Sticky top ruler click -> seek playhead
    if (viewY < RULER_HEIGHT && viewX >= KEY_COL_WIDTH) {
      const tick = floorTickToGrid(contentXToTick(contentX), gridDivision)
      audioEngine.seek(tick)
      return
    }

    // Sticky left key column click -> preview pitch
    if (viewX < KEY_COL_WIDTH && viewY >= RULER_HEIGHT) {
      const pitch = contentYToPitch(contentY)
      audioEngine.previewNote(track, pitch)
      return
    }

    if (viewY < RULER_HEIGHT) return

    const hit = hitTestNote(track.notes, contentX, contentY)

    // Right-click deletes note
    if (e.button === 2) {
      if (hit) {
        deleteNote(track.id, hit.note.id)
      }
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
      if (!isDrum) {
        setLastNoteDurationTick(hit.note.durationTick)
      }

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

    // Clicked empty grid cell
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

    // Draw mode: create note snapped to current grid division
    const step = getGridTickStep(gridDivision)
    const startTick = Math.min(totalTicks - step, floorTickToGrid(contentXToTick(contentX), gridDivision))
    const pitch = contentYToPitch(contentY)
    const preferredDuration =
      !isDrum && noteLengthMode === 'last-used' ? lastNoteDurationTick : step
    const durationTick = Math.max(30, Math.min(totalTicks - startTick, preferredDuration))
    const created = addNote(track.id, {
      pitch,
      startTick,
      durationTick,
      velocity: 0.8
    })
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
        const curGridTick = floorTickToGrid(contentXToTick(contentX), gridDivision)
        const movedRightEnough = contentX - drag.startX >= CREATE_DRAG_THRESHOLD_PX
        const enteredNextGrid = curGridTick > drag.anchorTick
        if (!movedRightEnough || !enteredNextGrid) {
          return
        }
        drag.hasDragged = true
      }

      const anchor = drag.kind === 'create' ? drag.anchorTick : drag.origStart
      const endTick = Math.max(anchor + step, snapTick(contentXToTick(contentX), gridDivision))
      const clampedDuration = Math.max(step, Math.min(totalTicks - anchor, endTick - anchor))
      const currentTrack = projectStore.getState().project.tracks.find((t) => t.id === track.id)
      if (currentTrack) {
        previewNotesRef.current = currentTrack.notes.map((n) =>
          n.id === drag.noteId ? { ...n, durationTick: clampedDuration } : n
        )
      }
      return
    }

    if (drag.kind === 'move') {
      const rawDeltaTick = (contentX - drag.startX) / pxPerTick
      const deltaTick = Math.round(rawDeltaTick / step) * step
      const deltaPitch = -Math.round((contentY - drag.startY) / rowHeight)

      if (deltaTick !== drag.lastDeltaTick || deltaPitch !== drag.lastDeltaPitch) {
        drag.lastDeltaTick = deltaTick
        drag.lastDeltaPitch = deltaPitch
        previewNotesRef.current = moveNotes(
          drag.origNotes,
          drag.selectedSet,
          deltaTick,
          deltaPitch,
          minPitch,
          maxPitch,
          totalTicks
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
      if (target) {
        updateNote(track.id, drag.noteId, { durationTick: target.durationTick })
      }
    } else if (
      drag.kind === 'move' &&
      previewNotesRef.current &&
      (drag.lastDeltaTick !== 0 || drag.lastDeltaPitch !== 0)
    ) {
      const state = projectStore.getState()
      const nextProject = {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === track.id ? { ...t, notes: previewNotesRef.current! } : t
        )
      }
      state.commitProjectSnapshot(nextProject)
    } else if (drag.kind === 'marquee') {
      const rect = {
        minTick: contentXToTick(Math.min(drag.startX, drag.curX)),
        maxTick: contentXToTick(Math.max(drag.startX, drag.curX)),
        minPitch: contentYToPitch(Math.max(drag.startY, drag.curY)),
        maxPitch: contentYToPitch(Math.min(drag.startY, drag.curY))
      }
      const found = findNotesInRect(track.notes, rect)
      setSelectedNoteIds(found)
    }

    dragRef.current = { kind: 'none' }
    previewNotesRef.current = null
    marqueeRef.current = null
  }

  // Virtualized 60fps render loop: draws ONLY the visible viewport slice
  useEffect(() => {
    let rafId = 0

    const draw = (): void => {
      const canvas = canvasRef.current
      const scrollEl = scrollRef.current
      if (canvas && scrollEl && track) {
        const viewW = viewport.width
        const viewH = viewport.height
        const dpr = window.devicePixelRatio || 1
        const targetW = Math.floor(viewW * dpr)
        const targetH = Math.floor(viewH * dpr)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          const scrollLeft = scrollEl.scrollLeft
          const scrollTop = scrollEl.scrollTop
          const theme = themeRef.current
          const trackColor = theme.trackPalette[track.colorIndex % 6] ?? '#3b6ea5'

          const visibleStartTick = Math.max(0, scrollLeft / pxPerTick)
          const visibleEndTick = Math.min(
            totalTicks,
            (scrollLeft + (viewW - KEY_COL_WIDTH)) / pxPerTick + 1
          )
          const visibleMaxPitch = Math.min(
            maxPitch,
            maxPitch - Math.floor(Math.max(0, scrollTop - RULER_HEIGHT) / rowHeight) + 1
          )
          const visibleMinPitch = Math.max(
            minPitch,
            maxPitch - Math.ceil((scrollTop + viewH) / rowHeight) - 1
          )

          ctx.save()
          ctx.scale(dpr, dpr)

          // 1. Background
          ctx.fillStyle = theme.bgGrid
          ctx.fillRect(0, 0, viewW, viewH)

          // 2. Clipped grid & notes region
          ctx.save()
          ctx.beginPath()
          ctx.rect(KEY_COL_WIDTH, RULER_HEIGHT, viewW - KEY_COL_WIDTH, viewH - RULER_HEIGHT)
          ctx.clip()

          // Visible pitch rows
          for (let pitch = visibleMaxPitch; pitch >= visibleMinPitch; pitch--) {
            const viewY = pitchToContentY(pitch) - scrollTop
            const alt = isDrum ? pitch % 2 === 1 : isBlackKey(pitch)
            if (alt) {
              ctx.fillStyle = theme.rowAlt
              ctx.fillRect(KEY_COL_WIDTH, viewY, viewW - KEY_COL_WIDTH, rowHeight)
            }
            ctx.strokeStyle = theme.lineSub
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(KEY_COL_WIDTH, viewY + rowHeight)
            ctx.lineTo(viewW, viewY + rowHeight)
            ctx.stroke()
          }

          // Visible vertical grid lines (including triplet divisions)
          const step = getGridTickStep(gridDivision)
          const firstTick = Math.max(0, Math.floor(visibleStartTick / step) * step)
          const lastTick = Math.min(totalTicks, Math.ceil(visibleEndTick / step) * step)
          for (let tick = firstTick; tick <= lastTick; tick += step) {
            const viewX = Math.round(KEY_COL_WIDTH + tick * pxPerTick - scrollLeft) + 0.5
            const isBar = tick % TICKS_PER_BAR === 0
            const isBeat = tick % PPQN === 0
            ctx.strokeStyle = isBar ? theme.lineBar : isBeat ? theme.lineBeat : theme.lineSub
            ctx.lineWidth = isBar ? 1.25 : 1
            ctx.beginPath()
            ctx.moveTo(viewX, RULER_HEIGHT)
            ctx.lineTo(viewX, viewH)
            ctx.stroke()
          }

          // Subtle ghost notes from other synth tracks (culled to viewport)
          if (!isDrum) {
            for (const other of project.tracks) {
              if (other.id === track.id || other.type !== 'synth') continue
              const ghostColor = theme.trackPalette[other.colorIndex % 6] ?? '#888'
              ctx.save()
              ctx.fillStyle = ghostColor
              ctx.globalAlpha = 0.14
              for (const n of other.notes) {
                if (
                  n.pitch < visibleMinPitch ||
                  n.pitch > visibleMaxPitch ||
                  n.startTick + n.durationTick < visibleStartTick ||
                  n.startTick > visibleEndTick
                ) {
                  continue
                }
                const nx = KEY_COL_WIDTH + n.startTick * pxPerTick - scrollLeft + 1
                const ny = pitchToContentY(n.pitch) - scrollTop + 3
                const nw = Math.max(6, n.durationTick * pxPerTick - 2)
                drawRoundedRect(ctx, nx, ny, nw, rowHeight - 6, 3)
                ctx.fill()
              }
              ctx.restore()
            }
          }

          // Current track notes (culled to viewport)
          const playheadTick = audioEngine.getCurrentTick()
          const playing = audioEngine.getIsPlaying()
          const notesToDraw = previewNotesRef.current ?? track.notes
          const selectedSet = new Set(selectedNoteIds)

          for (const n of notesToDraw) {
            if (
              n.pitch < visibleMinPitch ||
              n.pitch > visibleMaxPitch ||
              n.startTick + n.durationTick < visibleStartTick ||
              n.startTick > visibleEndTick
            ) {
              continue
            }
            const nx = KEY_COL_WIDTH + n.startTick * pxPerTick - scrollLeft + 1
            const ny = pitchToContentY(n.pitch) - scrollTop + 2
            const nw = Math.max(10, n.durationTick * pxPerTick - 2)
            const nh = rowHeight - 4
            const isSelected = selectedSet.has(n.id)
            const isHit =
              playing && playheadTick >= n.startTick && playheadTick < n.startTick + n.durationTick

            ctx.save()
            ctx.fillStyle = trackColor
            ctx.globalAlpha = isHit ? 1.0 : isSelected ? 0.96 : 0.82
            drawRoundedRect(ctx, nx, ny, nw, nh, 4)
            ctx.fill()

            if (isSelected) {
              ctx.strokeStyle = theme.textPrimary
              ctx.lineWidth = 1.6
              ctx.stroke()
            } else if (isHit) {
              ctx.strokeStyle = '#ffffff'
              ctx.globalAlpha = 0.7
              ctx.lineWidth = 1.4
              ctx.stroke()
            }
            ctx.restore()
          }

          // Marquee selection box
          if (marqueeRef.current) {
            const m = marqueeRef.current
            const rx = Math.min(m.x1, m.x2) - scrollLeft
            const ry = Math.min(m.y1, m.y2) - scrollTop
            const rw = Math.abs(m.x2 - m.x1)
            const rh = Math.abs(m.y2 - m.y1)
            ctx.fillStyle = theme.selectionFill
            ctx.fillRect(rx, ry, rw, rh)
            ctx.strokeStyle = theme.selectionBorder
            ctx.lineWidth = 1
            ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh)
          }

          // Playhead vertical line
          const phViewX = KEY_COL_WIDTH + playheadTick * pxPerTick - scrollLeft
          if (phViewX >= KEY_COL_WIDTH && phViewX <= viewW) {
            ctx.strokeStyle = theme.playheadColor
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(phViewX, RULER_HEIGHT)
            ctx.lineTo(phViewX, viewH)
            ctx.stroke()
          }

          ctx.restore() // end grid clip

          // 3. Sticky left keyboard / drum pad column (always pinned at x = 0)
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, RULER_HEIGHT, KEY_COL_WIDTH, viewH - RULER_HEIGHT)
          ctx.clip()

          ctx.fillStyle = theme.surface
          ctx.fillRect(0, RULER_HEIGHT, KEY_COL_WIDTH, viewH - RULER_HEIGHT)
          ctx.textBaseline = 'middle'

          for (let pitch = visibleMaxPitch; pitch >= visibleMinPitch; pitch--) {
            const viewY = pitchToContentY(pitch) - scrollTop
            if (isDrum) {
              const lane = DRUM_LANES.find((l) => l.pitch === pitch)
              ctx.fillStyle = theme.textPrimary
              ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
              ctx.fillText(lane?.label ?? `Drum ${pitch}`, 10, viewY + rowHeight / 2)
            } else {
              const black = isBlackKey(pitch)
              if (black) {
                ctx.fillStyle = theme.rowAlt
                ctx.fillRect(0, viewY, KEY_COL_WIDTH - 1, rowHeight)
              }
              const isC = pitch % 12 === 0
              ctx.fillStyle = isC ? theme.textPrimary : theme.textMuted
              ctx.font = isC ? '600 11px sans-serif' : '10px sans-serif'
              if (isC || !black) {
                ctx.fillText(midiToNoteName(pitch), 10, viewY + rowHeight / 2)
              }
            }
            ctx.strokeStyle = theme.borderSubtle
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, viewY + rowHeight)
            ctx.lineTo(KEY_COL_WIDTH, viewY + rowHeight)
            ctx.stroke()
          }
          ctx.restore()

          ctx.strokeStyle = theme.borderSubtle
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(KEY_COL_WIDTH - 0.5, 0)
          ctx.lineTo(KEY_COL_WIDTH - 0.5, viewH)
          ctx.stroke()

          // 4. Sticky top ruler (always pinned at y = 0, only draws visible bar numbers)
          ctx.fillStyle = theme.surface
          ctx.fillRect(0, 0, viewW, RULER_HEIGHT)
          ctx.strokeStyle = theme.borderSubtle
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, RULER_HEIGHT - 0.5)
          ctx.lineTo(viewW, RULER_HEIGHT - 0.5)
          ctx.stroke()

          ctx.save()
          ctx.beginPath()
          ctx.rect(KEY_COL_WIDTH, 0, viewW - KEY_COL_WIDTH, RULER_HEIGHT)
          ctx.clip()

          ctx.fillStyle = theme.textSecondary
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
          ctx.textBaseline = 'middle'
          const firstBar = Math.max(0, Math.floor(visibleStartTick / TICKS_PER_BAR))
          const lastBar = Math.min(project.bars - 1, Math.ceil(visibleEndTick / TICKS_PER_BAR))
          for (let bar = firstBar; bar <= lastBar; bar++) {
            const viewX = KEY_COL_WIDTH + bar * TICKS_PER_BAR * pxPerTick - scrollLeft
            ctx.fillText(`${bar + 1}`, viewX + 6, RULER_HEIGHT / 2)
          }

          if (phViewX >= KEY_COL_WIDTH && phViewX <= viewW) {
            ctx.fillStyle = theme.playheadColor
            ctx.beginPath()
            ctx.arc(phViewX, RULER_HEIGHT - 5, 3.5, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()

          // Top-left corner cap
          ctx.fillStyle = theme.surface
          ctx.fillRect(0, 0, KEY_COL_WIDTH - 1, RULER_HEIGHT - 1)
          ctx.strokeStyle = theme.borderSubtle
          ctx.beginPath()
          ctx.moveTo(KEY_COL_WIDTH - 0.5, 0)
          ctx.lineTo(KEY_COL_WIDTH - 0.5, RULER_HEIGHT)
          ctx.stroke()

          ctx.restore()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [
    project,
    track,
    selectedNoteIds,
    gridDivision,
    activePackIds,
    viewport,
    maxPitch,
    minPitch,
    rowHeight,
    pxPerTick,
    totalTicks,
    isDrum,
    pitchToContentY
  ])

  return (
    <section className={styles.wrapper} data-testid="piano-roll">
      <div className={styles.scrollArea} ref={scrollRef}>
        <div
          className={styles.spacer}
          style={{ width: contentWidth, height: contentHeight }}
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
