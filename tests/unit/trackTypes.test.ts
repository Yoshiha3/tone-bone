import { describe, expect, it } from 'vitest'
import {
  canPasteNotesBetween,
  getTrackTypeSpec,
  TRACK_TYPE_SPECS,
  TRACK_TYPES
} from '@core/trackTypes'
import { DRUM_LANES } from '@core/types'

describe('trackTypes metadata', () => {
  it('exposes consistent TrackType specs for synth and drum', () => {
    expect(TRACK_TYPES.map((s) => s.type)).toEqual(['synth', 'drum'])
    expect(getTrackTypeSpec('synth')).toBe(TRACK_TYPE_SPECS.synth)
    expect(getTrackTypeSpec('drum')).toBe(TRACK_TYPE_SPECS.drum)

    const synth = getTrackTypeSpec('synth')
    expect(synth.pitchDomain).toBe('melodic')
    expect(synth.minPitch).toBeLessThan(synth.maxPitch)
    expect(synth.supportsNoteResize).toBe(true)
    expect(synth.remembersLastNoteDuration).toBe(true)
    expect(synth.usesDrumLanes).toBe(false)

    const drum = getTrackTypeSpec('drum')
    expect(drum.pitchDomain).toBe('drum')
    expect(drum.minPitch).toBe(0)
    expect(drum.maxPitch).toBe(DRUM_LANES.length - 1)
    expect(drum.supportsNoteResize).toBe(false)
    expect(drum.remembersLastNoteDuration).toBe(false)
    expect(drum.usesDrumLanes).toBe(true)
  })

  it('allows pasting only between tracks sharing the same pitch domain', () => {
    expect(canPasteNotesBetween('synth', 'synth')).toBe(true)
    expect(canPasteNotesBetween('drum', 'drum')).toBe(true)
    expect(canPasteNotesBetween('drum', 'synth')).toBe(false)
    expect(canPasteNotesBetween('synth', 'drum')).toBe(false)
  })
})
