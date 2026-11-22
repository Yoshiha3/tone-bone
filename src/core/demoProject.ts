import { PPQN, TICKS_PER_BAR, type Note, type Project } from './types'

function n(id: string, pitch: number, bar: number, beatOffset: number, durationBeats: number, velocity = 0.8): Note {
  return {
    id,
    pitch,
    startTick: Math.round((bar - 1) * TICKS_PER_BAR + beatOffset * PPQN),
    durationTick: Math.round(durationBeats * PPQN),
    velocity
  }
}

/**
 * A calm, pleasant 4-bar starter sketch featuring electronic melody, warm bass,
 * and a light rhythm track (including an 8th-note triplet fill in bar 4).
 */
export function createDemoProject(): Project {
  const melodyNotes: Note[] = [
    // Bar 1: Cmaj7 arpeggio
    n('m-1', 64, 1, 0, 0.75), // E4
    n('m-2', 67, 1, 1, 0.75), // G4
    n('m-3', 71, 1, 2, 1.0), // B4
    n('m-4', 69, 1, 3, 0.75), // A4
    // Bar 2: Fmaj7
    n('m-5', 65, 2, 0, 1.5), // F4
    n('m-6', 69, 2, 1.5, 0.5), // A4
    n('m-7', 67, 2, 2, 1.5), // G4
    // Bar 3: Dm7 -> G7
    n('m-8', 62, 3, 0, 0.75), // D4
    n('m-9', 65, 3, 1, 0.75), // F4
    n('m-10', 69, 3, 2, 0.75), // A4
    n('m-11', 67, 3, 3, 0.75), // G4
    // Bar 4: Triplet turnaround (8th-note triplet = 1/3 beat each)
    n('m-12', 72, 4, 0, 1.5), // C5
    n('m-13', 71, 4, 2, 1 / 3), // B4
    n('m-14', 69, 4, 2 + 1 / 3, 1 / 3), // A4
    n('m-15', 67, 4, 2 + 2 / 3, 1 / 3), // G4
    n('m-16', 64, 4, 3, 1.0) // E4
  ]

  const bassNotes: Note[] = [
    n('b-1', 48, 1, 0, 2.0, 0.75), // C3
    n('b-2', 48, 1, 2.5, 1.0, 0.7),
    n('b-3', 41, 2, 0, 2.0, 0.75), // F2
    n('b-4', 43, 2, 2.5, 1.0, 0.7), // G2
    n('b-5', 50, 3, 0, 2.0, 0.75), // D3
    n('b-6', 43, 3, 2, 1.5, 0.75), // G2
    n('b-7', 48, 4, 0, 3.5, 0.75) // C3
  ]

  const drumNotes: Note[] = []
  let dIdx = 1
  for (let bar = 1; bar <= 4; bar++) {
    // Kick on 1 and 3 (plus syncopated 2.5 on bars 2 & 4)
    drumNotes.push(n(`d-${dIdx++}`, 0, bar, 0, 0.25, 0.9))
    drumNotes.push(n(`d-${dIdx++}`, 0, bar, 2, 0.25, 0.85))
    if (bar % 2 === 0) {
      drumNotes.push(n(`d-${dIdx++}`, 0, bar, 2.5, 0.25, 0.7))
    }
    // Snare on 2 and 4
    drumNotes.push(n(`d-${dIdx++}`, 1, bar, 1, 0.25, 0.8))
    drumNotes.push(n(`d-${dIdx++}`, 1, bar, 3, 0.25, 0.85))
    // Closed Hi-Hat on every 8th note
    for (let step = 0; step < 8; step++) {
      const isOffbeat = step % 2 === 1
      drumNotes.push(n(`d-${dIdx++}`, 2, bar, step * 0.5, 0.25, isOffbeat ? 0.45 : 0.65))
    }
  }

  return {
    title: 'Simple Sketch',
    bpm: 112,
    bars: 4,
    loopEnabled: true,
    tracks: [
      {
        id: 'track-melody',
        name: 'Melody',
        type: 'synth',
        instrumentId: 'soft-sine',
        colorIndex: 0,
        volume: 0.78,
        muted: false,
        solo: false,
        notes: melodyNotes
      },
      {
        id: 'track-bass',
        name: 'Bass',
        type: 'synth',
        instrumentId: 'warm-triangle',
        colorIndex: 1,
        volume: 0.72,
        muted: false,
        solo: false,
        notes: bassNotes
      },
      {
        id: 'track-rhythm',
        name: 'Rhythm',
        type: 'drum',
        instrumentId: 'basic-kit',
        colorIndex: 2,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: drumNotes
      }
    ]
  }
}

export function createEmptyProject(): Project {
  return {
    title: 'Untitled',
    bpm: 120,
    bars: 4,
    loopEnabled: true,
    tracks: [
      {
        id: 'track-synth-1',
        name: 'Synth 1',
        type: 'synth',
        instrumentId: 'soft-sine',
        colorIndex: 0,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: []
      },
      {
        id: 'track-rhythm-1',
        name: 'Rhythm 1',
        type: 'drum',
        instrumentId: 'basic-kit',
        colorIndex: 1,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: []
      }
    ]
  }
}
