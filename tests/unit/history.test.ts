import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory
} from '@core/history'

describe('history', () => {
  it('supports push, undo, redo, and clears future on new push', () => {
    let h = createHistory(1, 5)
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)

    h = pushHistory(h, 2)
    h = pushHistory(h, 3)
    expect(h.present).toBe(3)
    expect(canUndo(h)).toBe(true)

    h = undoHistory(h)
    expect(h.present).toBe(2)
    expect(canRedo(h)).toBe(true)

    h = redoHistory(h)
    expect(h.present).toBe(3)

    h = undoHistory(h)
    h = pushHistory(h, 99)
    expect(h.present).toBe(99)
    expect(canRedo(h)).toBe(false)
  })

  it('respects maxSize cap', () => {
    let h = createHistory(0, 2)
    h = pushHistory(h, 1)
    h = pushHistory(h, 2)
    h = pushHistory(h, 3)
    expect(h.past).toEqual([1, 2])
  })
})
