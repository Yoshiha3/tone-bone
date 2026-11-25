export const PPQN = 480
export const BEATS_PER_BAR = 4
export const TICKS_PER_BAR = PPQN * BEATS_PER_BAR // 1920
export const MAX_BARS = 999

export type GridDivision = '1/4' | '1/8' | '1/16' | '1/32' | '1/6' | '1/12' | '1/24'

export interface GridDivisionOption {
  value: GridDivision
  label: string
  stepsPerBar: number
  isTriplet: boolean
}

export const GRID_DIVISIONS: readonly GridDivisionOption[] = [
  { value: '1/4', label: '1/4', stepsPerBar: 4, isTriplet: false },
  { value: '1/8', label: '1/8', stepsPerBar: 8, isTriplet: false },
  { value: '1/16', label: '1/16', stepsPerBar: 16, isTriplet: false },
  { value: '1/32', label: '1/32', stepsPerBar: 32, isTriplet: false },
  { value: '1/6', label: '1/6 (3連)', stepsPerBar: 6, isTriplet: true },
  { value: '1/12', label: '1/12 (3連)', stepsPerBar: 12, isTriplet: true },
  { value: '1/24', label: '1/24 (3連)', stepsPerBar: 24, isTriplet: true }
] as const

export type TrackType = 'synth' | 'drum'

export interface Note {
  id: string
  /** MIDI note number (0-127) for synth, or DrumLane pitch (0 .. DRUM_LANES.length - 1) for drum */
  pitch: number
  startTick: number
  durationTick: number
  /** 0.0 - 1.0 */
  velocity: number
}

export interface Track {
  id: string
  name: string
  type: TrackType
  instrumentId: string
  /** Index into theme track palette (--track-color-0 .. 5) */
  colorIndex: number
  /** 0.0 - 1.0 */
  volume: number
  muted: boolean
  solo: boolean
  notes: Note[]
}

export interface Project {
  title: string
  bpm: number
  bars: number
  loopEnabled: boolean
  tracks: Track[]
}

export interface DrumLane {
  pitch: number
  id: string
  label: string
  shortLabel: string
}

export const DRUM_LANES = [
  { pitch: 0, id: 'kick', label: 'Kick', shortLabel: 'BD' },
  { pitch: 1, id: 'snare', label: 'Snare', shortLabel: 'SD' },
  { pitch: 2, id: 'hihat-closed', label: 'Closed HH', shortLabel: 'CH' },
  { pitch: 3, id: 'hihat-open', label: 'Open HH', shortLabel: 'OH' },
  { pitch: 4, id: 'clap', label: 'Clap', shortLabel: 'CP' },
  { pitch: 5, id: 'rim', label: 'Rim', shortLabel: 'RM' },
  { pitch: 6, id: 'tom-low', label: 'Low Tom', shortLabel: 'LT' },
  { pitch: 7, id: 'tom-high', label: 'High Tom', shortLabel: 'HT' },
  { pitch: 8, id: 'cymbal', label: 'Cymbal', shortLabel: 'CY' }
] as const satisfies readonly DrumLane[]

export type DrumLaneId = (typeof DRUM_LANES)[number]['id']

export type SynthWaveform = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface SynthParams {
  waveform: SynthWaveform
  attack: number
  decay: number
  sustain: number
  release: number
  filterCutoff?: number
  detuneCents?: number
  gainScale?: number
}

export interface InstrumentDef {
  id: string
  name: string
  type: TrackType
  synth?: SynthParams
}

export interface VisualizerPreset {
  rendererId: string
  background: string
  waveColor: string
  gridColor: string
  noteOpacity: number
  rippleScale: number
  showWaveform: boolean
}

export const DEFAULT_THEME_PACK_ID = 'minimal-light'
export const DEFAULT_SOUND_PACK_ID = 'default-sounds'

export interface PackMetadata {
  id: string
  name: string
  version: string
  author: string
  description: string
}

export interface BasePack {
  meta: PackMetadata
  source: 'builtin' | 'user'
  path: string
}

export interface ThemePack extends BasePack {
  tokens: Record<string, string>
  overrideCss: string
  visualizer?: Partial<VisualizerPreset>
}

export interface SoundPack extends BasePack {
  instruments: InstrumentDef[]
}

export interface MergedThemeConfig {
  activeThemePackIds: string[]
  tokens: Record<string, string>
  overrideCss: string
  visualizer: VisualizerPreset
}

export interface MergedSoundConfig {
  activeSoundPackIds: string[]
  instruments: InstrumentDef[]
}

export type WorkspaceFolderTarget = 'workspace' | 'projects' | 'exports' | 'themes' | 'sounds'

export type NoteLengthMode = 'last-used' | 'grid-step'

export type SaveMode = 'auto' | 'manual'

export interface ProjectSummary {
  filePath: string
  fileName: string
  title: string
  bpm: number
  bars: number
  trackCount: number
  updatedAtMs: number
}

export interface AppSettings {
  workspaceDir: string
  activeThemePackIds: string[]
  activeSoundPackIds: string[]
  noteLengthMode: NoteLengthMode
  saveMode: SaveMode
}
