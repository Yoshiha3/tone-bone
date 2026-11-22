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

type ToolMode = 'draw' | 'select'

type DragState =
  | { kind: 'none' }
  | { kind: 'create'; noteId: string; anchorTick: number; pitch: number }
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

function readCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || fallback
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

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<DragState>({ kind: 'none' })
  // Live preview notes during drag so we commit a single Undo entry on pointerup
  const previewNotesRef = useRef<Note[] | null>(null)
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0]
  const isDrum = track?.type === 'drum'
  const minPitch = isDrum ? 0 : SYNTH_MIN_PITCH
  const maxPitch = isDrum ? DRUM_LANES.length - 1 : SYNTH_MAX_PITCH
  const rowCount = maxPitch - minPitch + 1
  const rowHeight = isDrum ? DRUM_ROW_HEIGHT : SYNTH_ROW_HEIGHT

  const pxPerTick = pxPerBeat / PPQN
  const totalTicks = project.bars * TICKS_PER_BAR
  const canvasWidth = Math.ceil(KEY_COL_WIDTH + totalTicks * pxPerTick + 32)
  const canvasHeight = RULER_HEIGHT + rowCount * rowHeight

  // Scroll synth roll to middle C (C4) when switching to a synth track
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isDrum) return
    const c4Row = SYNTH_MAX_PITCH - 60
    const targetScroll = Math.max(0, c4Row * SYNTH_ROW_HEIGHT - el.clientHeight * 0.45)
    el.scrollTop = targetScroll
  }, [selectedTrackId, isDrum])

  const pitchToY = useCallback(
    (pitch: number): number => RULER_HEIGHT + (maxPitch - pitch) * rowHeight,
    [maxPitch, rowHeight]
  )

  const yToPitch = useCallback(
    (y: number): number => {
      const row = Math.floor((y - RULER_HEIGHT) / rowHeight)
      return Math.max(minPitch, Math.min(maxPitch, maxPitch - row))
    },
    [maxPitch, minPitch, rowHeight]
  )

  const xToTick = useCallback(
    (x: number): number => Math.max(0, Math.min(totalTicks, (x - KEY_COL_WIDTH) / pxPerTick)),
    [pxPerTick, totalTicks]
  )

  const getLocalCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const hitTestNote = (notes: readonly Note[], x: number, y: number): { note: Note; isRightEdge: boolean } | null => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      const nx = KEY_COL_WIDTH + n.startTick * pxPerTick
      const nw = Math.max(10, n.durationTick * pxPerTick)
      const ny = pitchToY(n.pitch) + 2
      const nh = rowHeight - 4
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
        return { note: n, isRightEdge: x >= nx + nw - 8 && nw >= 14 }
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    const { x, y } = getLocalCoords(e)

    // Ruler click -> seek playhead
    if (y < RULER_HEIGHT && x >= KEY_COL_WIDTH) {
      const tick = floorTickToGrid(xToTick(x), gridDivision)
      audioEngine.seek(tick)
      return
    }

    // Key column click -> preview pitch
    if (x < KEY_COL_WIDTH && y >= RULER_HEIGHT) {
      const pitch = yToPitch(y)
      audioEngine.previewNote(track, pitch)
      return
    }

    if (y < RULER_HEIGHT) return

    const hit = hitTestNote(track.notes, x, y)

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

      if (hit.isRightEdge && !isDrum) {
        dragRef.current = { kind: 'resize', noteId: hit.note.id, origStart: hit.note.startTick }
      } else {
        dragRef.current = {
          kind: 'move',
          startX: x,
          startY: y,
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
      dragRef.current = { kind: 'marquee', startX: x, startY: y, curX: x, curY: y }
      marqueeRef.current = { x1: x, y1: y, x2: x, y2: y }
      return
    }

    // Draw mode: create note snapped to current grid division
    const step = getGridTickStep(gridDivision)
    const startTick = Math.min(totalTicks - step, floorTickToGrid(xToTick(x), gridDivision))
    const pitch = yToPitch(y)
    const created = addNote(track.id, {
      pitch,
      startTick,
      durationTick: step,
      velocity: 0.8
    })
    setSelectedNoteIds([created.id])
    audioEngine.previewNote(track, pitch, 0.18)
    if (!isDrum) {
      dragRef.current = { kind: 'create', noteId: created.id, anchorTick: startTick, pitch }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!track) return
    const drag = dragRef.current
    if (drag.kind === 'none') return

    const { x, y } = getLocalCoords(e)
    const step = getGridTickStep(gridDivision)

    if (drag.kind === 'create' || drag.kind === 'resize') {
      const anchor = drag.kind === 'create' ? drag.anchorTick : drag.origStart
      const endTick = Math.max(anchor + step, snapTick(xToTick(x), gridDivision))
      const clampedDuration = Math.max(step, Math.min(totalTicks - anchor, endTick - anchor))
      // Live preview on the note via direct mutation snapshot
      const currentTrack = projectStore.getState().project.tracks.find((t) => t.id === track.id)
      if (currentTrack) {
        previewNotesRef.current = currentTrack.notes.map((n) =>
          n.id === drag.noteId ? { ...n, durationTick: clampedDuration } : n
        )
      }
      return
    }

    if (drag.kind === 'move') {
      const rawDeltaTick = (x - drag.startX) / pxPerTick
      const deltaTick = Math.round(rawDeltaTick / step) * step
      const deltaPitch = -Math.round((y - drag.startY) / rowHeight)

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
      drag.curX = x
      drag.curY = y
      marqueeRef.current = { x1: drag.startX, y1: drag.startY, x2: x, y2: y }
    }
  }

  const finishDrag = (): void => {
    if (!track) return
    const drag = dragRef.current
    if (drag.kind === 'none') return

    if ((drag.kind === 'create' || drag.kind === 'resize') && previewNotesRef.current) {
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
        minTick: xToTick(Math.min(drag.startX, drag.curX)),
        maxTick: xToTick(Math.max(drag.startX, drag.curX)),
        minPitch: yToPitch(Math.max(drag.startY, drag.curY)),
        maxPitch: yToPitch(Math.min(drag.startY, drag.curY))
      }
      const found = findNotesInRect(track.notes, rect)
      setSelectedNoteIds(found)
    }

    dragRef.current = { kind: 'none' }
    previewNotesRef.current = null
    marqueeRef.current = null
  }

  // Render loop (60fps playhead + clean HiDPI canvas drawing)
  useEffect(() => {
    let rafId = 0

    const draw = (): void => {
      const canvas = canvasRef.current
      if (canvas && track) {
        const dpr = window.devicePixelRatio || 1
        const targetW = Math.floor(canvasWidth * dpr)
        const targetH = Math.floor(canvasHeight * dpr)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          const bgGrid = readCssVar('--grid-bg', '#fbfcfe')
          const rowAlt = readCssVar('--grid-row-alt', '#f3f5f8')
          const surface = readCssVar('--bg-surface', '#ffffff')
          const borderSubtle = readCssVar('--border-subtle', '#e2e6ed')
          const lineBar = readCssVar('--grid-line-bar', '#c5cddb')
          const lineBeat = readCssVar('--grid-line-beat', '#dce1ea')
          const lineSub = readCssVar('--grid-line-sub', '#eceff4')
          const textPrimary = readCssVar('--text-primary', '#1e2430')
          const textSecondary = readCssVar('--text-secondary', '#5c6678')
          const textMuted = readCssVar('--text-muted', '#8c96a8')
          const playheadColor = readCssVar('--playhead', '#3b6ea5')
          const selectionFill = readCssVar('--selection-fill', 'rgba(59,110,165,0.14)')
          const selectionBorder = readCssVar('--selection-border', '#3b6ea5')
          const trackColor = readCssVar(`--track-color-${track.colorIndex % 6}`, '#3b6ea5')

          // Background
          ctx.fillStyle = bgGrid
          ctx.fillRect(0, 0, canvasWidth, canvasHeight)

          // Pitch rows
          for (let pitch = maxPitch; pitch >= minPitch; pitch--) {
            const y = pitchToY(pitch)
            const alt = isDrum ? pitch % 2 === 1 : isBlackKey(pitch)
            if (alt) {
              ctx.fillStyle = rowAlt
              ctx.fillRect(KEY_COL_WIDTH, y, canvasWidth - KEY_COL_WIDTH, rowHeight)
            }
            ctx.strokeStyle = lineSub
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(KEY_COL_WIDTH, y + rowHeight)
            ctx.lineTo(canvasWidth, y + rowHeight)
            ctx.stroke()
          }

          // Vertical grid lines (following current division including triplets!)
          const step = getGridTickStep(gridDivision)
          for (let tick = 0; tick <= totalTicks; tick += step) {
            const x = Math.round(KEY_COL_WIDTH + tick * pxPerTick) + 0.5
            const isBar = tick % TICKS_PER_BAR === 0
            const isBeat = tick % PPQN === 0
            ctx.strokeStyle = isBar ? lineBar : isBeat ? lineBeat : lineSub
            ctx.lineWidth = isBar ? 1.25 : 1
            ctx.beginPath()
            ctx.moveTo(x, RULER_HEIGHT)
            ctx.lineTo(x, canvasHeight)
            ctx.stroke()
          }

          // Subtle ghost notes from other synth tracks when editing synth
          if (!isDrum) {
            for (const other of project.tracks) {
              if (other.id === track.id || other.type !== 'synth') continue
              const ghostColor = readCssVar(`--track-color-${other.colorIndex % 6}`, '#888')
              ctx.save()
              ctx.fillStyle = ghostColor
              ctx.globalAlpha = 0.14
              for (const n of other.notes) {
                if (n.pitch < minPitch || n.pitch > maxPitch) continue
                const nx = KEY_COL_WIDTH + n.startTick * pxPerTick + 1
                const ny = pitchToY(n.pitch) + 3
                const nw = Math.max(6, n.durationTick * pxPerTick - 2)
                drawRoundedRect(ctx, nx, ny, nw, rowHeight - 6, 3)
                ctx.fill()
              }
              ctx.restore()
            }
          }

          // Current track notes
          const playheadTick = audioEngine.getCurrentTick()
          const playing = audioEngine.getIsPlaying()
          const notesToDraw = previewNotesRef.current ?? track.notes
          const selectedSet = new Set(selectedNoteIds)

          for (const n of notesToDraw) {
            if (n.pitch < minPitch || n.pitch > maxPitch) continue
            const nx = KEY_COL_WIDTH + n.startTick * pxPerTick + 1
            const ny = pitchToY(n.pitch) + 2
            const nw = Math.max(10, n.durationTick * pxPerTick - 2)
            const nh = rowHeight - 4
            const isSelected = selectedSet.has(n.id)
            const isHit = playing && playheadTick >= n.startTick && playheadTick < n.startTick + n.durationTick

            ctx.save()
            ctx.fillStyle = trackColor
            ctx.globalAlpha = isHit ? 1.0 : isSelected ? 0.96 : 0.82
            drawRoundedRect(ctx, nx, ny, nw, nh, 4)
            ctx.fill()

            if (isSelected) {
              ctx.strokeStyle = textPrimary
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
            const rx = Math.min(m.x1, m.x2)
            const ry = Math.min(m.y1, m.y2)
            const rw = Math.abs(m.x2 - m.x1)
            const rh = Math.abs(m.y2 - m.y1)
            ctx.fillStyle = selectionFill
            ctx.fillRect(rx, ry, rw, rh)
            ctx.strokeStyle = selectionBorder
            ctx.lineWidth = 1
            ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh)
          }

          // Playhead vertical line
          const phX = KEY_COL_WIDTH + playheadTick * pxPerTick
          ctx.strokeStyle = playheadColor
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(phX, 0)
          ctx.lineTo(phX, canvasHeight)
          ctx.stroke()

          // Top ruler
          ctx.fillStyle = surface
          ctx.fillRect(0, 0, canvasWidth, RULER_HEIGHT)
          ctx.strokeStyle = borderSubtle
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, RULER_HEIGHT - 0.5)
          ctx.lineTo(canvasWidth, RULER_HEIGHT - 0.5)
          ctx.stroke()

          ctx.fillStyle = textSecondary
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
          ctx.textBaseline = 'middle'
          for (let bar = 0; bar < project.bars; bar++) {
            const x = KEY_COL_WIDTH + bar * TICKS_PER_BAR * pxPerTick
            ctx.fillText(`${bar + 1}`, x + 6, RULER_HEIGHT / 2)
          }

          // Playhead cap on ruler
          ctx.fillStyle = playheadColor
          ctx.beginPath()
          ctx.arc(phX, RULER_HEIGHT - 5, 3.5, 0, Math.PI * 2)
          ctx.fill()

          // Left keyboard / drum pad column
          ctx.fillStyle = surface
          ctx.fillRect(0, RULER_HEIGHT, KEY_COL_WIDTH, canvasHeight - RULER_HEIGHT)
          ctx.strokeStyle = borderSubtle
          ctx.beginPath()
          ctx.moveTo(KEY_COL_WIDTH - 0.5, 0)
          ctx.lineTo(KEY_COL_WIDTH - 0.5, canvasHeight)
          ctx.stroke()

          for (let pitch = maxPitch; pitch >= minPitch; pitch--) {
            const y = pitchToY(pitch)
            if (isDrum) {
              const lane = DRUM_LANES.find((l) => l.pitch === pitch)
              ctx.fillStyle = textPrimary
              ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
              ctx.fillText(lane?.label ?? `Drum ${pitch}`, 10, y + rowHeight / 2)
            } else {
              const black = isBlackKey(pitch)
              if (black) {
                ctx.fillStyle = rowAlt
                ctx.fillRect(0, y, KEY_COL_WIDTH - 1, rowHeight)
              }
              const isC = pitch % 12 === 0
              ctx.fillStyle = isC ? textPrimary : textMuted
              ctx.font = isC ? '600 11px sans-serif' : '10px sans-serif'
              if (isC || !black) {
                ctx.fillText(midiToNoteName(pitch), 10, y + rowHeight / 2)
              }
            }
            ctx.strokeStyle = borderSubtle
            ctx.beginPath()
            ctx.moveTo(0, y + rowHeight)
            ctx.lineTo(KEY_COL_WIDTH, y + rowHeight)
            ctx.stroke()
          }

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
    canvasWidth,
    canvasHeight,
    maxPitch,
    minPitch,
    rowHeight,
    pxPerTick,
    totalTicks,
    isDrum,
    pitchToY
  ])

  return (
    <section className={styles.wrapper} data-testid="piano-roll">
      <div className={styles.scrollArea} ref={scrollRef}>
        <canvas
          ref={canvasRef}
          style={{ width: canvasWidth, height: canvasHeight }}
          className={`${styles.canvas} ${toolMode === 'select' ? styles.canvasSelect : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishDrag}
          onMouseLeave={finishDrag}
          onContextMenu={(e) => e.preventDefault()}
          data-testid="piano-roll-canvas"
        />
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
