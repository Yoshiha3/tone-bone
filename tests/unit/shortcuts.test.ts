import { describe, expect, it, vi } from 'vitest'
import { createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { MemoryPlatformAdapter } from '@platform/MemoryPlatformAdapter'
import { dispatchKeyboardShortcut, type ShortcutKeyEvent } from '@renderer/shortcuts'
import { createProjectStore } from '@renderer/store/useProjectStore'

function keyEvent(partial: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    isTextInput: false,
    ...partial
  }
}

function createHarness() {
  const store = createProjectStore({
    platform: new MemoryPlatformAdapter(),
    codecs: createDefaultCodecRegistry()
  })
  const actions = {
    togglePlayPause: vi.fn(),
    requestNewProject: vi.fn(async () => true),
    getCurrentTick: vi.fn(() => 960.4)
  }
  return { store, actions }
}

describe('dispatchKeyboardShortcut', () => {
  it('handles Escape across overlays and Stage Mode with proper priority even inside text inputs', () => {
    const { store, actions } = createHarness()
    const resolveSpy = vi.spyOn(store.getState(), 'resolveLeaveDecision')
    const setSettingsSpy = vi.spyOn(store.getState(), 'setSettingsOpen')
    const setViewSpy = vi.spyOn(store.getState(), 'setViewMode')

    // 1. Unsaved prompt has highest priority
    store.setState({
      viewMode: 'stage',
      settingsOpen: true,
      unsavedPrompt: {
        message: 'Unsaved',
        saveLabel: 'Save',
        discardLabel: 'Discard',
        resolve: vi.fn()
      }
    })
    const res1 = dispatchKeyboardShortcut(
      keyEvent({ key: 'Escape', isTextInput: true }),
      { state: store.getState(), actions }
    )
    expect(res1).toEqual({
      matched: true,
      preventDefault: false,
      id: 'escape-overlay-or-stage'
    })
    expect(resolveSpy).toHaveBeenCalledWith('cancel')
    expect(setSettingsSpy).not.toHaveBeenCalled()

    // 2. Settings modal closes next
    store.setState({ unsavedPrompt: null, settingsOpen: true })
    dispatchKeyboardShortcut(keyEvent({ key: 'Escape' }), { state: store.getState(), actions })
    expect(setSettingsSpy).toHaveBeenCalledWith(false)

    // 3. Stage mode exits to edit
    store.setState({ settingsOpen: false, viewMode: 'stage' })
    dispatchKeyboardShortcut(keyEvent({ key: 'Escape' }), { state: store.getState(), actions })
    expect(setViewSpy).toHaveBeenCalledWith('edit')
  })

  it('suppresses non-Escape shortcuts while typing in inputs or when overlays are open', () => {
    const { store, actions } = createHarness()
    store.setState({ viewMode: 'edit' })

    expect(
      dispatchKeyboardShortcut(
        keyEvent({ code: 'Space', key: ' ', isTextInput: true }),
        { state: store.getState(), actions }
      ).matched
    ).toBe(false)

    store.setState({ settingsOpen: true })
    expect(
      dispatchKeyboardShortcut(
        keyEvent({ code: 'Space', key: ' ' }),
        { state: store.getState(), actions }
      ).matched
    ).toBe(false)
    expect(actions.togglePlayPause).not.toHaveBeenCalled()
  })

  it('routes Home screen shortcuts (Cmd+N, Enter) and ignores edit-only bindings', () => {
    const { store, actions } = createHarness()
    store.setState({ viewMode: 'home', selectedHomeProjectPath: null })

    const openSpy = vi.spyOn(store.getState(), 'openWorkspaceProject').mockResolvedValue(true)

    // Enter without selection does not match
    expect(
      dispatchKeyboardShortcut(keyEvent({ key: 'Enter' }), { state: store.getState(), actions })
        .matched
    ).toBe(false)

    // Enter with selected project opens it
    store.setState({ selectedHomeProjectPath: '/memory/song.json' })
    const enterRes = dispatchKeyboardShortcut(keyEvent({ key: 'Enter' }), {
      state: store.getState(),
      actions
    })
    expect(enterRes).toEqual({ matched: true, preventDefault: true, id: 'home-open-selected' })
    expect(openSpy).toHaveBeenCalledWith('/memory/song.json')

    // Cmd+N requests new project on Home
    const newRes = dispatchKeyboardShortcut(keyEvent({ key: 'n', metaKey: true }), {
      state: store.getState(),
      actions
    })
    expect(newRes.id).toBe('new-project')
    expect(actions.requestNewProject).toHaveBeenCalledTimes(1)

    // Space does not toggle playback on Home
    expect(
      dispatchKeyboardShortcut(keyEvent({ code: 'Space', key: ' ' }), {
        state: store.getState(),
        actions
      }).matched
    ).toBe(false)
  })

  it('routes Edit and Stage mode shortcuts (Space, Undo/Redo, Copy/Paste, Save/SaveAs, Delete)', () => {
    const { store, actions } = createHarness()
    store.setState({ viewMode: 'edit' })

    const undoSpy = vi.spyOn(store.getState(), 'undo')
    const redoSpy = vi.spyOn(store.getState(), 'redo')
    const copySpy = vi.spyOn(store.getState(), 'copySelectedNotes')
    const pasteSpy = vi.spyOn(store.getState(), 'pasteNotes')
    const saveSpy = vi.spyOn(store.getState(), 'saveProject').mockResolvedValue(true)
    const saveAsSpy = vi.spyOn(store.getState(), 'saveProjectAs').mockResolvedValue(true)
    const delSpy = vi.spyOn(store.getState(), 'deleteSelectedNotes')

    dispatchKeyboardShortcut(keyEvent({ code: 'Space', key: ' ' }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'z', ctrlKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'Z', ctrlKey: true, shiftKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'c', metaKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'v', metaKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 's', metaKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'S', metaKey: true, shiftKey: true }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'Backspace' }), {
      state: store.getState(),
      actions
    })

    expect(actions.togglePlayPause).toHaveBeenCalledTimes(1)
    expect(undoSpy).toHaveBeenCalledTimes(1)
    expect(redoSpy).toHaveBeenCalledTimes(1)
    expect(copySpy).toHaveBeenCalledTimes(1)
    expect(pasteSpy).toHaveBeenCalledWith(960)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveAsSpy).toHaveBeenCalledTimes(1)
    expect(delSpy).toHaveBeenCalledTimes(1)

    // Stage mode allows Space, blocks Edit-only undo
    store.setState({ viewMode: 'stage' })
    dispatchKeyboardShortcut(keyEvent({ code: 'Space', key: ' ' }), {
      state: store.getState(),
      actions
    })
    dispatchKeyboardShortcut(keyEvent({ key: 'z', metaKey: true }), {
      state: store.getState(),
      actions
    })
    expect(actions.togglePlayPause).toHaveBeenCalledTimes(2)
    expect(undoSpy).toHaveBeenCalledTimes(1)
  })
})
