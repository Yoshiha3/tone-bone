import { describe, expect, it } from 'vitest'
import { getTrackTypeSpec, TRACK_TYPE_SPECS, TRACK_TYPES } from '@core/trackTypes'
import { DRUM_LANES } from '@core/types'

describe('trackTypes metadata', () => {
  it('exposes consistent TrackType specs for synth and drum', () => {
    expect(TRACK_TYPES.map((s) => s.type)).toEqual(['synth', 'drum'])
    expect(getTrackTypeSpec('synth')).toBe(TRACK_TYPE_SPECS.synth)
    expect(getTrackTypeSpec('drum')).toBe(TRACK_TYPE_SPECS.drum)

    const synth = getTrackTypeSpec('synth')
    expect(synth.minPitch).toBeLessThan(synth.maxPitch)
    expect(synth.supportsNoteResize).toBe(true)
    expect(synth.remembersLastNoteDuration).toBe(true)
    expect(synth.usesDrumLanes).toBe(false)

    const drum = getTrackTypeSpec('drum')
    expect(drum.minPitch).toBe(0)
    expect(drum.maxPitch).toBe(DRUM_LANES.length - 1)
    expect(drum.supportsNoteResize).toBe(false)
    expect(drum.remembersLastNoteDuration).toBe(false)
    expect(drum.usesDrumLanes).toBe(true)
  })
})
