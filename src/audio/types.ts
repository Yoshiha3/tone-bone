import type { InstrumentDef, Note, Project, TrackType } from '@core/types'

export interface VoiceTriggerParams {
  context: BaseAudioContext
  destination: AudioNode
  pitch: number
  startTime: number
  durationSeconds: number
  velocity: number
  instrument?: InstrumentDef
}

export interface AudioVoice {
  readonly type: TrackType
  trigger(params: VoiceTriggerParams): void
}

export interface NoteTriggerEvent {
  trackId: string
  colorIndex: number
  note: Note
  scheduledTime: number
}

export interface AudioExporter {
  readonly id: string
  readonly extension: string
  export(project: Project, instruments: readonly InstrumentDef[]): Promise<Uint8Array>
}
