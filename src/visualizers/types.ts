import type { Project, VisualizerPreset } from '@core/types'

export interface ActiveRipple {
  xRatio: number
  yRatio: number
  color: string
  createdAtMs: number
  strength: number
}

export interface VisualizerFrameState {
  width: number
  height: number
  nowMs: number
  currentTick: number
  isPlaying: boolean
  project: Project
  trackColors: readonly string[]
  waveform: Uint8Array<ArrayBuffer>
  ripples: readonly ActiveRipple[]
}

/**
 * Pluggable Stage Mode renderer interface.
 * Additional visual styles (neon, falling keys, geometric, etc.) can be registered
 * without touching React components.
 */
export interface VisualizerRenderer {
  readonly id: string
  readonly name: string
  render(
    ctx: CanvasRenderingContext2D,
    frame: VisualizerFrameState,
    preset: VisualizerPreset
  ): void
}
