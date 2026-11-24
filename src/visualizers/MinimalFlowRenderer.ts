import { getAudibleTrackIds } from '@core/musicMath'
import { getTrackTypeSpec } from '@core/trackTypes'
import { PPQN, TICKS_PER_BAR, type VisualizerPreset } from '@core/types'
import { drawRoundedRect, pitchToVisualYRatio } from './canvasUtils'
import type { VisualizerFrameState, VisualizerRenderer } from './types'

/**
 * Calm, geometric horizontal note flow with subtle hit ripples and a clean
 * real-time oscilloscope ribbon. Designed for minimal, cohesive aesthetics.
 */
export class MinimalFlowRenderer implements VisualizerRenderer {
  readonly id = 'minimal-flow'
  readonly name = 'Minimal Flow'

  render(
    ctx: CanvasRenderingContext2D,
    frame: VisualizerFrameState,
    preset: VisualizerPreset
  ): void {
    const { width, height, currentTick, project, trackColors, waveform, ripples, nowMs } = frame
    const totalTicks = Math.max(TICKS_PER_BAR, project.bars * TICKS_PER_BAR)

    // 1. Clean background
    ctx.fillStyle = preset.background
    ctx.fillRect(0, 0, width, height)

    const playheadX = width * 0.28
    const visibleTicks = TICKS_PER_BAR * 2
    const pxPerTick = width / visibleTicks

    // 2. Subtle beat & bar guide lines scrolling smoothly
    const startVisibleTick = currentTick - playheadX / pxPerTick
    const firstBeat = Math.floor(startVisibleTick / PPQN) * PPQN
    const endVisibleTick = currentTick + (width - playheadX) / pxPerTick

    ctx.save()
    for (let tick = firstBeat; tick <= endVisibleTick; tick += PPQN) {
      const x = playheadX + (tick - currentTick) * pxPerTick
      const isBar = ((tick % TICKS_PER_BAR) + TICKS_PER_BAR) % TICKS_PER_BAR === 0
      ctx.strokeStyle = preset.gridColor
      ctx.globalAlpha = isBar ? 0.75 : 0.3
      ctx.lineWidth = isBar ? 1.2 : 0.75
      ctx.beginPath()
      ctx.moveTo(x, 48)
      ctx.lineTo(x, height - 48)
      ctx.stroke()
    }
    ctx.restore()

    // 3. Subtle playhead axis
    ctx.save()
    ctx.strokeStyle = preset.waveColor
    ctx.globalAlpha = 0.28
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(playheadX, 40)
    ctx.lineTo(playheadX, height - 40)
    ctx.stroke()
    ctx.restore()

    // 4. Flowing notes across all audible tracks
    const audibleIds = getAudibleTrackIds(project.tracks)
    const padTop = height * 0.14
    const padBottom = height * 0.16
    const usableHeight = height - padTop - padBottom
    const loopOffsets = project.loopEnabled ? [-totalTicks, 0, totalTicks] : [0]

    for (const track of project.tracks) {
      if (!audibleIds.has(track.id)) continue
      const color = trackColors[track.colorIndex % trackColors.length] ?? preset.waveColor
      const isDrum = getTrackTypeSpec(track.type).usesDrumLanes

      for (const offset of loopOffsets) {
        for (const note of track.notes) {
          const nStart = note.startTick + offset
          const nEnd = nStart + note.durationTick
          if (nEnd < startVisibleTick || nStart > endVisibleTick) continue

          const x = playheadX + (nStart - currentTick) * pxPerTick
          const w = Math.max(8, note.durationTick * pxPerTick)
          const yRatio = pitchToVisualYRatio(note.pitch, isDrum)
          const y = padTop + yRatio * usableHeight
          const h = isDrum ? 8 : 12
          const isActive = nStart <= currentTick && nEnd >= currentTick

          ctx.save()
          ctx.fillStyle = color
          ctx.globalAlpha = isActive ? 1.0 : preset.noteOpacity * 0.62
          drawRoundedRect(ctx, x, y - h / 2, w, h, h / 2)
          ctx.fill()

          if (isActive) {
            ctx.strokeStyle = color
            ctx.globalAlpha = 0.45
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(playheadX, y, h * 0.95, 0, Math.PI * 2)
            ctx.stroke()
          }
          ctx.restore()
        }
      }
    }

    // 5. Calm expanding ripples on note trigger
    for (const ripple of ripples) {
      const age = (nowMs - ripple.createdAtMs) / 700
      if (age < 0 || age >= 1) continue
      const eased = 1 - Math.pow(1 - age, 3)
      const radius = (10 + eased * 44 * preset.rippleScale) * ripple.strength
      ctx.save()
      ctx.strokeStyle = ripple.color
      ctx.globalAlpha = (1 - age) * 0.42
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(playheadX, padTop + ripple.yRatio * usableHeight, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 6. Clean oscilloscope waveform ribbon near the bottom
    if (preset.showWaveform && waveform.length > 0) {
      const baseY = height - 44
      const amp = 20
      ctx.save()
      ctx.strokeStyle = preset.waveColor
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1.6
      ctx.beginPath()
      const step = width / waveform.length
      for (let i = 0; i < waveform.length; i++) {
        const v = (waveform[i] - 128) / 128
        const x = i * step
        const y = baseY + v * amp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }
}
