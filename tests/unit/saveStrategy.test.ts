import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebouncedAutoSaveStrategy } from '@persistence/DebouncedAutoSaveStrategy'
import { ManualSaveStrategy } from '@persistence/ManualSaveStrategy'
import { createDefaultSaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import type { LeaveDecision, SaveContext } from '@persistence/types'

describe('SaveStrategy (pluggable persistence policies)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid edits into a single quiet save and flushes on leave', async () => {
    const strategy = new DebouncedAutoSaveStrategy(500)
    let dirty = true
    const saveQuietly = vi.fn(async () => {
      dirty = false
      return true
    })
    const saveExplicitly = vi.fn(async () => true)
    const askLeaveDecision = vi.fn(async (): Promise<LeaveDecision> => 'cancel')

    const getCtx = (): SaveContext => ({
      hasFilePath: true,
      isDirty: dirty,
      saveQuietly,
      saveExplicitly,
      askLeaveDecision
    })

    strategy.onProjectChanged(getCtx)
    vi.advanceTimersByTime(300)
    strategy.onProjectChanged(getCtx)
    vi.advanceTimersByTime(300)
    expect(saveQuietly).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    expect(saveQuietly).toHaveBeenCalledTimes(1)
    expect(dirty).toBe(false)

    // Another edit followed by immediate leave should flush without waiting for timer
    dirty = true
    strategy.onProjectChanged(getCtx)
    const canLeave = await strategy.prepareLeave(getCtx)
    expect(canLeave).toBe(true)
    expect(saveQuietly).toHaveBeenCalledTimes(2)
    expect(askLeaveDecision).not.toHaveBeenCalled()

    // Pending timer must have been cleared
    vi.advanceTimersByTime(1000)
    expect(saveQuietly).toHaveBeenCalledTimes(2)
  })

  it('prompts save/discard/cancel in auto mode when dirty project has no file path', async () => {
    const strategy = new DebouncedAutoSaveStrategy(500)
    const saveQuietly = vi.fn(async () => true)
    const saveExplicitly = vi.fn(async () => true)
    let decision: LeaveDecision = 'cancel'
    const askLeaveDecision = vi.fn(async () => decision)

    const getCtx = (): SaveContext => ({
      hasFilePath: false,
      isDirty: true,
      saveQuietly,
      saveExplicitly,
      askLeaveDecision
    })

    strategy.onProjectChanged(getCtx)
    vi.advanceTimersByTime(1000)
    expect(saveQuietly).not.toHaveBeenCalled()

    expect(await strategy.prepareLeave(getCtx)).toBe(false)
    decision = 'save'
    expect(await strategy.prepareLeave(getCtx)).toBe(true)
    expect(saveExplicitly).toHaveBeenCalledTimes(1)
  })

  it('supports save, discard, and cancel decisions in manual mode', async () => {
    const strategy = new ManualSaveStrategy()
    const saveQuietly = vi.fn(async () => true)
    let saveResult = true
    const saveExplicitly = vi.fn(async () => saveResult)
    let decision: LeaveDecision = 'cancel'
    const askLeaveDecision = vi.fn(async () => decision)

    let dirty = true
    const getCtx = (): SaveContext => ({
      hasFilePath: true,
      isDirty: dirty,
      saveQuietly,
      saveExplicitly,
      askLeaveDecision
    })

    strategy.onProjectChanged(getCtx)
    vi.advanceTimersByTime(5000)
    expect(saveQuietly).not.toHaveBeenCalled()

    // Cancel keeps user in editor
    decision = 'cancel'
    expect(await strategy.prepareLeave(getCtx)).toBe(false)

    // Save calls saveExplicitly; if save is canceled, leave is aborted
    decision = 'save'
    saveResult = false
    expect(await strategy.prepareLeave(getCtx)).toBe(false)
    saveResult = true
    expect(await strategy.prepareLeave(getCtx)).toBe(true)
    expect(saveExplicitly).toHaveBeenCalledTimes(2)

    // Discard leaves without saving
    decision = 'discard'
    expect(await strategy.prepareLeave(getCtx)).toBe(true)
    expect(saveExplicitly).toHaveBeenCalledTimes(2)

    // Clean project leaves without asking
    dirty = false
    const callsBeforeClean = askLeaveDecision.mock.calls.length
    expect(await strategy.prepareLeave(getCtx)).toBe(true)
    expect(askLeaveDecision).toHaveBeenCalledTimes(callsBeforeClean)
  })

  it('registers auto (default) and manual strategies in SaveStrategyRegistry', () => {
    const registry = createDefaultSaveStrategyRegistry(800)
    expect(registry.list().map((s) => s.id)).toEqual(['auto', 'manual'])
    expect(registry.get('auto').id).toBe('auto')
    expect(registry.get('manual').id).toBe('manual')
    registry.disposeAll()
  })
})
