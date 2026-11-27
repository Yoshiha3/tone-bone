import { getGridTickStep, isBlackKey, midiToNoteName } from '@core/musicMath'
import {
  DRUM_LANES,
  PPQN,
  TICKS_PER_BAR,
  type GridDivision,
  type Note,
  type Project,
  type Track
} from '@core/types'
import { drawRoundedRect } from '@visualizers/canvasUtils'
import type { ThemeTokens } from '../../themeTokens'
import {
  computeVisibleBounds,
  KEY_COL_WIDTH,
  pitchToContentY,
  RULER_HEIGHT,
  type PianoRollMetrics
} from './pianoRollGeometry'

export interface MarqueeRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PianoRollRenderParams {
  ctx: CanvasRenderingContext2D
  viewW: number
  viewH: number
  scrollLeft: number
  scrollTop: number
  metrics: PianoRollMetrics
  project: Project
  track: Track
  notesToDraw: readonly Note[]
  selectedNoteIds: readonly string[]
  gridDivision: GridDivision
  playheadTick: number
  isPlaying: boolean
  marquee: MarqueeRect | null
  theme: ThemeTokens
}

/**
 * Virtualized 2D Canvas renderer for the Piano Roll.
 * Draws only the visible viewport slice (grid, ghost notes, active notes,
 * marquee selection, playhead, sticky keyboard/drum column, and sticky ruler).
 */
export function renderPianoRollFrame(params: PianoRollRenderParams): void {
  const {
    ctx,
    viewW,
    viewH,
    scrollLeft,
    scrollTop,
    metrics,
    project,
    track,
    notesToDraw,
    selectedNoteIds,
    gridDivision,
    playheadTick,
    isPlaying,
    marquee,
    theme
  } = params

  const trackColor = theme.trackPalette[track.colorIndex % 6] ?? '#3b6ea5'
  const visible = computeVisibleBounds(metrics, scrollLeft, scrollTop, viewW, viewH)

  // 1. Background
  ctx.fillStyle = theme.bgGrid
  ctx.fillRect(0, 0, viewW, viewH)

  // 2. Clipped grid & notes region
  ctx.save()
  ctx.beginPath()
  ctx.rect(KEY_COL_WIDTH, RULER_HEIGHT, viewW - KEY_COL_WIDTH, viewH - RULER_HEIGHT)
  ctx.clip()

  // Visible pitch rows
  for (let pitch = visible.maxPitch; pitch >= visible.minPitch; pitch--) {
    const viewY = pitchToContentY(pitch, metrics) - scrollTop
    const alt = metrics.isDrum ? pitch % 2 === 1 : isBlackKey(pitch)
    if (alt) {
      ctx.fillStyle = theme.rowAlt
      ctx.fillRect(KEY_COL_WIDTH, viewY, viewW - KEY_COL_WIDTH, metrics.rowHeight)
    }
    ctx.strokeStyle = theme.lineSub
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(KEY_COL_WIDTH, viewY + metrics.rowHeight)
    ctx.lineTo(viewW, viewY + metrics.rowHeight)
    ctx.stroke()
  }

  // Visible vertical grid lines (standard & triplet divisions)
  const step = getGridTickStep(gridDivision)
  const firstTick = Math.max(0, Math.floor(visible.startTick / step) * step)
  const lastTick = Math.min(metrics.totalTicks, Math.ceil(visible.endTick / step) * step)
  for (let tick = firstTick; tick <= lastTick; tick += step) {
    const viewX = Math.round(KEY_COL_WIDTH + tick * metrics.pxPerTick - scrollLeft) + 0.5
    const isBar = tick % TICKS_PER_BAR === 0
    const isBeat = tick % PPQN === 0
    ctx.strokeStyle = isBar ? theme.lineBar : isBeat ? theme.lineBeat : theme.lineSub
    ctx.lineWidth = isBar ? 1.25 : 1
    ctx.beginPath()
    ctx.moveTo(viewX, RULER_HEIGHT)
    ctx.lineTo(viewX, viewH)
    ctx.stroke()
  }

  // Subtle ghost notes from other synth tracks
  if (!metrics.isDrum) {
    for (const other of project.tracks) {
      if (other.id === track.id || other.type !== 'synth') continue
      const ghostColor = theme.trackPalette[other.colorIndex % 6] ?? '#888'
      ctx.save()
      ctx.fillStyle = ghostColor
      ctx.globalAlpha = 0.14
      for (const n of other.notes) {
        if (
          n.pitch < visible.minPitch ||
          n.pitch > visible.maxPitch ||
          n.startTick + n.durationTick < visible.startTick ||
          n.startTick > visible.endTick
        ) {
          continue
        }
        const nx = KEY_COL_WIDTH + n.startTick * metrics.pxPerTick - scrollLeft + 1
        const ny = pitchToContentY(n.pitch, metrics) - scrollTop + 3
        const nw = Math.max(6, n.durationTick * metrics.pxPerTick - 2)
        drawRoundedRect(ctx, nx, ny, nw, metrics.rowHeight - 6, 3)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  // Active track notes
  const selectedSet = new Set(selectedNoteIds)
  for (const n of notesToDraw) {
    if (
      n.pitch < visible.minPitch ||
      n.pitch > visible.maxPitch ||
      n.startTick + n.durationTick < visible.startTick ||
      n.startTick > visible.endTick
    ) {
      continue
    }
    const nx = KEY_COL_WIDTH + n.startTick * metrics.pxPerTick - scrollLeft + 1
    const ny = pitchToContentY(n.pitch, metrics) - scrollTop + 2
    const nw = Math.max(10, n.durationTick * metrics.pxPerTick - 2)
    const nh = metrics.rowHeight - 4
    const isSelected = selectedSet.has(n.id)
    const isHit =
      isPlaying && playheadTick >= n.startTick && playheadTick < n.startTick + n.durationTick

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
  if (marquee) {
    const rx = Math.min(marquee.x1, marquee.x2) - scrollLeft
    const ry = Math.min(marquee.y1, marquee.y2) - scrollTop
    const rw = Math.abs(marquee.x2 - marquee.x1)
    const rh = Math.abs(marquee.y2 - marquee.y1)
    ctx.fillStyle = theme.selectionFill
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = theme.selectionBorder
    ctx.lineWidth = 1
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh)
  }

  // Playhead line
  const phViewX = KEY_COL_WIDTH + playheadTick * metrics.pxPerTick - scrollLeft
  if (phViewX >= KEY_COL_WIDTH && phViewX <= viewW) {
    ctx.strokeStyle = theme.playheadColor
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(phViewX, RULER_HEIGHT)
    ctx.lineTo(phViewX, viewH)
    ctx.stroke()
  }

  ctx.restore() // end grid clip

  // 3. Sticky left keyboard / drum pad column
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, RULER_HEIGHT, KEY_COL_WIDTH, viewH - RULER_HEIGHT)
  ctx.clip()

  ctx.fillStyle = theme.surface
  ctx.fillRect(0, RULER_HEIGHT, KEY_COL_WIDTH, viewH - RULER_HEIGHT)
  ctx.textBaseline = 'middle'

  for (let pitch = visible.maxPitch; pitch >= visible.minPitch; pitch--) {
    const viewY = pitchToContentY(pitch, metrics) - scrollTop
    if (metrics.isDrum) {
      const lane = DRUM_LANES.find((l) => l.pitch === pitch)
      ctx.fillStyle = theme.textPrimary
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(lane?.label ?? `Drum ${pitch}`, 10, viewY + metrics.rowHeight / 2)
    } else {
      const black = isBlackKey(pitch)
      if (black) {
        ctx.fillStyle = theme.rowAlt
        ctx.fillRect(0, viewY, KEY_COL_WIDTH - 1, metrics.rowHeight)
      }
      const isC = pitch % 12 === 0
      ctx.fillStyle = isC ? theme.textPrimary : theme.textMuted
      ctx.font = isC ? '600 11px sans-serif' : '10px sans-serif'
      if (isC || !black) {
        ctx.fillText(midiToNoteName(pitch), 10, viewY + metrics.rowHeight / 2)
      }
    }
    ctx.strokeStyle = theme.borderSubtle
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, viewY + metrics.rowHeight)
    ctx.lineTo(KEY_COL_WIDTH, viewY + metrics.rowHeight)
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = theme.borderSubtle
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(KEY_COL_WIDTH - 0.5, 0)
  ctx.lineTo(KEY_COL_WIDTH - 0.5, viewH)
  ctx.stroke()

  // 4. Sticky top bar ruler
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
  const firstBar = Math.max(0, Math.floor(visible.startTick / TICKS_PER_BAR))
  const lastBar = Math.min(project.bars - 1, Math.ceil(visible.endTick / TICKS_PER_BAR))
  for (let bar = firstBar; bar <= lastBar; bar++) {
    const viewX = KEY_COL_WIDTH + bar * TICKS_PER_BAR * metrics.pxPerTick - scrollLeft
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
}
