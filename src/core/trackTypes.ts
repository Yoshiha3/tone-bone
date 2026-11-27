import { DRUM_LANES, type TrackType } from './types'

export type PitchDomain = 'melodic' | 'drum'

export interface TrackTypeSpec {
  readonly type: TrackType
  readonly pitchDomain: PitchDomain
  readonly addButtonLabel: string
  readonly defaultNamePrefix: string
  readonly defaultInstrumentId: string
  readonly minPitch: number
  readonly maxPitch: number
  readonly supportsNoteResize: boolean
  readonly remembersLastNoteDuration: boolean
  readonly previewVelocity: number
  readonly usesDrumLanes: boolean
}

/**
 * Single source of truth for per-TrackType metadata and editing rules.
 * Adding a new TrackType only requires extending this table and registering its AudioVoice.
 */
export const TRACK_TYPE_SPECS: Record<TrackType, TrackTypeSpec> = {
  synth: {
    type: 'synth',
    pitchDomain: 'melodic',
    addButtonLabel: '+ Synth',
    defaultNamePrefix: 'Synth',
    defaultInstrumentId: 'soft-sine',
    minPitch: 24,
    maxPitch: 96,
    supportsNoteResize: true,
    remembersLastNoteDuration: true,
    previewVelocity: 0.8,
    usesDrumLanes: false
  },
  drum: {
    type: 'drum',
    pitchDomain: 'drum',
    addButtonLabel: '+ Drum',
    defaultNamePrefix: 'Rhythm',
    defaultInstrumentId: 'basic-kit',
    minPitch: 0,
    maxPitch: DRUM_LANES.length - 1,
    supportsNoteResize: false,
    remembersLastNoteDuration: false,
    previewVelocity: 0.85,
    usesDrumLanes: true
  }
}

export const TRACK_TYPES: readonly TrackTypeSpec[] = Object.values(TRACK_TYPE_SPECS)

export function getTrackTypeSpec(type: TrackType): TrackTypeSpec {
  return TRACK_TYPE_SPECS[type]
}

export function canPasteNotesBetween(sourceType: TrackType, targetType: TrackType): boolean {
  return TRACK_TYPE_SPECS[sourceType].pitchDomain === TRACK_TYPE_SPECS[targetType].pitchDomain
}
