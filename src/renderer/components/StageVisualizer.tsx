import { useEffect, useRef } from 'react'
import { DRUM_LANES } from '@core/types'
import { createDefaultVisualizerRegistry } from '@visualizers/VisualizerRegistry'
import type { ActiveRipple } from '@visualizers/types'
import { audioEngine } from '../audioContext'
import { useProjectStore } from '../store/useProjectStore'
import styles from './StageVisualizer.module.css'

const visualizerRegistry = createDefaultVisualizerRegistry()

function getTrackColors(): string[] {
  const style = getComputedStyle(document.documentElement)
  const fallbacks = ['#3b6ea5', '#3c8d7a', '#c07a45', '#7b63a8', '#b85c6f', '#547c99']
  return fallbacks.map((fb, i) => style.getPropertyValue(`--track-color-${i}`).trim() || fb)
}

export function StageVisualizer() {
  const project = useProjectStore((s) => s.project)
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying)
  const setViewMode = useProjectStore((s) => s.setViewMode)
  const preset = useProjectStore((s) => s.mergedPacks.visualizer)
  const activePackIds = useProjectStore((s) => s.mergedPacks.activePackIds)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ripplesRef = useRef<ActiveRipple[]>([])
  const waveformRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(512)))

  // Spawn calm visual ripples whenever a note triggers
  useEffect(() => {
    const unsubscribe = audioEngine.onNoteTrigger((evt) => {
      const colors = getTrackColors()
      const track = project.tracks.find((t) => t.id === evt.trackId)
      const isDrum = track?.type === 'drum'
      let yRatio: number
      if (isDrum) {
        yRatio = 0.84 - (evt.note.pitch / Math.max(1, DRUM_LANES.length)) * 0.18
      } else {
        const norm = (evt.note.pitch - 36) / (84 - 36)
        yRatio = 0.76 - Math.max(0, Math.min(1, norm)) * 0.68
      }

      ripplesRef.current.push({
        xRatio: 0.28,
        yRatio,
        color: colors[evt.colorIndex % colors.length],
        createdAtMs: performance.now(),
        strength: 0.7 + evt.note.velocity * 0.5
      })
      if (ripplesRef.current.length > 48) {
        ripplesRef.current.shift()
      }
    })
    return unsubscribe
  }, [project.tracks])

  useEffect(() => {
    let rafId = 0
    const renderer = visualizerRegistry.get(preset.rendererId)

    const draw = (nowMs: number): void => {
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        const w = Math.max(1, Math.floor(rect.width * dpr))
        const h = Math.max(1, Math.floor(rect.height * dpr))
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          // Pull waveform (default flat line at 128 when silent)
          const gotWave = audioEngine.getWaveformData(waveformRef.current)
          if (!gotWave) {
            waveformRef.current.fill(128)
          }

          // Prune expired ripples
          ripplesRef.current = ripplesRef.current.filter((r) => nowMs - r.createdAtMs < 750)

          renderer.render(
            ctx,
            {
              width: rect.width,
              height: rect.height,
              nowMs,
              currentTick: audioEngine.getCurrentTick(),
              isPlaying: audioEngine.getIsPlaying(),
              project,
              trackColors: getTrackColors(),
              waveform: waveformRef.current,
              ripples: ripplesRef.current
            },
            preset
          )
          ctx.restore()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [project, preset, activePackIds])

  const handleTogglePlay = (): void => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.pause()
      setIsPlaying(false)
    } else {
      audioEngine.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className={styles.stage} data-testid="stage-visualizer">
      <canvas ref={canvasRef} className={styles.canvas} data-testid="stage-canvas" />
      <div className={styles.hud}>
        <div className={styles.hudLeft}>
          <span className={styles.title}>{project.title}</span>
          <span className={styles.meta}>{project.bpm} BPM</span>
        </div>
        <div className={styles.hudRight}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={handleTogglePlay}
            data-testid="stage-play-btn"
          >
            {isPlaying ? '一時停止' : '再生'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            data-testid="exit-stage-btn"
          >
            編集に戻る
          </button>
        </div>
      </div>
    </div>
  )
}
