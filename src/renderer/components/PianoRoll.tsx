import { useEffect, useMemo, useRef, useState } from 'react'
import { getTrackTypeSpec, TRACK_TYPE_SPECS } from '@core/trackTypes'
import { audioEngine } from '../audioContext'
import { useProjectStore } from '../store/useProjectStore'
import { readThemeTokens, type ThemeTokens } from '../themeTokens'
import {
  createPianoRollMetrics,
  SYNTH_MAX_PITCH,
  SYNTH_ROW_HEIGHT
} from './pianoRoll/pianoRollGeometry'
import { PIANO_ROLL_TOOLS, type PianoRollToolMode } from './pianoRoll/pianoRollInteraction'
import { renderPianoRollFrame } from './pianoRoll/pianoRollRenderer'
import { usePianoRollInteraction } from './pianoRoll/usePianoRollInteraction'
import styles from './PianoRoll.module.css'

export function PianoRoll() {
  const project = useProjectStore((s) => s.project)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const selectedNoteIds = useProjectStore((s) => s.selectedNoteIds)
  const gridDivision = useProjectStore((s) => s.gridDivision)
  const noteLengthMode = useProjectStore((s) => s.settings.noteLengthMode)
  const lastNoteDurationTick = useProjectStore((s) => s.lastNoteDurationTick)
  const activeThemePackIds = useProjectStore((s) => s.mergedTheme.activeThemePackIds)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const canUndoFlag = useProjectStore((s) => s.history.past.length > 0)
  const canRedoFlag = useProjectStore((s) => s.history.future.length > 0)

  const [toolMode, setToolMode] = useState<PianoRollToolMode>('draw')
  const [pxPerBeat, setPxPerBeat] = useState(84)
  const [viewport, setViewport] = useState({ width: 960, height: 600 })

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const themeRef = useRef<ThemeTokens>(readThemeTokens())

  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0]
  const trackSpec = track ? getTrackTypeSpec(track.type) : TRACK_TYPE_SPECS.synth
  const isDrum = trackSpec.usesDrumLanes

  const metrics = useMemo(
    () => createPianoRollMetrics(Boolean(isDrum), project.bars, pxPerBeat),
    [isDrum, project.bars, pxPerBeat]
  )

  const interaction = usePianoRollInteraction({
    scrollRef,
    track,
    metrics,
    gridDivision,
    toolMode,
    selectedNoteIds,
    noteLengthMode,
    lastNoteDurationTick
  })

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

  // Refresh cached CSS theme tokens only when active theme packs change
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      themeRef.current = readThemeTokens()
    })
    return () => cancelAnimationFrame(raf)
  }, [activeThemePackIds])

  // Center synth scroll around C4 when switching to a synth track
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isDrum) return
    const c4Row = SYNTH_MAX_PITCH - 60
    el.scrollTop = Math.max(0, c4Row * SYNTH_ROW_HEIGHT - el.clientHeight * 0.45)
  }, [selectedTrackId, isDrum])

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
          const session = interaction.sessionRef.current
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
            notesToDraw: session.previewNotes ?? track.notes,
            selectedNoteIds,
            gridDivision,
            playheadTick: audioEngine.getCurrentTick(),
            isPlaying: audioEngine.getIsPlaying(),
            marquee: session.marquee,
            theme: themeRef.current
          })
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
    activeThemePackIds,
    viewport,
    metrics,
    interaction.sessionRef
  ])

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
            onMouseDown={interaction.onMouseDown}
            onMouseMove={interaction.onMouseMove}
            onMouseUp={interaction.onMouseUp}
            onMouseLeave={interaction.onMouseLeave}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="piano-roll-canvas"
          />
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerGroup}>
          {PIANO_ROLL_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`${styles.toolBtn} ${toolMode === tool.id ? styles.toolBtnActive : ''}`}
              onClick={() => setToolMode(tool.id)}
              data-testid={tool.testId}
            >
              {tool.label}
            </button>
          ))}
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
