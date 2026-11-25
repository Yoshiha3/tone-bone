import { TRACK_TYPE_SPECS } from '@core/trackTypes'
import { DRUM_LANES } from '@core/types'

/**
 * Traces a rounded rectangle path on a 2D canvas context.
 */
export function drawRoundedRect(
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

/**
 * Maps a synth MIDI pitch or drum lane pitch to a normalized vertical ratio [0..1]
 * used consistently by Stage Mode renderers and ripple emitters.
 */
export function pitchToVisualYRatio(pitch: number, isDrum: boolean): number {
  if (isDrum) {
    return 0.84 - (pitch / Math.max(1, DRUM_LANES.length)) * 0.18
  }
  const { minPitch, maxPitch } = TRACK_TYPE_SPECS.synth
  const norm = (pitch - minPitch) / Math.max(1, maxPitch - minPitch)
  return 0.76 - Math.max(0, Math.min(1, norm)) * 0.68
}
