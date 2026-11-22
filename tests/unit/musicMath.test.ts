import { describe, expect, it } from 'vitest'
import {
  cloneNotesForPaste,
  findNotesInRect,
  getAudibleTrackIds,
  getGridTickStep,
  midiToFrequency,
  midiToNoteName,
  moveNotes,
  secondsToTicks,
  snapTick,
  ticksToSeconds
} from '@core/musicMath'
import { PPQN, TICKS_PER_BAR, type Note, type Track } from '@core/types'

describe('musicMath', () => {
  it('computes exact integer tick steps for standard and triplet grid divisions', () => {
    expect(getGridTickStep('1/4')).toBe(480)
    expect(getGridTickStep('1/8')).toBe(240)
    expect(getGridTickStep('1/16')).toBe(120)
    expect(getGridTickStep('1/32')).toBe(60)
    // Triplets divide 1920 cleanly with zero floating-point drift
    expect(getGridTickStep('1/6')).toBe(320)
    expect(getGridTickStep('1/12')).toBe(160)
    expect(getGridTickStep('1/24')).toBe(80)
  })

  it('snaps ticks accurately for both 1/16 and 1/12 triplets', () => {
    expect(snapTick(115, '1/16')).toBe(120)
    expect(snapTick(155, '1/12')).toBe(160)
    expect(snapTick(310, '1/12')).toBe(320)
    expect(snapTick(-20, '1/16')).toBe(0)
  })

  it('converts ticks and seconds accurately at given BPM', () => {
    // At 120 BPM, 1 beat (480 ticks) = 0.5 seconds
    expect(ticksToSeconds(PPQN, 120)).toBeCloseTo(0.5, 6)
    expect(secondsToTicks(0.5, 120)).toBeCloseTo(PPQN, 6)
    expect(ticksToSeconds(TICKS_PER_BAR, 120)).toBeCloseTo(2.0, 6)
  })

  it('converts MIDI notes to frequencies and note names', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6)
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3)
    expect(midiToNoteName(60)).toBe('C4')
    expect(midiToNoteName(69)).toBe('A4')
    expect(midiToNoteName(61)).toBe('C#4')
  })

  it('finds notes inside a marquee selection rect', () => {
    const notes: Note[] = [
      { id: 'n1', pitch: 60, startTick: 0, durationTick: 240, velocity: 0.8 },
      { id: 'n2', pitch: 64, startTick: 480, durationTick: 240, velocity: 0.8 },
      { id: 'n3', pitch: 72, startTick: 960, durationTick: 240, velocity: 0.8 }
    ]
    const selected = findNotesInRect(notes, {
      minTick: 200,
      maxTick: 600,
      minPitch: 60,
      maxPitch: 66
    })
    expect(selected).toEqual(['n1', 'n2'])
  })

  it('moves selected notes together and clamps within bounds', () => {
    const notes: Note[] = [
      { id: 'n1', pitch: 60, startTick: 240, durationTick: 240, velocity: 0.8 },
      { id: 'n2', pitch: 64, startTick: 480, durationTick: 240, velocity: 0.8 }
    ]
    const moved = moveNotes(notes, new Set(['n1']), 160, 2, 0, 127, TICKS_PER_BAR * 4)
    expect(moved[0].startTick).toBe(400)
    expect(moved[0].pitch).toBe(62)
    expect(moved[1]).toEqual(notes[1])
  })

  it('clones copied notes preserving relative timing offsets', () => {
    const copied: Note[] = [
      { id: 'a', pitch: 60, startTick: 480, durationTick: 160, velocity: 0.8 },
      { id: 'b', pitch: 64, startTick: 640, durationTick: 160, velocity: 0.8 }
    ]
    let seq = 1
    const pasted = cloneNotesForPaste(copied, 960, TICKS_PER_BAR * 4, () => `copy-${seq++}`)
    expect(pasted).toEqual([
      { id: 'copy-1', pitch: 60, startTick: 960, durationTick: 160, velocity: 0.8 },
      { id: 'copy-2', pitch: 64, startTick: 1120, durationTick: 160, velocity: 0.8 }
    ])
  })

  it('resolves DAW Mute and Solo states accurately', () => {
    const baseTrack = (id: string, muted: boolean, solo: boolean): Track => ({
      id,
      name: id,
      type: 'synth',
      instrumentId: 'soft-sine',
      colorIndex: 0,
      volume: 0.8,
      muted,
      solo,
      notes: []
    })

    // No solo: all non-muted tracks play
    const normal = getAudibleTrackIds([
      baseTrack('t1', false, false),
      baseTrack('t2', true, false)
    ])
    expect([...normal]).toEqual(['t1'])

    // With solo: only solo & non-muted tracks play
    const soloed = getAudibleTrackIds([
      baseTrack('t1', false, false),
      baseTrack('t2', false, true),
      baseTrack('t3', true, true)
    ])
    expect([...soloed]).toEqual(['t2'])
  })
})
