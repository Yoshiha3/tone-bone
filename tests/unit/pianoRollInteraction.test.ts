import { describe, expect, it, vi } from 'vitest'
import { PPQN, type Note, type Track } from '@core/types'
import {
  createPianoRollMetrics,
  KEY_COL_WIDTH,
  pitchToContentY,
  RULER_HEIGHT
} from '@renderer/components/pianoRoll/pianoRollGeometry'
import {
  createInteractionSession,
  finishPianoRollDrag,
  handlePianoRollPointerDown,
  handlePianoRollPointerMove,
  PIANO_ROLL_TOOLS,
  type InteractionEnv
} from '@renderer/components/pianoRoll/pianoRollInteraction'

function makeEnv(overrides: Partial<InteractionEnv> = {}): {
  env: InteractionEnv
  notes: Note[]
} {
  const notes: Note[] = overrides.track?.notes ? [...overrides.track.notes] : []
  const track: Track = overrides.track ?? {
    id: 't-synth',
    name: 'Synth 1',
    type: 'synth',
    instrumentId: 'soft-sine',
    colorIndex: 0,
    volume: 0.8,
    muted: false,
    solo: false,
    notes
  }
  const metrics = createPianoRollMetrics(track.type === 'drum', 4, 96)

  const env: InteractionEnv = {
    track,
    metrics,
    gridDivision: '1/16',
    toolMode: 'draw',
    selectedNoteIds: [],
    noteLengthMode: 'last-used',
    lastNoteDurationTick: PPQN / 2,
    addNote: vi.fn((_trackId, input) => {
      const created: Note = { ...input, id: `n-${notes.length + 1}` }
      notes.push(created)
      return created
    }),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    setSelectedNoteIds: vi.fn(),
    setLastNoteDurationTick: vi.fn(),
    commitTrackNotes: vi.fn(),
    getLatestTrackNotes: () => notes,
    seek: vi.fn(),
    previewNote: vi.fn(),
    ...overrides
  }
  return { env, notes }
}

describe('pianoRollInteraction', () => {
  it('exposes draw and select tools declaratively', () => {
    expect(PIANO_ROLL_TOOLS.map((t) => t.id)).toEqual(['draw', 'select'])
  })

  it('seeks on ruler click and previews note on piano keyboard column click', () => {
    const session = createInteractionSession()
    const { env } = makeEnv()

    // Click in ruler at beat 1 (tick 480)
    const beat1X = KEY_COL_WIDTH + PPQN * env.metrics.pxPerTick + 5
    handlePianoRollPointerDown(
      session,
      { viewX: beat1X, viewY: 10, contentX: beat1X, contentY: 10 },
      { button: 0, shiftKey: false },
      env
    )
    expect(env.seek).toHaveBeenCalledWith(PPQN)

    // Click in keyboard column on pitch 60 (C4)
    const c4Y = pitchToContentY(60, env.metrics) + 5
    handlePianoRollPointerDown(
      session,
      { viewX: 20, viewY: c4Y, contentX: 20, contentY: c4Y },
      { button: 0, shiftKey: false },
      env
    )
    expect(env.previewNote).toHaveBeenCalledWith(env.track, 60)
  })

  it('creates a synth note, stretches duration on drag past threshold, and commits via updateNote', () => {
    const session = createInteractionSession()
    const { env } = makeEnv({ noteLengthMode: 'last-used', lastNoteDurationTick: 240 })

    const startX = KEY_COL_WIDTH + 4 // tick 0
    const c4Y = pitchToContentY(60, env.metrics) + 5

    handlePianoRollPointerDown(
      session,
      { viewX: startX, viewY: c4Y, contentX: startX, contentY: c4Y },
      { button: 0, shiftKey: false },
      env
    )
    expect(env.addNote).toHaveBeenCalledWith('t-synth', {
      pitch: 60,
      startTick: 0,
      durationTick: 240,
      velocity: 0.8
    })
    expect(session.drag.kind).toBe('create')

    // Drag right to beat 1 (tick 480)
    const beat1X = KEY_COL_WIDTH + PPQN * env.metrics.pxPerTick
    handlePianoRollPointerMove(session, { contentX: beat1X, contentY: c4Y }, env)
    expect(session.previewNotes?.[0].durationTick).toBe(PPQN)

    finishPianoRollDrag(session, env)
    expect(env.updateNote).toHaveBeenCalledWith('t-synth', 'n-1', { durationTick: PPQN })
    expect(session.drag.kind).toBe('none')
    expect(session.previewNotes).toBeNull()
  })

  it('deletes hit note on right click, resizes on right-edge drag, and moves notes on body drag', () => {
    const existing: Note = {
      id: 'n-existing',
      pitch: 60,
      startTick: 0,
      durationTick: PPQN,
      velocity: 0.8
    }
    const { env } = makeEnv({
      track: {
        id: 't-synth',
        name: 'Synth',
        type: 'synth',
        instrumentId: 'soft-sine',
        colorIndex: 0,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: [existing]
      }
    })
    const session = createInteractionSession()
    const c4Y = pitchToContentY(60, env.metrics) + 5
    const bodyX = KEY_COL_WIDTH + 15
    const rightEdgeX = KEY_COL_WIDTH + PPQN * env.metrics.pxPerTick - 2

    // Right click deletes note
    handlePianoRollPointerDown(
      session,
      { viewX: bodyX, viewY: c4Y, contentX: bodyX, contentY: c4Y },
      { button: 2, shiftKey: false },
      env
    )
    expect(env.deleteNote).toHaveBeenCalledWith('t-synth', 'n-existing')

    // Drag right edge resizes note
    handlePianoRollPointerDown(
      session,
      { viewX: rightEdgeX, viewY: c4Y, contentX: rightEdgeX, contentY: c4Y },
      { button: 0, shiftKey: false },
      env
    )
    expect(session.drag.kind).toBe('resize')
    handlePianoRollPointerMove(
      session,
      { contentX: KEY_COL_WIDTH + PPQN * 2 * env.metrics.pxPerTick, contentY: c4Y },
      env
    )
    finishPianoRollDrag(session, env)
    expect(env.updateNote).toHaveBeenCalledWith('t-synth', 'n-existing', {
      durationTick: PPQN * 2
    })

    // Drag body moves note by +1 beat and +2 semitones
    handlePianoRollPointerDown(
      session,
      { viewX: bodyX, viewY: c4Y, contentX: bodyX, contentY: c4Y },
      { button: 0, shiftKey: false },
      env
    )
    expect(session.drag.kind).toBe('move')
    handlePianoRollPointerMove(
      session,
      {
        contentX: bodyX + PPQN * env.metrics.pxPerTick,
        contentY: c4Y - 2 * env.metrics.rowHeight
      },
      env
    )
    finishPianoRollDrag(session, env)
    expect(env.commitTrackNotes).toHaveBeenCalledWith('t-synth', [
      expect.objectContaining({ id: 'n-existing', startTick: PPQN, pitch: 62 })
    ])
  })

  it('selects notes inside marquee rectangle and disables create-resize drag on drum tracks', () => {
    const n1: Note = { id: 'n1', pitch: 60, startTick: 0, durationTick: 240, velocity: 0.8 }
    const n2: Note = { id: 'n2', pitch: 72, startTick: 960, durationTick: 240, velocity: 0.8 }
    const { env } = makeEnv({
      toolMode: 'select',
      track: {
        id: 't-synth',
        name: 'Synth',
        type: 'synth',
        instrumentId: 'soft-sine',
        colorIndex: 0,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: [n1, n2]
      }
    })
    const session = createInteractionSession()

    const x1 = KEY_COL_WIDTH + 1
    const y1 = pitchToContentY(62, env.metrics)
    const x2 = KEY_COL_WIDTH + 300 * env.metrics.pxPerTick
    const y2 = pitchToContentY(58, env.metrics)

    handlePianoRollPointerDown(
      session,
      { viewX: x1, viewY: y1, contentX: x1, contentY: y1 },
      { button: 0, shiftKey: false },
      env
    )
    expect(session.drag.kind).toBe('marquee')
    handlePianoRollPointerMove(session, { contentX: x2, contentY: y2 }, env)
    expect(session.marquee).toEqual({ x1, y1, x2, y2 })
    finishPianoRollDrag(session, env)
    expect(env.setSelectedNoteIds).toHaveBeenLastCalledWith(['n1'])

    // Drum track uses grid step and never enters create drag
    const drumHarness = makeEnv({
      track: {
        id: 't-drum',
        name: 'Drum',
        type: 'drum',
        instrumentId: 'basic-kit',
        colorIndex: 1,
        volume: 0.8,
        muted: false,
        solo: false,
        notes: []
      }
    })
    const drumY = RULER_HEIGHT + 10
    handlePianoRollPointerDown(
      session,
      { viewX: KEY_COL_WIDTH + 5, viewY: drumY, contentX: KEY_COL_WIDTH + 5, contentY: drumY },
      { button: 0, shiftKey: false },
      drumHarness.env
    )
    expect(drumHarness.env.addNote).toHaveBeenCalledTimes(1)
    expect(session.drag.kind).toBe('none')
  })
})
