import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultCodecRegistry } from '@codecs/CodecRegistry'
import { DRUM_LANES, MAX_BARS, type SoundPack, type ThemePack } from '@core/types'
import { createDefaultSaveStrategyRegistry } from '@persistence/SaveStrategyRegistry'
import { MemoryPlatformAdapter } from '@platform/MemoryPlatformAdapter'
import { buildLoadedProjectState, formatError } from '@renderer/store/helpers'
import { createProjectStore } from '@renderer/store/useProjectStore'

function createSampleThemePack(id: string, bg: string): ThemePack {
  return {
    meta: { id, name: id, version: '1.0.0', author: 'test', description: '' },
    source: 'user',
    path: `/themes/${id}`,
    tokens: { '--bg-app': bg },
    overrideCss: ''
  }
}

function createSampleSoundPack(id: string, instId: string): SoundPack {
  return {
    meta: { id, name: id, version: '1.0.0', author: 'test', description: '' },
    source: id === 'default-sounds' ? 'builtin' : 'user',
    path: `/sounds/${id}`,
    instruments: [
      {
        id: instId,
        name: instId,
        type: 'synth',
        synth: { waveform: 'triangle', attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 }
      }
    ]
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Store Slices: uiSlice', () => {
  it('updates UI state, clamps lastNoteDurationTick, and clears note selection on track switch', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    store.getState().setViewMode('stage')
    store.getState().setSettingsOpen(true)
    store.getState().setGridDivision('1/24')
    store.getState().setIsPlaying(true)
    store.getState().setLastNoteDurationTick(5.4)
    expect(store.getState().viewMode).toBe('stage')
    expect(store.getState().settingsOpen).toBe(true)
    expect(store.getState().gridDivision).toBe('1/24')
    expect(store.getState().isPlaying).toBe(true)
    expect(store.getState().lastNoteDurationTick).toBe(30)

    store.getState().setLastNoteDurationTick(240.6)
    expect(store.getState().lastNoteDurationTick).toBe(241)

    store.getState().setSelectedNoteIds(['n1', 'n2'])
    store.getState().setSelectedTrackId('track-2')
    expect(store.getState().selectedTrackId).toBe('track-2')
    expect(store.getState().selectedNoteIds).toEqual([])

    store.getState().setSelectedHomeProjectPath('/a.json')
    expect(store.getState().selectedHomeProjectPath).toBe('/a.json')
  })

  it('persists zoom, tool mode, and scroll across Stage Mode transitions and selects all notes in active track', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    store.getState().setViewMode('edit')
    store.getState().setPxPerBeat(132)
    store.getState().setPianoRollToolMode('select')
    store.getState().setPianoRollScroll({ left: 320, top: 480 })

    // Switching to Stage Mode and back preserves editor zoom, tool, and scroll position
    store.getState().setViewMode('stage')
    store.getState().setViewMode('edit')
    expect(store.getState().pxPerBeat).toBe(132)
    expect(store.getState().pianoRollToolMode).toBe('select')
    expect(store.getState().pianoRollScroll).toEqual({ left: 320, top: 480 })

    // selectAllNotes selects every note on the currently selected track
    const activeTrack = store
      .getState()
      .project.tracks.find((t) => t.id === store.getState().selectedTrackId)!
    store.getState().selectAllNotes()
    expect(store.getState().selectedNoteIds).toEqual(activeTrack.notes.map((n) => n.id))
  })

  it('resolves leave prompt promises and cancels superseded prompts safely', async () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    // No-op when no prompt is active
    store.getState().resolveLeaveDecision('save')
    expect(store.getState().unsavedPrompt).toBeNull()

    const first = store.getState().requestLeaveDecision({
      message: 'First prompt',
      saveLabel: 'Save',
      discardLabel: 'Discard'
    })
    expect(store.getState().unsavedPrompt?.message).toBe('First prompt')

    // Opening a second prompt cancels the previous pending promise
    const second = store.getState().requestLeaveDecision({
      message: 'Second prompt',
      saveLabel: 'Save',
      discardLabel: 'Discard'
    })
    expect(await first).toBe('cancel')
    expect(store.getState().unsavedPrompt?.message).toBe('Second prompt')

    store.getState().resolveLeaveDecision('discard')
    expect(await second).toBe('discard')
    expect(store.getState().unsavedPrompt).toBeNull()
  })
})

describe('Store Slices: settingsSlice', () => {
  it('reloads theme/sound packs, opens folders, and switches workspace directory', async () => {
    const platform = new MemoryPlatformAdapter(
      [createSampleThemePack('minimal-light', '#fff'), createSampleThemePack('sunset', '#ffeedd')],
      [
        createSampleSoundPack('default-sounds', 'soft-sine'),
        createSampleSoundPack('extra', 'warm-pad')
      ]
    )
    const openFolderSpy = vi.spyOn(platform, 'openFolder')
    const onThemeChanged = vi.fn()
    const store = createProjectStore({
      platform,
      codecs: createDefaultCodecRegistry(),
      onThemeChanged
    })

    await store.getState().initialize()
    await store.getState().updateSettings({ activeSoundPackIds: ['extra'] })
    expect(store.getState().settings.activeSoundPackIds).toEqual(['default-sounds', 'extra'])
    expect(store.getState().mergedSounds.instruments.some((i) => i.id === 'warm-pad')).toBe(true)

    // Reload packs
    platform.themePacks = [createSampleThemePack('minimal-light', '#eeeeee')]
    await store.getState().reloadThemePacks()
    expect(store.getState().mergedTheme.tokens['--bg-app']).toBe('#eeeeee')
    expect(store.getState().statusMessage).toBe('テーマパックを再読み込みしました')

    await store.getState().reloadSoundPacks()
    expect(store.getState().statusMessage).toBe('音源パックを再読み込みしました')

    await store.getState().openFolder('sounds')
    expect(openFolderSpy).toHaveBeenCalledWith('sounds')

    // Choosing a new workspace reloads packs and workspace projects
    await store.getState().chooseWorkspaceDir()
    expect(store.getState().settings.workspaceDir).toBe('/memory/CustomWorkspace')

    // Canceled folder dialog leaves settings untouched
    vi.spyOn(platform, 'chooseWorkspaceDir').mockResolvedValueOnce(null)
    await store.getState().chooseWorkspaceDir()
    expect(store.getState().settings.workspaceDir).toBe('/memory/CustomWorkspace')

    store.getState().clearStatusMessage()
    expect(store.getState().statusMessage).toBeNull()
  })

  it('triggers debounced auto-save when switching saveMode from manual to auto on a dirty file', async () => {
    vi.useFakeTimers()
    const platform = new MemoryPlatformAdapter()
    const store = createProjectStore({
      platform,
      codecs: createDefaultCodecRegistry(),
      saveStrategies: createDefaultSaveStrategyRegistry(500)
    })

    await store.getState().initialize()
    await store.getState().updateSettings({ saveMode: 'manual' })
    await store.getState().createWorkspaceProject('empty', { openImmediately: true })
    store.getState().setBpm(145)
    expect(store.getState().isDirty).toBe(true)
    expect(platform.directWriteCount).toBe(0)

    await store.getState().updateSettings({ saveMode: 'auto' })
    await vi.advanceTimersByTimeAsync(550)
    expect(platform.directWriteCount).toBe(1)
    expect(store.getState().isDirty).toBe(false)
  })
})

describe('Store Slices: projectSlice', () => {
  it('clamps BPM/bars, toggles loop/solo, and enforces track removal guards', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    store.getState().setBpm(10)
    expect(store.getState().project.bpm).toBe(40)
    store.getState().setBpm(999.4)
    expect(store.getState().project.bpm).toBe(300)

    store.getState().setBars(0)
    expect(store.getState().project.bars).toBe(1)
    store.getState().setBars(MAX_BARS + 50)
    expect(store.getState().project.bars).toBe(MAX_BARS)

    const initialLoop = store.getState().project.loopEnabled
    store.getState().toggleLoop()
    expect(store.getState().project.loopEnabled).toBe(!initialLoop)

    // Add drum track and test solo toggle
    store.getState().addTrack('drum')
    const drumTrackId = store.getState().selectedTrackId
    const drumTrack = store.getState().project.tracks.find((t) => t.id === drumTrackId)!
    expect(drumTrack.type).toBe('drum')
    expect(drumTrack.instrumentId).toBe('basic-kit')
    store.getState().toggleSolo(drumTrackId)
    expect(store.getState().project.tracks.find((t) => t.id === drumTrackId)?.solo).toBe(true)

    // Removing selected track switches selection to first remaining track
    store.getState().removeTrack(drumTrackId)
    expect(store.getState().selectedTrackId).toBe(store.getState().project.tracks[0].id)

    // Cannot remove the last remaining track
    while (store.getState().project.tracks.length > 1) {
      const last = store.getState().project.tracks[store.getState().project.tracks.length - 1]
      store.getState().removeTrack(last.id)
    }
    expect(store.getState().project.tracks).toHaveLength(1)
    store.getState().removeTrack(store.getState().project.tracks[0].id)
    expect(store.getState().project.tracks).toHaveLength(1)
  })

  it('handles note update/delete, drum pitch clamping, snapshot commits, and undo/redo bounds', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    // Undo/redo at boundary are safe no-ops
    expect(store.getState().canUndo()).toBe(false)
    expect(store.getState().canRedo()).toBe(false)
    store.getState().undo()
    store.getState().redo()

    const synthTrack = store.getState().project.tracks.find((t) => t.type === 'synth')!
    const drumTrack = store.getState().project.tracks.find((t) => t.type === 'drum')!

    // Synth note updates lastNoteDurationTick; drum note does not
    const synthNote = store.getState().addNote(synthTrack.id, {
      pitch: 60,
      startTick: 0,
      durationTick: 360,
      velocity: 0.8
    })
    expect(store.getState().lastNoteDurationTick).toBe(360)

    store.getState().updateNote(synthTrack.id, synthNote.id, { durationTick: 480 })
    expect(store.getState().lastNoteDurationTick).toBe(480)

    const drumNote = store.getState().addNote(drumTrack.id, {
      pitch: 0,
      startTick: 0,
      durationTick: 120,
      velocity: 0.9
    })
    expect(store.getState().lastNoteDurationTick).toBe(480)

    // Move drum note outside lane bounds -> clamps to [0, DRUM_LANES.length - 1]
    store.getState().setSelectedTrackId(drumTrack.id)
    store.getState().setSelectedNoteIds([drumNote.id])
    store.getState().moveSelectedNotes(0, 99)
    const movedDrum = store
      .getState()
      .project.tracks.find((t) => t.id === drumTrack.id)!
      .notes.find((n) => n.id === drumNote.id)!
    expect(movedDrum.pitch).toBe(DRUM_LANES.length - 1)

    // Delete single note removes it from selection too
    store.getState().deleteNote(drumTrack.id, drumNote.id)
    expect(store.getState().selectedNoteIds).toEqual([])

    // Delete selected notes on synth track
    store.getState().setSelectedTrackId(synthTrack.id)
    store.getState().setSelectedNoteIds([synthNote.id])
    store.getState().deleteSelectedNotes()
    expect(
      store
        .getState()
        .project.tracks.find((t) => t.id === synthTrack.id)!
        .notes.some((n) => n.id === synthNote.id)
    ).toBe(false)

    // Empty clipboard paste and empty selection copy/delete are safe no-ops
    store.getState().copySelectedNotes()
    store.getState().pasteNotes(0)
    store.getState().deleteSelectedNotes()

    // commitProjectSnapshot pushes history & marks dirty
    const snap = { ...store.getState().project, title: 'Snapshot Title' }
    store.getState().commitProjectSnapshot(snap)
    expect(store.getState().project.title).toBe('Snapshot Title')
    expect(store.getState().canUndo()).toBe(true)
    store.getState().undo()
    expect(store.getState().project.title).not.toBe('Snapshot Title')
  })

  it('reorders tracks with Undo/Redo support and guards invalid indices', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })
    const initialIds = store.getState().project.tracks.map((t) => t.id)
    expect(initialIds.length).toBeGreaterThanOrEqual(3)

    // Invalid or no-op moves do not push history
    store.getState().reorderTracks(0, 0)
    store.getState().reorderTracks(-1, 1)
    store.getState().reorderTracks(0, 99)
    expect(store.getState().canUndo()).toBe(false)

    // Move first track to the end
    store.getState().reorderTracks(0, 2)
    expect(store.getState().project.tracks.map((t) => t.id)).toEqual([
      initialIds[1],
      initialIds[2],
      initialIds[0]
    ])
    expect(store.getState().canUndo()).toBe(true)

    // Undo restores previous order
    store.getState().undo()
    expect(store.getState().project.tracks.map((t) => t.id)).toEqual(initialIds)
  })
})

describe('Store Slices: workspaceSlice error handling & fallbacks', () => {
  it('falls back to Save As when direct write fails and handles missing/corrupt project reads', async () => {
    const platform = new MemoryPlatformAdapter()
    const store = createProjectStore({
      platform,
      codecs: createDefaultCodecRegistry()
    })

    await store.getState().initialize()
    await store.getState().createWorkspaceProject('empty', { openImmediately: true })
    const openedPath = store.getState().currentFilePath!

    // Renaming currently open project syncs currentFilePath and project.title
    expect(await store.getState().renameWorkspaceProject(openedPath, 'Renamed Active')).toBe(true)
    expect(store.getState().project.title).toBe('Renamed Active')
    expect(store.getState().currentFilePath).toContain('Renamed Active.json')

    // Failing writeProjectFile falls back to saveProjectAs
    vi.spyOn(platform, 'writeProjectFile').mockRejectedValueOnce(new Error('EACCES'))
    store.getState().setBpm(135)
    expect(await store.getState().saveProject()).toBe(true)
    expect(platform.saveDialogCount).toBe(1)

    // saveProjectQuietly handles error cleanly and resets isAutoSaving
    vi.spyOn(platform, 'writeProjectFile').mockRejectedValueOnce(new Error('Disk full'))
    expect(await store.getState().saveProjectQuietly()).toBe(false)
    expect(store.getState().isAutoSaving).toBe(false)
    expect(store.getState().statusMessage).toContain('自動保存失敗')

    // Deleting currently open project clears currentFilePath
    const currentPath = store.getState().currentFilePath!
    expect(await store.getState().deleteWorkspaceProject(currentPath)).toBe(true)
    expect(store.getState().currentFilePath).toBeNull()
    expect(await store.getState().saveProjectQuietly()).toBe(false)

    // Opening nonexistent or corrupt project returns false with status message
    expect(await store.getState().openWorkspaceProject('/missing.json')).toBe(false)
    expect(store.getState().statusMessage).toBe('プロジェクトを開けませんでした')

    vi.spyOn(platform, 'openProjectFile').mockResolvedValueOnce({
      canceled: false,
      filePath: '/broken.json',
      content: '{not-valid-json'
    })
    expect(await store.getState().openProject()).toBe(false)
    expect(store.getState().statusMessage).toContain('読み込み失敗')
  })

  it('handles platform errors gracefully on initialize and workspace mutations', async () => {
    const platform = new MemoryPlatformAdapter()
    vi.spyOn(platform, 'loadSettings').mockRejectedValueOnce(new Error('Settings unreadable'))
    const store = createProjectStore({
      platform,
      codecs: createDefaultCodecRegistry()
    })

    await store.getState().initialize()
    expect(store.getState().statusMessage).toContain('初期化エラー')

    vi.spyOn(platform, 'createWorkspaceProject').mockRejectedValueOnce(new Error('Create failed'))
    expect(await store.getState().createWorkspaceProject('empty')).toBeNull()
    expect(store.getState().statusMessage).toContain('作成失敗')

    vi.spyOn(platform, 'duplicateWorkspaceProject').mockRejectedValueOnce(new Error('Dup failed'))
    expect(await store.getState().duplicateWorkspaceProject('/x.json')).toBeNull()
    expect(store.getState().statusMessage).toContain('複製失敗')

    vi.spyOn(platform, 'deleteWorkspaceProject').mockRejectedValueOnce(new Error('Del failed'))
    expect(await store.getState().deleteWorkspaceProject('/x.json')).toBe(false)
    expect(store.getState().statusMessage).toContain('削除失敗')
  })

  it('builds consistent loaded project state and formats unknown error values', () => {
    const empty = {
      title: 'Empty',
      bpm: 120,
      bars: 4,
      loopEnabled: true,
      tracks: []
    }
    const loadedEmpty = buildLoadedProjectState(empty, null)
    expect(loadedEmpty.project).toBe(empty)
    expect(loadedEmpty.history.present).toBe(empty)
    expect(loadedEmpty.history.past).toEqual([])
    expect(loadedEmpty.selectedTrackId).toBe('')
    expect(loadedEmpty.selectedNoteIds).toEqual([])
    expect(loadedEmpty.clipboardNotes).toEqual([])
    expect(loadedEmpty.clipboardTrackType).toBeNull()
    expect(loadedEmpty.pianoRollScroll).toEqual({ left: 0, top: null })
    expect(loadedEmpty.currentFilePath).toBeNull()
    expect(loadedEmpty.isDirty).toBe(false)
    expect(loadedEmpty.viewMode).toBe('edit')

    const withTrack = {
      ...empty,
      tracks: [
        {
          id: 'track-1',
          name: 'Synth',
          type: 'synth' as const,
          instrumentId: 'soft-sine',
          colorIndex: 0,
          volume: 0.8,
          muted: false,
          solo: false,
          notes: []
        }
      ]
    }
    const loadedWithTrack = buildLoadedProjectState(withTrack, '/songs/demo.json')
    expect(loadedWithTrack.selectedTrackId).toBe('track-1')
    expect(loadedWithTrack.currentFilePath).toBe('/songs/demo.json')

    expect(formatError(new Error('Disk full'))).toBe('Disk full')
    expect(formatError('plain string error')).toBe('plain string error')
  })

  it('blocks pasting notes across incompatible pitch domains and allows pasting within the same domain', () => {
    const store = createProjectStore({
      platform: new MemoryPlatformAdapter(),
      codecs: createDefaultCodecRegistry()
    })

    const synthTrack = store.getState().project.tracks.find((t) => t.type === 'synth')!
    const drumTrack = store.getState().project.tracks.find((t) => t.type === 'drum')!
    const origSynthCount = synthTrack.notes.length
    const origDrumCount = drumTrack.notes.length

    // Copy from drum track -> paste into synth track is blocked
    store.getState().setSelectedTrackId(drumTrack.id)
    store.getState().setSelectedNoteIds([drumTrack.notes[0].id])
    store.getState().copySelectedNotes()
    expect(store.getState().clipboardTrackType).toBe('drum')

    store.getState().setSelectedTrackId(synthTrack.id)
    expect(store.getState().pasteNotes(0)).toBeNull()
    expect(store.getState().statusMessage).toBe(
      '異なる種類のノーツはこのトラックにペーストできません'
    )
    expect(store.getState().project.tracks.find((t) => t.id === synthTrack.id)!.notes).toHaveLength(
      origSynthCount
    )

    // Copy from synth track -> paste into drum track is blocked
    store.getState().setSelectedNoteIds([synthTrack.notes[0].id])
    store.getState().copySelectedNotes()
    expect(store.getState().clipboardTrackType).toBe('synth')

    store.getState().setSelectedTrackId(drumTrack.id)
    expect(store.getState().pasteNotes(0)).toBeNull()
    expect(store.getState().statusMessage).toBe(
      '異なる種類のノーツはこのトラックにペーストできません'
    )
    expect(store.getState().project.tracks.find((t) => t.id === drumTrack.id)!.notes).toHaveLength(
      origDrumCount
    )

    // Paste into another synth track (same melodic pitch domain) succeeds
    store.getState().addTrack('synth')
    const secondSynthId = store.getState().selectedTrackId
    expect(store.getState().pasteNotes(480)).not.toBeNull()
    const secondSynth = store.getState().project.tracks.find((t) => t.id === secondSynthId)!
    expect(secondSynth.notes).toHaveLength(1)
    expect(secondSynth.notes[0].pitch).toBe(synthTrack.notes[0].pitch)
    expect(secondSynth.notes[0].startTick).toBe(480)
  })
})
